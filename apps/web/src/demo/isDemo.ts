// True in the static demo build (VITE_DEMO=true). Read at call time so tests can
// stub it. Gates demo-only conveniences like the sample-file picker.
export function isDemoMode(): boolean {
  return (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_DEMO === "true";
}
