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

export DOCKER_DEFAULT_PLATFORM=linux/arm64
docker build --platform linux/amd64 \
    --build-arg "OPENSCAD_DIR=$OPENSCAD_DIR" \
    -t tmp-openscad-wasm . \
    -f <( cat <<'EOF'
FROM --platform=linux/amd64 openscad/wasm-base:latest
ARG EMXX_FLAGS
ARG OPENSCAD_DIR
RUN git clone https://github.com/assimp/assimp.git --depth 1 --branch master --single-branch /src/assimp && \
  cd /src/assimp && \
  emcmake cmake -B build \
    -DASSIMP_BUILD_ZLIB=0 \
    -DBUILD_SHARED_LIBS=0 \
    -DASSIMP_BUILD_TESTS=0 \
    -DCMAKE_BUILD_TYPE=Release && \
  cmake --build build -j4 && \
  cmake --install build
COPY ${OPENSCAD_DIR} /src/openscad
ENV PKG_CONFIG_PATH="/emsdk/upstream/emscripten/cache/sysroot/lib/pkgconfig"
RUN cd /src/openscad && \
  emcmake cmake -B /build \
    -DWASM=ON \
    -DSNAPSHOT=ON \
    -DENABLE_TBB=OFF \
    -DEXPERIMENTAL=ON \
    -DENABLE_CAIRO=OFF \
    -DUSE_MIMALLOC=OFF \
    -DBoost_USE_STATIC_RUNTIME=ON \
    -DBoost_USE_STATIC_LIBS=ON \
    -DCMAKE_BUILD_TYPE=Release && \
  sed -e "s|-lfontconfig|/emsdk/upstream/emscripten/cache/sysroot/lib/libglib-2.0.a /emsdk/upstream/emscripten/cache/sysroot/lib/libzip.a /emsdk/upstream/emscripten/cache/sysroot/lib/libz.a /emsdk/upstream/emscripten/cache/sysroot/lib/libfontconfig.a|g" -i /build/CMakeFiles/OpenSCAD.dir/linklibs.rsp && \
  sed -e "s|em++|em++ ${EMXX_FLAGS} -s USE_PTHREADS=0 -s NO_DISABLE_EXCEPTION_CATCHING -s FORCE_FILESYSTEM=1 -s ALLOW_MEMORY_GROWTH=1 -s EXPORTED_RUNTIME_METHODS=['FS','callMain'] -s EXPORT_ES6=1 -s ENVIRONMENT=web,worker -s MODULARIZE=1 -s EXPORT_NAME=OpenSCAD -s EXIT_RUNTIME=1|g" -i /build/CMakeFiles/OpenSCAD.dir/link.txt && \
  cmake --build /build -j6
EOF
)

docker create --platform linux/amd64 --name tmpcpy tmp-openscad-wasm
rm -fR libs/openscad-wasm
mkdir -p libs/openscad-wasm
docker cp tmpcpy:/build/openscad.wasm libs/openscad-wasm/
docker cp tmpcpy:/build/openscad.js libs/openscad-wasm/
docker cp tmpcpy:/build/openscad.wasm.map libs/openscad-wasm/ || true
docker rm tmpcpy
