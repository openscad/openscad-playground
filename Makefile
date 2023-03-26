WASM_BUILD_URL=https://files.openscad.org/snapshots/OpenSCAD-2023.03.22.wasm14181-WebAssembly.zip

SINGLE_BRANCH_MAIN=--branch main --single-branch
SINGLE_BRANCH=--branch master --single-branch
SHALLOW=--depth 1

all: public

.PHONY: public
public: \
		libs/openscad \
		public/openscad.js \
		public/openscad.wasm \
		public/libraries/fonts.zip \
		public/libraries/NopSCADlib.zip \
		public/libraries/BOSL.zip \
		public/libraries/BOSL2.zip \
		public/libraries/funcutils.zip \
		public/libraries/FunctionalOpenSCAD.zip \
		public/libraries/YAPP_Box.zip \
		public/libraries/MCAD.zip \
		public/libraries/smooth-prim.zip \
		public/libraries/plot-function.zip \
		public/libraries/openscad-tray.zip \
		public/libraries/closepoints.zip \
		public/libraries/Stemfie_OpenSCAD.zip \
		public/libraries/UB.scad.zip

clean:
	rm -fR libs build
	rm -fR public/openscad.{js,wasm}
	rm -fR public/libraries
	rm -fR src/wasm

dist/index.js: public
	npm run build2
	# mkdir -f build/libraries
	# cp -f public/libraries/*.zip build/libraries

dist/openscad-worker.js: src/openscad-worker.ts
	npx rollup -c

libs/openscad:
	mkdir -p libs/openscad
	wget ${WASM_BUILD_URL} -O libs/openscad.zip
	( cd libs/openscad && unzip ../openscad.zip )
	rm libs/openscad.zip
	rm -f src/wasm
	ln -sf $(shell pwd)/libs/openscad src/wasm
	
public/openscad.js: libs/openscad libs/openscad/openscad.js
	cp libs/openscad/openscad.{js,wasm} public
		
public/openscad.wasm: libs/openscad libs/openscad/openscad.wasm
	cp libs/openscad/openscad.wasm public

public/libraries/fonts.zip: libs/liberation
	mkdir -p public/libraries
	cp fonts.conf libs/liberation
	( cd libs/liberation && zip -r ../../public/libraries/fonts.zip fonts.conf *.ttf LICENSE AUTHORS )

libs/liberation:
	git clone --recurse https://github.com/shantigilbert/liberation-fonts-ttf.git ${SHALLOW} ${SINGLE_BRANCH} $@

libs/BOSL2: 
	git clone --recurse https://github.com/revarbat/BOSL2.git ${SHALLOW} ${SINGLE_BRANCH} $@

public/libraries/BOSL2.zip: libs/BOSL2
	mkdir -p public/libraries
	( cd libs/BOSL2 ; zip -r ../../public/libraries/BOSL2.zip *.scad LICENSE )

libs/BOSL: 
	git clone --recurse https://github.com/revarbat/BOSL.git ${SHALLOW} ${SINGLE_BRANCH} $@

public/libraries/BOSL.zip: libs/BOSL
	mkdir -p public/libraries
	( cd libs/BOSL ; zip -r ../../public/libraries/BOSL.zip *.scad LICENSE )

libs/NopSCADlib: 
	git clone --recurse https://github.com/nophead/NopSCADlib.git ${SHALLOW} ${SINGLE_BRANCH} $@

public/libraries/NopSCADlib.zip: libs/NopSCADlib
	mkdir -p public/libraries
	( cd libs/NopSCADlib ; zip -r ../../public/libraries/NopSCADlib.zip `find . -name '*.scad' | grep -v tests | grep -v examples` COPYING )

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
	( cd libs/YAPP_Box ; zip -r ../../public/libraries/YAPP_Box.zip *.scad LICENSE )

libs/MCAD:
	git clone --recurse https://github.com/openscad/MCAD.git ${SHALLOW} ${SINGLE_BRANCH} $@

public/libraries/MCAD.zip: libs/MCAD
	mkdir -p public/libraries
	( cd libs/MCAD ; zip -r ../../public/libraries/MCAD.zip *.scad bitmap/*.scad LICENSE )

libs/Stemfie_OpenSCAD: 
	git clone --recurse https://github.com/Cantareus/Stemfie_OpenSCAD.git ${SHALLOW} ${SINGLE_BRANCH_MAIN} $@

public/libraries/Stemfie_OpenSCAD.zip: libs/Stemfie_OpenSCAD
	mkdir -p public/libraries
	( cd libs/Stemfie_OpenSCAD ; zip -r ../../public/libraries/Stemfie_OpenSCAD.zip *.scad LICENSE )

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
	( cd libs/UB.scad ; zip -r ../../public/libraries/UB.scad.zip libraries/*.scad LICENSE )

libs/openscad-tray: 
	git clone --recurse https://github.com/sofian/openscad-tray.git ${SHALLOW} ${SINGLE_BRANCH_MAIN} $@

public/libraries/openscad-tray.zip: libs/openscad-tray
	mkdir -p public/libraries
	( cd libs/openscad-tray ; zip -r ../../public/libraries/openscad-tray.zip *.scad LICENSE )
