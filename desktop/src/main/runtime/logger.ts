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
