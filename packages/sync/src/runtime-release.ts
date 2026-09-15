// Compatible fixes raise this release without raising the SDK minimum.
export const documentRuntimeVersion = "1.0.0";

// Before releasing a new major, preserve the last supported implementation of
// each older major in ../runtime-archive/document-runtime-<version>.js.
export const retainedRuntimeVersions: readonly string[] = [];
