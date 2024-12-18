#!/bin/bash
set -euo pipefail

if [ -z "${OPENSCAD_DIR:-}" ]; then
  OPENSCAD_DIR=$HOME/tmp/openscad-color
  if [ ! -d "$OPENSCAD_DIR" ]; then
      git clone --recurse https://github.com/ochafik/openscad.git \
          --depth=1 --branch color-assimp2 --single-branch \
          "$OPENSCAD_DIR"
  fi
fi

USE_CCACHE=${USE_CCACHE:-1}

BUILD_IMAGE=openscad/wasm-base:latest
if [[ "$USE_CCACHE" == "1" ]]; then
  BUILD_IMAGE=ochafik-wasm-base:local

  CCACHE_DIR=$HOME/.ccache-em/
  mkdir -p "$CCACHE_DIR"

  echo "
    FROM --platform=linux/amd64 openscad/wasm-base:latest
    RUN apt update && apt install -y ccache && apt clean
  " | docker build --platform=linux/amd64 -t "$BUILD_IMAGE" -f - .
fi

docker run --rm -it --platform=linux/amd64 -v "$OPENSCAD_DIR":/src:rw -v $CCACHE_DIR:/root/.ccache:rw "$BUILD_IMAGE" \
  emcmake cmake -B build-em -DEXPERIMENTAL=ON "$@"
docker run --rm -it --platform=linux/amd64 -v "$OPENSCAD_DIR":/src:rw "$BUILD_IMAGE" \
  cmake --build build-em -j

rm -fR libs/openscad-wasm
mkdir -p libs/openscad-wasm

cp "$OPENSCAD_DIR/build-em/openscad.wasm" libs/openscad-wasm/
cp "$OPENSCAD_DIR/build-em/openscad.js" libs/openscad-wasm/
cp "$OPENSCAD_DIR/build-em/openscad.wasm.map" libs/openscad-wasm/ || true
( cd libs && zip -r ../dist/openscad-wasm.zip openscad-wasm )