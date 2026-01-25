export class Logger {
  private static formatTimestamp(): string {
    return new Date().toISOString();
  }

  static info(message: string, ...args: unknown[]): void {
    console.log(`[${this.formatTimestamp()}] [INFO] ${message}`, ...args);
  }

  static error(message: string, error?: Error | unknown): void {
    console.error(
      `[${this.formatTimestamp()}] [ERROR] ${message}`,
      error instanceof Error ? error.stack : error
    );
  }

  static success(message: string, ...args: unknown[]): void {
    console.log(`[${this.formatTimestamp()}] [SUCCESS] ${message}`, ...args);
  }

  static warn(message: string, ...args: unknown[]): void {
    console.warn(`[${this.formatTimestamp()}] [WARN] ${message}`, ...args);
  }
}
