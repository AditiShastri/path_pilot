import "server-only";

export type DebugMeta = Record<string, unknown>;

export function isDebugEnabled() {
  return process.env.PATH_PILOT_DEBUG === "1";
}

export function debugLog(message: string, meta?: DebugMeta) {
  if (!isDebugEnabled()) return;
  if (meta) {
    console.log(`[path-pilot] ${message}`, meta);
  } else {
    console.log(`[path-pilot] ${message}`);
  }
}
