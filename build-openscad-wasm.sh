#!/bin/bash
set -euo pipefail

if [ -z "${OPENSCAD_DIR:-}" ]; then
  OPENSCAD_DIR=/tmp/openscad-color
  if [ ! -d "$OPENSCAD_DIR" ]; then
      rm -fR "$OPENSCAD_DIR"
      git clone --recurse https://github.com/ochafik/openscad.git \
          --depth=1 --branch color-assimp2 --single-branch \
          "$OPENSCAD_DIR"
  fi
fi

# -DASSIMP_BUILD_NONFREE_C4D_IMPORTER=0 \
# -DASSIMP_BUILD_ALL_IMPORTERS_BY_DEFAULT=0 \
# -DASSIMP_BUILD_ALL_EXPORTERS_BY_DEFAULT=0 \
# -DASSIMP_BUILD_GLTF_IMPORTER=1 \
# -DASSIMP_BUILD_GLTF_EXPORTER=1 \
# -DASSIMP_BUILD_3MF_EXPORTER=1 \
#  && \
#   ln -s /emsdk/upstream/emscripten/cache/sysroot/lib/cmake/assimp-* /emsdk/upstream/emscripten/cache/sysroot/lib/cmake/assimp && \
#   ln -sf /emsdk/upstream/emscripten/cache/sysroot/lib/cmake/assimp/assimpConfig.cmake /emsdk/upstream/emscripten/cache/sysroot/lib/cmake/assimp/assimp-config.cmake

# export DOCKER_DEFAULT_PLATFORM=linux/arm64
DOCKERFILE=$PWD/Dockerfile.wasm
( cd "$OPENSCAD_DIR" && 
  docker build --platform linux/amd64 \
      --build-arg "OPENSCAD_DIR=$OPENSCAD_DIR" \
      --build-arg "EMXX_FLAGS=${EMXX_FLAGS:-}" \
      -t tmp-openscad-wasm . \
      -f "$DOCKERFILE" )

docker create --platform linux/amd64 --name tmpcpy tmp-openscad-wasm
rm -fR libs/openscad-wasm
mkdir -p libs/openscad-wasm
docker cp tmpcpy:/build/openscad.wasm libs/openscad-wasm/
docker cp tmpcpy:/build/openscad.js libs/openscad-wasm/
docker cp tmpcpy:/build/openscad.wasm.map libs/openscad-wasm/ || true
docker rm tmpcpy
