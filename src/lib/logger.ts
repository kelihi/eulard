type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

const currentLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || "info";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[currentLevel];
}

interface LogEntry {
  severity: string;
  timestamp: string;
  message: string;
  method?: string;
  path?: string;
  userId?: string;
  requestId?: string;
  durationMs?: number;
  statusCode?: number;
  error?: string;
  [key: string]: unknown;
}

type LogExtra = Partial<Omit<LogEntry, "severity" | "timestamp" | "message">>;

function log(level: LogLevel, message: string, extra?: LogExtra) {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    severity: level.toUpperCase(),
    timestamp: new Date().toISOString(),
    message,
    ...extra,
  };

  // Use console.log for all levels — Cloud Logging parses severity from JSON
  console.log(JSON.stringify(entry));
}

export const logger = {
  trace: (message: string, extra?: LogExtra) => log("trace", message, extra),
  debug: (message: string, extra?: LogExtra) => log("debug", message, extra),
  info: (message: string, extra?: LogExtra) => log("info", message, extra),
  warn: (message: string, extra?: LogExtra) => log("warn", message, extra),
  error: (message: string, extra?: LogExtra) => log("error", message, extra),

  /** Log an API request start + end. Returns helpers to call when done. */
  apiRequest(method: string, path: string, extra?: LogExtra) {
    const start = Date.now();
    log("info", "request", { method, path, ...extra });
    return {
      done(statusCode: number, message?: string, moreExtra?: LogExtra) {
        const durationMs = Date.now() - start;
        log("info", message || "response", { method, path, statusCode, durationMs, ...extra, ...moreExtra });
      },
      fail(error: unknown, moreExtra?: LogExtra) {
        const durationMs = Date.now() - start;
        const errorMsg = error instanceof Error ? error.message : String(error);
        log("error", "request failed", {
          method,
          path,
          durationMs,
          error: errorMsg,
          ...extra,
          ...moreExtra,
        });
      },
    };
  },
};
