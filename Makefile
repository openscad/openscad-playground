# # Pinning WASM build to last good revision (https://github.com/openscad/openscad-playground/issues/60)
# WASM_BUILD_URL=https://files.openscad.org/snapshots/OpenSCAD-2024.09.27.wasm20596-WebAssembly.zip
# # WASM_SNAPSHOT_JS_URL=https://files.openscad.org/snapshots/.snapshot_wasm.js
# # WASM_BUILD_URL=$(shell curl ${WASM_SNAPSHOT_JS_URL} 2>/dev/null | grep https | sed -E "s/.*(https:[^']+)'.*/\1/" )

SINGLE_BRANCH_MAIN=--branch main --single-branch
SINGLE_BRANCH=--branch master --single-branch
SHALLOW=--depth 1

SHELL:=/usr/bin/env bash

all: public

.PHONY: public
public: \
		src/wasm \
		public/openscad.js \
		public/openscad.wasm \
		public/libraries/fonts.zip \
		public/libraries/openscad.zip \
		public/libraries/NopSCADlib.zip \
		public/libraries/BOSL.zip \
		public/libraries/BOSL2.zip \
		public/libraries/boltsparts.zip \
		public/libraries/OpenSCAD-Snippet.zip \
		public/libraries/funcutils.zip \
		public/libraries/FunctionalOpenSCAD.zip \
		public/libraries/YAPP_Box.zip \
		public/libraries/MCAD.zip \
		public/libraries/smooth-prim.zip \
		public/libraries/plot-function.zip \
		public/libraries/openscad-tray.zip \
		public/libraries/closepoints.zip \
		public/libraries/Stemfie_OpenSCAD.zip \
		public/libraries/pathbuilder.zip \
		public/libraries/openscad_attachable_text3d.zip \
		public/libraries/brailleSCAD.zip \
		public/libraries/UB.scad.zip \
		public/libraries/lasercut.zip

clean:
	rm -fR libs build
	rm -fR public/openscad.{js,wasm}
	rm -fR public/libraries
	rm -fR src/wasm

dist/index.js: public
	npm run build

dist/openscad-worker.js: src/openscad-worker.ts
	npx rollup -c

src/wasm: libs/openscad-wasm
	rm -f src/wasm
	ln -sf "$(shell pwd)/libs/openscad-wasm" src/wasm

libs/openscad/build/openscad.js: libs/openscad
	( cd libs/openscad && ./scripts/wasm-base-docker-run.sh emcmake cmake -B build -DCMAKE_BUILD_TYPE=Release -DEXPERIMENTAL=1 )
	( cd libs/openscad && ./scripts/wasm-base-docker-run.sh cmake --build build )

libs/openscad-wasm: libs/openscad/build/openscad.js
	mkdir -p libs/openscad-wasm
	cp libs/openscad/build/openscad.* libs/openscad-wasm/

# libs/openscad-wasm:
# 	mkdir -p libs/openscad-wasm
# 	wget ${WASM_BUILD_URL} -O libs/openscad-wasm.zip
# 	( cd libs/openscad-wasm && unzip ../openscad-wasm.zip )
	
public/openscad.js: libs/openscad-wasm libs/openscad-wasm/openscad.js
	ln -sf libs/openscad-wasm/openscad.js public/openscad.js
		
public/openscad.wasm: libs/openscad-wasm libs/openscad-wasm/openscad.wasm
	ln -sf libs/openscad-wasm/openscad.wasm public/openscad.wasm

