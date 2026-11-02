// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

/// <reference lib="webworker" />
import { loadOpenSCAD } from "./openscad-loader.ts";
import { installWorkerHandler } from "./openscad-worker-core.ts";

// Re-export MergedOutputs for backwards compatibility
export type { MergedOutputs } from "./openscad-worker-core.ts";

importScripts("browserfs.min.js");

installWorkerHandler(loadOpenSCAD);
