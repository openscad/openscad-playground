#!/bin/bash
set -euo pipefail

if [ -z "${OPENSCAD_DIR:-}" ]; then
  OPENSCAD_DIR=$HOME/tmp/openscad-color
  if [ ! -d "$OPENSCAD_DIR" ]; then
      rm -fR "$OPENSCAD_DIR"
      git clone --recurse https://github.com/ochafik/openscad.git \
          --depth=1 --branch color-assimp2 --single-branch \
          "$OPENSCAD_DIR"
  fi
fi

docker run --rm -it -v "$OPENSCAD_DIR":/src:rw --platform=linux/amd64 openscad/wasm-base:latest \
  emcmake cmake -B build -DEXPERIMENTAL=ON "$@"
docker run --rm -it -v "$OPENSCAD_DIR":/src:rw --platform=linux/amd64 openscad/wasm-base:latest \
  cmake --build build -j2

rm -fR libs/openscad-wasm
mkdir -p libs/openscad-wasm

cp "$OPENSCAD_DIR/build/openscad.wasm" libs/openscad-wasm/
cp "$OPENSCAD_DIR/build/openscad.js" libs/openscad-wasm/
cp "$OPENSCAD_DIR/build/openscad.wasm.map" libs/openscad-wasm/ || true
( cd libs && zip -r ../dist/openscad-wasm.zip openscad-wasm )