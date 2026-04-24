/**
 * Tiny leveled logger that wraps console to keep combat spam controllable.
 * Level can be changed at runtime (e.g. via the debug overlay).
 */
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const order: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

let current: LogLevel = "info";

export const Logger = {
  setLevel(level: LogLevel): void {
    current = level;
  },
  getLevel(): LogLevel {
    return current;
  },
  debug(...args: unknown[]): void {
    if (order[current] <= order.debug) console.debug("[EOTG]", ...args);
  },
  info(...args: unknown[]): void {
    if (order[current] <= order.info) console.info("[EOTG]", ...args);
  },
  warn(...args: unknown[]): void {
    if (order[current] <= order.warn) console.warn("[EOTG]", ...args);
  },
  error(...args: unknown[]): void {
    if (order[current] <= order.error) console.error("[EOTG]", ...args);
  },
};
