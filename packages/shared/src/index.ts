// Public surface of the shared package: canonical types, assessment configs, and
// the detection / mapping / validation engine used identically by client and server.

export const SHARED_PACKAGE = "@assessment/shared";

export * from "./types.js";
export * from "./assessment-configs/index.js";
export * from "./detection.js";
export * from "./mapping.js";
export * from "./validation/normalize.js";
export * from "./validation/rules.js";
export * from "./validation/engine.js";
