#!/usr/bin/env bash
#
# build-wasm-fallback.sh — build a pure-JavaScript (wasm2js) OpenSCAD module
# for devices where WebAssembly is disabled (iOS/macOS Lockdown Mode, a strict
# Content-Security-Policy, locked-down enterprise browsers, very old browsers).
#
#   Output:   public/openscad.fallback.js   — a single self-contained script.
#   Requires: Docker, git, ~6+ GB free disk, and patience.
#
# Why a rebuild, and not a conversion of the existing openscad.wasm?
#   Emscripten removed classic asm.js in 2.0 (2020). The modern JS fallback is
#   wasm2js, a Binaryen pass selected at *link* time via -sWASM=0. OpenSCAD
#   must therefore be re-linked; openscad.wasm cannot be converted in place.
#
# Why a patched Binaryen?
#   Upstream wasm2js emits one JS nesting level per wasm block/if, which reaches
#   ~1500 levels for OpenSCAD; JS parsers overflow their stack on that. The
#   vendored patch (scripts/patches/) flattens deep chains, bringing it to ~70.
#
# See docs/WASM_FALLBACK.md. CI: .github/workflows/build-fallback.yml.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${ROOT}/libs/openscad-fallback-build"
OUT="${ROOT}/public/openscad.fallback.js"

# Upstream Binaryen at a pinned commit, plus our vendored wasm2js patch.
BINARYEN_REPO="${BINARYEN_REPO:-https://github.com/WebAssembly/binaryen.git}"
BINARYEN_REF="${BINARYEN_REF:-58e27a24d5940211ec54cb587ab8a93b931ec5fd}"
BINARYEN_PATCH="${ROOT}/scripts/patches/binaryen-wasm2js-flatten-deep-control-flow.patch"

# Optional override: skip the Binaryen Linux build and use an existing
# patched `wasm2js` binary (Linux ELF) at this path.
PATCHED_WASM2JS="${PATCHED_WASM2JS:-}"

# Dependency image (CGAL/Boost/GMP/MPFR/... prebuilt for Emscripten), used
# by openscad-wasm and OpenSCAD's own CI.
BASE_IMAGE="${BASE_IMAGE:-openscad/wasm-base-release:latest}"
OPENSCAD_REPO="${OPENSCAD_REPO:-https://github.com/openscad/openscad.git}"
# Pinned to a known-good commit (April 2026 master).
OPENSCAD_REF="${OPENSCAD_REF:-b38f68881203d7fc9926b6d87d6abf64e21ad312}"

# The base image is amd64-only, and the patched wasm2js runs inside it.
# On a native x86-64 host (e.g. a GitHub-hosted runner) this is a no-op; set
# PLATFORM= (empty) to omit --platform entirely.
PLATFORM="${PLATFORM-linux/amd64}"
PLATFORM_ARGS=()
[ -n "${PLATFORM}" ] && PLATFORM_ARGS=(--platform "${PLATFORM}")

# Parallelism for ninja (default: all cores).
JOBS="${JOBS:-$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 2)}"

# ONLY=binaryen : build just the patched wasm2js, then stop. If WASM2JS_OUT is
#                 set, the binary is also copied there (used by CI to cache and
#                 pass it between jobs).
ONLY="${ONLY:-}"
WASM2JS_OUT="${WASM2JS_OUT:-}"

# Optional: directory for a persistent ccache (CI caches it between runs).
CCACHE_DIR="${CCACHE_DIR:-}"

# Container CLI (set DOCKER=podman, or DOCKER_CONTEXT, as needed).
DOCKER="${DOCKER:-docker}"

# Shallow-clone a repo at an exact commit.
fetch_ref() {
  local repo="$1" ref="$2" dir="$3"
  if [ ! -d "${dir}/.git" ]; then
    git init -q "${dir}"
    git -C "${dir}" remote add origin "${repo}"
  fi
  git -C "${dir}" fetch -q --depth 1 origin "${ref}"
  git -C "${dir}" checkout -q --force FETCH_HEAD
  git -C "${dir}" submodule update -q --init --recursive --depth 1
}

command -v "${DOCKER}" >/dev/null || { echo "error: Docker is required."  >&2; exit 1; }
command -v git    >/dev/null || { echo "error: git is required."     >&2; exit 1; }

mkdir -p "${WORK}"
cd "${WORK}"

# --- 1. Patched Binaryen (Linux native build) ------------------------------
# We need a NATIVE Linux wasm2js binary to mount into the emsdk inside the
# openscad build container — not a wasm-targeted build.
if [ -z "${PATCHED_WASM2JS}" ]; then
  echo ">> Fetching Binaryen ${BINARYEN_REF} from ${BINARYEN_REPO}..."
  fetch_ref "${BINARYEN_REPO}" "${BINARYEN_REF}" binaryen
  git -C binaryen clean -fdq -e build-linux
  git -C binaryen apply "${BINARYEN_PATCH}"
  if [ ! -x binaryen/build-linux/bin/wasm2js ]; then
    echo ">> Building patched Binaryen wasm2js (native Linux)..."
    "${DOCKER}" run --rm ${PLATFORM_ARGS[@]+"${PLATFORM_ARGS[@]}"} -v "${WORK}/binaryen:/src" -w /src ubuntu:22.04 bash -lc '
      set -euo pipefail
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq
      apt-get install -y -qq cmake ninja-build g++ python3 git
      git config --global --add safe.directory "*"
      cmake -B build-linux -G Ninja -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTS=OFF -DBUILD_STATIC_LIB=ON
      cmake --build build-linux --target wasm2js --parallel '"${JOBS}"'
    '
  fi
  PATCHED_WASM2JS="${WORK}/binaryen/build-linux/bin/wasm2js"
