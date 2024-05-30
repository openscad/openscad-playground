// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { Symlinks } from "./filesystem";

export type ZipArchives = {
  [name: string]: {
    deployed?: boolean,
    description?: string,
    gitOrigin?: {
      repoUrl: string,
      branch: string,
      include: {
        glob: string | string[],
        ignore?: string | string[],
        replacePrefix?: {[path: string]: string},
      }[]
    }
    symlinks?: Symlinks,
    docs?: {[name: string]: string}
  }
};

export const zipArchives: ZipArchives = {
  'fonts': {},
  'openscad': {
    description: 'OpenSCAD',
    gitOrigin: {
      branch: 'master',
      repoUrl: 'https://github.com/openscad/openscad',
      include: [{glob: ['examples/*.scad', 'LICENSE']}],
    },
    docs: {
      'CheatSheet': 'https://openscad.org/cheatsheet/index.html',
      'Documentation': 'https://openscad.org/documentation.html',
    },
  },
  'MCAD': {
    description: 'OpenSCAD Parametric CAD Library',
    gitOrigin: {
      branch: 'master',
      repoUrl: 'https://github.com/openscad/MCAD',
      include: [{glob: ['*.scad', 'bitmap/*.scad', 'LICENSE']}],
    },
  },
  'BOSL': {
    description: 'The Belfry OpenScad Library',
    gitOrigin: {
      branch: 'master',
      repoUrl: 'https://github.com/revarbat/BOSL',
      include: [{glob: ['**/*.scad', 'LICENSE']}],
    },
  },
  'BOSL2': {
    description: 'The Belfry OpenScad Library, v2.0',
    gitOrigin: {
      branch: 'master',
      repoUrl: 'https://github.com/revarbat/BOSL2',
      include: [{glob: ['**/*.scad', 'LICENSE']}],
    },
    docs: {
      'CheatSheet': 'https://github.com/revarbat/BOSL2/wiki/CheatSheet',
      'Wiki': 'https://github.com/revarbat/BOSL2/wiki',
    },
  },
  'NopSCADlib': {
    gitOrigin: {
      branch: 'master',
      repoUrl: 'https://github.com/nophead/NopSCADlib',
      include: [{
        glob: '**/*.scad',
        ignore: 'test/**',
      }],
    },
  },
  'boltsparts': {
    description: 'OpenSCAD library for generating bolt/nut models',
    gitOrigin: {
      branch: 'main',
      repoUrl: 'https://github.com/boltsparts/boltsparts',
      include: [{
        glob: 'openscad/**/*.scad',
        ignore: 'test/**',
      }],
    },
    docs: {
      'Usage': 'https://boltsparts.github.io/en/docs/0.3/document/openscad/usage.html',
    },
  },
  'brailleSCAD': {
    gitOrigin: {
      branch: 'main',
      repoUrl: 'https://github.com/BelfrySCAD/brailleSCAD',
      include: [{
        glob: ['**/*.scad', 'LICENSE'],
        ignore: 'test/**',
      }],
    },
    docs: {
      'Documentation': 'https://github.com/BelfrySCAD/brailleSCAD/wiki/TOC',
    },
  },
  'FunctionalOpenSCAD': {
    description: 'Implementing OpenSCAD in OpenSCAD',
    gitOrigin: {
      branch: 'master',
      repoUrl: 'https://github.com/thehans/FunctionalOpenSCAD',
      include: [{glob: ['**/*.scad', 'LICENSE']}],
    },
  },
  'OpenSCAD-Snippet': {
    description: 'OpenSCAD Snippet Library',
    gitOrigin: {
      branch: 'main',
      repoUrl: 'https://github.com/AngeloNicoli/OpenSCAD-Snippet',
      include: [{glob: ['**/*.scad', 'LICENSE']}],
    },
    symlinks: {
      'Asset_SCAD': 'Asset_SCAD',
      'Import_Library.scad': 'Import_Library.scad',
    },
  },
  'funcutils': {
    description: 'OpenSCAD collection of functional programming utilities, making use of function-literals.',
    gitOrigin: {
      branch: 'master',
      repoUrl: 'https://github.com/thehans/funcutils',
      include: [{glob: '**/*.scad'}],
    },
  },
  'smooth-prim': {
    description: 'OpenSCAD smooth primitives library',
    gitOrigin: {
      branch: 'master',
      repoUrl: 'https://github.com/rcolyer/smooth-prim',
      include: [{glob: ['**/*.scad', 'LICENSE.txt']}],
    },
    symlinks: {'smooth_prim.scad': 'smooth_prim.scad'},
  },
  'closepoints': {
    description: 'OpenSCAD ClosePoints Library',
    gitOrigin: {
      branch: 'master',
      repoUrl: 'https://github.com/rcolyer/closepoints',
      include: [{glob: ['**/*.scad', 'LICENSE.txt']}],
    },
    symlinks: {'closepoints.scad': 'closepoints.scad'},
  },
  'plot-function': {
    description: 'OpenSCAD Function Plotting Library',
    gitOrigin: {
      branch: 'master',
      repoUrl: 'https://github.com/colyer/plot-function',
      include: [{glob: ['**/*.scad', 'LICENSE.txt']}],
    },
    symlinks: {'plot_function.scad': 'plot_function.scad'},
  },
  // 'threads': {
  //   deployed: false,
  //   gitOrigin: {
  //     branch: 'master',
  //     repoUrl: 'https://github.com/colyer/threads',
  //     include: [{glob: ['**/*.scad', 'LICENSE.txt']}],
  //   },
  // },
  'openscad-tray': {
    description: 'OpenSCAD library to create rounded rectangular trays with optional subdividers.',
    gitOrigin: {
      branch: 'main',
      repoUrl: 'https://github.com/sofian/openscad-tray',
      include: [{glob: ['**/*.scad', 'LICENSE']}],
    },
    symlinks: {'tray.scad': 'tray.scad'},
  },
  'YAPP_Box': {
    description: 'Yet Another Parametric Projectbox Box',
    gitOrigin: {
      branch: 'main',
      repoUrl: 'https://github.com/mrWheel/YAPP_Box',
      include: [{glob: ['**/*.scad', 'LICENSE']}],
    },
  },
  'Stemfie_OpenSCAD': {
    description: 'OpenSCAD Stemfie Library',
    gitOrigin: {
      branch: 'main',
      repoUrl: 'https://github.com/Cantareus/Stemfie_OpenSCAD',
      include: [{glob: ['**/*.scad', 'LICENSE']}],
    },
  },
  'UB.scad': {
    gitOrigin: {
      branch: 'main',
      repoUrl: 'https://github.com/UBaer21/UB.scad',
      include: [{glob: ['libraries/*.scad', 'LICENSE', 'examples/UBexamples/*.scad'], replacePrefix: {
        'libraries/': '',
        'examples/UBexamples/': 'examples/',
      }}],
    },
    symlinks: {"ub.scad": "libraries/ub.scad"}, // TODO change this after the replaces work
  },
  'pathbuilder': {
    gitOrigin: {
      branch: 'main',
      repoUrl: 'https://github.com/dinther/pathbuilder.git',
      include: [{glob: ['**/*.scad', 'LICENSE']}],
    },
  },
  'openscad_attachable_text3d': {
    gitOrigin: {
      branch: 'main',
      repoUrl: 'https://github.com/jon-gilbert/openscad_attachable_text3d.git',
      include: [{glob: ['**/*.scad', 'LICENSE']}],
    },
  },
};

export const deployedArchiveNames =
  Object.entries(zipArchives)
    .filter(([_, {deployed}]) => deployed == null || deployed)
    .map(([n]) => n);
