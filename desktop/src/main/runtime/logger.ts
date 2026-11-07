export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** Writes to stderr so that stdout stays free for `--smoke` output. */
export const consoleLogger: Logger = {
  info: (message) => console.error(`[inquello] ${message}`),
  warn: (message) => console.error(`[inquello] warn: ${message}`),
  error: (message) => console.error(`[inquello] error: ${message}`),
};

export const silentLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

/** A logger that also keeps every message it writes (the smoke run scans them for leaked secrets). */
export interface RecordingLogger extends Logger {
  messages(): readonly string[];
}

export function recordingConsoleLogger(base: Logger = consoleLogger): RecordingLogger {
  const kept: string[] = [];
  return {
    info: (message) => {
      kept.push(message);
      base.info(message);
    },
    warn: (message) => {
      kept.push(message);
      base.warn(message);
    },
    error: (message) => {
      kept.push(message);
      base.error(message);
    },
    messages: () => kept,
  };
}
