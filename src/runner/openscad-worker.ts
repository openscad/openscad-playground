// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

/// <reference lib="webworker" />
import OpenSCAD from "../wasm/openscad.js";
import { installWorkerHandler } from "./openscad-worker-core.ts";

// Re-export MergedOutputs for backwards compatibility
export type { MergedOutputs } from "./openscad-worker-core.ts";

importScripts("browserfs.min.js");

installWorkerHandler(OpenSCAD);