fi
[ -x "${PATCHED_WASM2JS}" ] || { echo "error: patched wasm2js not found/executable at ${PATCHED_WASM2JS}" >&2; exit 1; }
echo ">> Using patched wasm2js: ${PATCHED_WASM2JS}"
if [ -n "${WASM2JS_OUT}" ]; then
  mkdir -p "$(dirname "${WASM2JS_OUT}")"
  cp "${PATCHED_WASM2JS}" "${WASM2JS_OUT}"
fi
if [ "${ONLY}" = "binaryen" ]; then
  echo ">> ONLY=binaryen: done."
  exit 0
fi

# --- 2. OpenSCAD source ----------------------------------------------------
echo ">> Fetching OpenSCAD source (${OPENSCAD_REF})..."
fetch_ref "${OPENSCAD_REPO}" "${OPENSCAD_REF}" openscad

# --- 3. Patch OpenSCAD's Emscripten link flags for a wasm2js target -------
# wasm2js cannot use an ES module loaded via importScripts, a >2 GB heap,
# WASM_BIGINT, or native wasm exception handling; the wasm-exception abort
# hook is also meaningless without wasm. Rewrite those tokens in OpenSCAD's
# CMakeLists.txt in place. The -fwasm-exceptions -> -fexceptions swap is
# defensive: OpenSCAD already builds with -fexceptions, but native wasm
# exceptions would not survive wasm2js, so guard against upstream drift.
echo ">> Patching CMakeLists.txt for the wasm2js (-sWASM=0) target..."
cd openscad
git checkout -- CMakeLists.txt 2>/dev/null || true
sed -i.bak \
  -e 's/-sEXPORT_ES6=1/-sEXPORT_ES6=0/g' \
  -e 's/-sMAXIMUM_MEMORY=4GB/-sMAXIMUM_MEMORY=2GB/g' \
  -e 's/-sABORT_ON_WASM_EXCEPTIONS//g' \
  -e 's/-fwasm-exceptions/-fexceptions/g' \
  CMakeLists.txt

# Append the wasm2js link flags. Emscripten resolves repeated -s settings
# last-wins, so these take effect regardless of what OpenSCAD already set:
#   -sWASM=0                 : emit wasm2js (pure JS) instead of WebAssembly.
#   -sSINGLE_FILE=1          : one self-contained .js (no .wasm / .mem sidecar).
#   -sWASM_BIGINT=0          : wasm2js rejects WASM_BIGINT (emcc 4.x default-on).
#   -sSUPPORT_LONGJMP=...    : JS-based setjmp/longjmp, so no WebAssembly.Tag.
#   -sMODULARIZE / EXPORT_NAME : pin the global `OpenSCAD` factory the loader
#                              expects (src/runner/openscad-loader.ts).
FALLBACK_LINK_FLAGS="-sWASM=0 -sSINGLE_FILE=1 -sWASM_BIGINT=0 -sSUPPORT_LONGJMP=emscripten -sMODULARIZE=1 -sEXPORT_NAME=OpenSCAD"

# --- 4. Build OpenSCAD with -sWASM=0 using the patched wasm2js -------------
# Bind-mount the patched wasm2js binary over the emsdk's wasm2js inside the
# build container, so emcc picks it up during the -sWASM=0 link.
echo ">> Building OpenSCAD (wasm2js) inside ${BASE_IMAGE}, using patched wasm2js..."
CCACHE_ARGS=()
if [ -n "${CCACHE_DIR}" ]; then
  mkdir -p "${CCACHE_DIR}"
  CCACHE_ARGS=(-v "${CCACHE_DIR}:/ccache" -e CCACHE_DIR=/ccache)
fi
"${DOCKER}" run --rm ${PLATFORM_ARGS[@]+"${PLATFORM_ARGS[@]}"} ${CCACHE_ARGS[@]+"${CCACHE_ARGS[@]}"} \
  -v "${WORK}/openscad:/src" \
  -v "${PATCHED_WASM2JS}:/emsdk/upstream/bin/wasm2js:ro" \
  -w /src "${BASE_IMAGE}" bash -lc "
  set -euo pipefail
  git config --global --add safe.directory '*'
  if [ -d /ccache ]; then
    command -v ccache >/dev/null || { apt-get update -qq && apt-get install -y -qq ccache; } || true
    if command -v ccache >/dev/null; then export EM_COMPILER_WRAPPER=ccache; ccache -z; fi
  fi
  emcmake cmake -B build-fallback -G Ninja \
    -DBoost_USE_STATIC_RUNTIME=ON -DBoost_USE_STATIC_LIBS=ON \
    -DCMAKE_BUILD_TYPE=Release -DEXPERIMENTAL=ON -DSNAPSHOT=ON \
    -DWASM_BUILD_TYPE=web \
    -DCMAKE_EXE_LINKER_FLAGS='${FALLBACK_LINK_FLAGS}'
  # Retry with fewer jobs if the parallel build dies (e.g. out of memory).
  cmake --build build-fallback --parallel ${JOBS} || cmake --build build-fallback -j2 || cmake --build build-fallback
  if command -v ccache >/dev/null; then ccache -s; fi
"

SRC_JS="${WORK}/openscad/build-fallback/openscad.js"
if [ ! -f "${SRC_JS}" ]; then
  echo "error: build did not produce ${SRC_JS}" >&2
  exit 1
fi

cp "${SRC_JS}" "${OUT}"
echo ">> Wrote ${OUT} ($(du -h "${OUT}" | cut -f1))"
echo ">> Done. Rebuild the playground ('npm run build') to include the fallback."
