type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  method?: string;
  path?: string;
  userId?: string;
  message: string;
  durationMs?: number;
  statusCode?: number;
  error?: string;
  [key: string]: unknown;
}

function formatLog(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    entry.level.toUpperCase(),
    entry.method && entry.path ? `${entry.method} ${entry.path}` : "",
    entry.userId ? `user=${entry.userId}` : "",
    entry.message,
    entry.statusCode ? `status=${entry.statusCode}` : "",
    entry.durationMs !== undefined ? `${entry.durationMs}ms` : "",
    entry.error ? `error="${entry.error}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return parts;
}

function log(level: LogLevel, message: string, extra?: Partial<LogEntry>) {
  const entry: LogEntry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...extra,
  };

  const formatted = formatLog(entry);

  switch (level) {
    case "error":
      console.error(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export const logger = {
  info: (message: string, extra?: Partial<LogEntry>) => log("info", message, extra),
  warn: (message: string, extra?: Partial<LogEntry>) => log("warn", message, extra),
  error: (message: string, extra?: Partial<LogEntry>) => log("error", message, extra),

  /** Log an API request start + end. Returns a function to call when done. */
  apiRequest(method: string, path: string, extra?: Partial<LogEntry>) {
    const start = Date.now();
    log("info", "request", { method, path, ...extra });
    return {
      done(statusCode: number, message?: string, moreExtra?: Partial<LogEntry>) {
        const durationMs = Date.now() - start;
        log("info", message || "response", { method, path, statusCode, durationMs, ...moreExtra });
      },
      fail(error: unknown, moreExtra?: Partial<LogEntry>) {
        const durationMs = Date.now() - start;
        const errorMsg = error instanceof Error ? error.message : String(error);
        log("error", "request failed", {
          method,
          path,
          durationMs,
          error: errorMsg,
          ...moreExtra,
        });
      },
    };
  },
};
