// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { Symlinks } from "./filesystem";

export type ZipArchives = {
  [name: string]: {
    symlinks?: Symlinks
  }
};

export const zipArchives: ZipArchives = {
  'fonts': {},
  // @openscad
  'MCAD': {},
  // @revarbat
  'BOSL': {},
  'BOSL2': {
    // "includes": {
    //   "BOSL2/std.scad": "The Belfry OpenScad Library, v2.0. An OpenSCAD library of shapes, masks, and manipulators to make working with OpenSCAD easier. BETA"
    // }
  },
  // @nophead
  'NopSCADlib': {},
  // @thehans
  'FunctionalOpenSCAD': {},
  'funcutils': {},
  // @colyer
  'smooth-prim': {
    symlinks: {'smooth_prim.scad': 'smooth_prim.scad'},
  },
  'closepoints': {
    symlinks: {'closepoints.scad': 'closepoints.scad'},
  },
  'plot-function': {
    symlinks: {'plot_function.scad': 'plot_function.scad'},
  },
  // 'threads': {},
  // @sofian
  'openscad-tray': {
    symlinks: {'tray.scad': 'tray.scad'},
  },
  // @mrWheel
  'YAPP_Box': {},
  // @Cantareus
  'Stemfie_OpenSCAD': {},
  // @UBaer21
  'UB.scad': {
    symlinks: {"ub.scad": "libraries/ub.scad"},
  },
};