# Var w/ noto fonts
NOTO_FONTS=\
	libs/noto/NotoNaskhArabic-Bold.ttf \
	libs/noto/NotoNaskhArabic-Regular.ttf \
	libs/noto/NotoSans-Bold.ttf \
	libs/noto/NotoSans-Italic.ttf \
	libs/noto/NotoSans-Regular.ttf \
	libs/noto/NotoSansArmenian-Bold.ttf \
	libs/noto/NotoSansArmenian-Regular.ttf \
	libs/noto/NotoSansBalinese-Regular.ttf \
	libs/noto/NotoSansBengali-Bold.ttf \
	libs/noto/NotoSansBengali-Regular.ttf \
	libs/noto/NotoSansDevanagari-Bold.ttf \
	libs/noto/NotoSansDevanagari-Regular.ttf \
	libs/noto/NotoSansEthiopic-Bold.ttf \
	libs/noto/NotoSansEthiopic-Regular.ttf \
	libs/noto/NotoSansGeorgian-Bold.ttf \
	libs/noto/NotoSansGeorgian-Regular.ttf \
	libs/noto/NotoSansGujarati-Bold.ttf \
	libs/noto/NotoSansGujarati-Regular.ttf \
	libs/noto/NotoSansGurmukhi-Bold.ttf \
	libs/noto/NotoSansGurmukhi-Regular.ttf \
	libs/noto/NotoSansHebrew-Bold.ttf \
	libs/noto/NotoSansHebrew-Regular.ttf \
	libs/noto/NotoSansJavanese-Regular.ttf \
	libs/noto/NotoSansKannada-Bold.ttf \
	libs/noto/NotoSansKannada-Regular.ttf \
	libs/noto/NotoSansKhmer-Bold.ttf \
	libs/noto/NotoSansKhmer-Regular.ttf \
	libs/noto/NotoSansLao-Bold.ttf \
	libs/noto/NotoSansLao-Regular.ttf \
	libs/noto/NotoSansMongolian-Regular.ttf \
	libs/noto/NotoSansMyanmar-Bold.ttf \
	libs/noto/NotoSansMyanmar-Regular.ttf \
	libs/noto/NotoSansOriya-Bold.ttf \
	libs/noto/NotoSansOriya-Regular.ttf \
	libs/noto/NotoSansSinhala-Bold.ttf \
	libs/noto/NotoSansSinhala-Regular.ttf \
	libs/noto/NotoSansTamil-Bold.ttf \
	libs/noto/NotoSansTamil-Regular.ttf \
	libs/noto/NotoSansThai-Bold.ttf \
	libs/noto/NotoSansThai-Regular.ttf \
	libs/noto/NotoSansTibetan-Bold.ttf \
	libs/noto/NotoSansTibetan-Regular.ttf \
	libs/noto/NotoSansTifinagh-Regular.ttf \

# Way too big for now, also can't make them work yet:
# libs/noto/NotoSansCJKtc-Bold.otf
# libs/noto/NotoSansCJKtc-Regular.otf

public/libraries/fonts.zip: $(NOTO_FONTS) libs/liberation
	mkdir -p public/libraries
	zip -r $@ -j fonts.conf libs/noto/*.ttf libs/liberation/{*.ttf,LICENSE,AUTHORS}

libs/noto/%.ttf:
	mkdir -p libs/noto
	wget https://github.com/openmaptiles/fonts/raw/master/noto-sans/$(notdir $@) -O $@
	
libs/noto/%.otf:
	mkdir -p libs/noto
	wget https://github.com/openmaptiles/fonts/raw/master/noto-sans/$(notdir $@) -O $@
	
libs/liberation:
	git clone --recurse https://github.com/shantigilbert/liberation-fonts-ttf.git ${SHALLOW} ${SINGLE_BRANCH} $@

libs/openscad:
	git clone --recurse https://github.com/openscad/openscad.git ${SHALLOW} ${SINGLE_BRANCH} $@

public/libraries/openscad.zip: libs/openscad
	mkdir -p public/libraries
	( cd libs/openscad ; zip -r ../../public/libraries/openscad.zip `find examples -name '*.scad' | grep -v tests` )

libs/BOSL2: 
	git clone --recurse https://github.com/BelfrySCAD/BOSL2.git ${SHALLOW} ${SINGLE_BRANCH} $@

public/libraries/BOSL2.zip: libs/BOSL2
	mkdir -p public/libraries
	( cd libs/BOSL2 ; zip -r ../../public/libraries/BOSL2.zip *.scad LICENSE examples )

libs/BOSL: 
	git clone --recurse https://github.com/revarbat/BOSL.git ${SHALLOW} ${SINGLE_BRANCH} $@

public/libraries/BOSL.zip: libs/BOSL
	mkdir -p public/libraries
	( cd libs/BOSL ; zip -r ../../public/libraries/BOSL.zip *.scad LICENSE )

libs/NopSCADlib: 
	git clone --recurse https://github.com/nophead/NopSCADlib.git ${SHALLOW} ${SINGLE_BRANCH} $@

public/libraries/NopSCADlib.zip: libs/NopSCADlib
	mkdir -p public/libraries
	( cd libs/NopSCADlib ; zip -r ../../public/libraries/NopSCADlib.zip `find . -name '*.scad'` COPYING )

libs/funcutils: 
	git clone --recurse https://github.com/thehans/funcutils.git ${SHALLOW} ${SINGLE_BRANCH} $@

public/libraries/funcutils.zip: libs/funcutils
	mkdir -p public/libraries
	( cd libs/funcutils ; zip -r ../../public/libraries/funcutils.zip *.scad LICENSE )

libs/FunctionalOpenSCAD: 
	git clone --recurse https://github.com/thehans/FunctionalOpenSCAD.git ${SHALLOW} ${SINGLE_BRANCH} $@

public/libraries/FunctionalOpenSCAD.zip: libs/FunctionalOpenSCAD
	mkdir -p public/libraries
	( cd libs/FunctionalOpenSCAD ; zip -r ../../public/libraries/FunctionalOpenSCAD.zip *.scad LICENSE )

libs/YAPP_Box: 
	git clone --recurse https://github.com/mrWheel/YAPP_Box.git ${SHALLOW} ${SINGLE_BRANCH_MAIN} $@

public/libraries/YAPP_Box.zip: libs/YAPP_Box
	mkdir -p public/libraries
	( cd libs/YAPP_Box ; zip -r ../../public/libraries/YAPP_Box.zip `find . -name '*.scad'` LICENSE )

libs/MCAD:
	git clone --recurse https://github.com/openscad/MCAD.git ${SHALLOW} ${SINGLE_BRANCH} $@

public/libraries/MCAD.zip: libs/MCAD
	mkdir -p public/libraries
	( cd libs/MCAD ; zip -r ../../public/libraries/MCAD.zip *.scad bitmap/*.scad LICENSE )

libs/boltsparts:
	git clone --recurse https://github.com/boltsparts/boltsparts.git ${SHALLOW} ${SINGLE_BRANCH_MAIN} $@

public/libraries/boltsparts.zip: libs/boltsparts
	mkdir -p public/libraries
	( cd libs/boltsparts/openscad ; zip -r ../../../public/libraries/boltsparts.zip `find . -name '*.scad' | grep -v tests` ../LICENSE )

libs/OpenSCAD-Snippet:
	git clone --recurse https://github.com/AngeloNicoli/OpenSCAD-Snippet.git ${SHALLOW} ${SINGLE_BRANCH_MAIN} $@

public/libraries/OpenSCAD-Snippet.zip: libs/OpenSCAD-Snippet
	mkdir -p public/libraries
	( cd libs/OpenSCAD-Snippet ; zip -r ../../public/libraries/OpenSCAD-Snippet.zip `find . -name '*.scad'` LICENSE )

libs/Stemfie_OpenSCAD: 
	git clone --recurse https://github.com/Cantareus/Stemfie_OpenSCAD.git ${SHALLOW} ${SINGLE_BRANCH_MAIN} $@

public/libraries/Stemfie_OpenSCAD.zip: libs/Stemfie_OpenSCAD
	mkdir -p public/libraries
	( cd libs/Stemfie_OpenSCAD ; zip -r ../../public/libraries/Stemfie_OpenSCAD.zip *.scad LICENSE )

libs/pathbuilder: 
	git clone --recurse https://github.com/dinther/pathbuilder.git ${SHALLOW} ${SINGLE_BRANCH_MAIN} $@

public/libraries/pathbuilder.zip: libs/pathbuilder
	mkdir -p public/libraries
	( cd libs/pathbuilder ; zip -r ../../public/libraries/pathbuilder.zip *.scad demo/*.scad LICENSE )

libs/openscad_attachable_text3d: 
	git clone --recurse https://github.com/jon-gilbert/openscad_attachable_text3d.git ${SHALLOW} ${SINGLE_BRANCH_MAIN} $@

public/libraries/openscad_attachable_text3d.zip: libs/openscad_attachable_text3d
	mkdir -p public/libraries
	( cd libs/openscad_attachable_text3d ; zip -r ../../public/libraries/openscad_attachable_text3d.zip *.scad LICENSE )

libs/brailleSCAD:
	git clone --recurse https://github.com/BelfrySCAD/brailleSCAD.git ${SHALLOW} ${SINGLE_BRANCH_MAIN} $@

public/libraries/brailleSCAD.zip: libs/brailleSCAD
	mkdir -p public/libraries
	( cd libs/brailleSCAD ; zip -r ../../public/libraries/brailleSCAD.zip *.scad LICENSE )

# libs/threads: 
# 	git clone --recurse https://github.com/rcolyer/threads.git ${SHALLOW} ${SINGLE_BRANCH} $@

# public/libraries/threads.zip: libs/threads
# 	mkdir -p public/libraries
# 	( cd libs/threads ; zip -r ../../public/libraries/threads.zip *.scad LICENSE.txt )

libs/smooth-prim: 
	git clone --recurse https://github.com/rcolyer/smooth-prim.git ${SHALLOW} ${SINGLE_BRANCH} $@

public/libraries/smooth-prim.zip: libs/smooth-prim
	mkdir -p public/libraries
	( cd libs/smooth-prim ; zip -r ../../public/libraries/smooth-prim.zip *.scad LICENSE.txt )

libs/plot-function: 
	git clone --recurse https://github.com/rcolyer/plot-function.git ${SHALLOW} ${SINGLE_BRANCH} $@

public/libraries/plot-function.zip: libs/plot-function
	mkdir -p public/libraries
	( cd libs/plot-function ; zip -r ../../public/libraries/plot-function.zip *.scad LICENSE.txt )

libs/closepoints: 
	git clone --recurse https://github.com/rcolyer/closepoints.git ${SHALLOW} ${SINGLE_BRANCH} $@

public/libraries/closepoints.zip: libs/closepoints
	mkdir -p public/libraries
	( cd libs/closepoints ; zip -r ../../public/libraries/closepoints.zip *.scad LICENSE.txt )

libs/UB.scad: 
	git clone --recurse https://github.com/UBaer21/UB.scad.git ${SHALLOW} ${SINGLE_BRANCH_MAIN} $@

public/libraries/UB.scad.zip: libs/UB.scad
	mkdir -p public/libraries
	( cd libs/UB.scad ; zip -r ../../public/libraries/UB.scad.zip libraries/*.scad LICENSE examples/UBexamples )

libs/openscad-tray: 
	git clone --recurse https://github.com/sofian/openscad-tray.git ${SHALLOW} ${SINGLE_BRANCH_MAIN} $@

public/libraries/openscad-tray.zip: libs/openscad-tray
	mkdir -p public/libraries
	( cd libs/openscad-tray ; zip -r ../../public/libraries/openscad-tray.zip *.scad LICENSE )
	
libs/lasercut:
	git clone --recurse https://github.com/bmsleight/lasercut.git ${SHALLOW} ${SINGLE_BRANCH} $@
public/libraries/lasercut.zip: libs/lasercut
	mkdir -p public/libraries
	( cd libs/lasercut ; zip -r ../../public/libraries/lasercut.zip *.scad LICENSE )
	
