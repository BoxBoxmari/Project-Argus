/**
 * Logging utilities for observability
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  component: string;
  message: string;
  data?: unknown;
}

export class Logger {
  private static instance: Logger;
  private level: LogLevel = LogLevel.INFO;
  private entries: LogEntry[] = [];
  private maxEntries = 1000;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  public debug(component: string, message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, component, message, data);
  }

  public info(component: string, message: string, data?: unknown): void {
    this.log(LogLevel.INFO, component, message, data);
  }

  public warn(component: string, message: string, data?: unknown): void {
    this.log(LogLevel.WARN, component, message, data);
  }

  public error(component: string, message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, component, message, data);
  }

  private log(level: LogLevel, component: string, message: string, data?: unknown): void {
    if (level < this.level) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      component,
      message,
      data
    };

    this.entries.push(entry);

    // Trim entries if needed
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Console output
    const levelName = LogLevel[level];
    const timestamp = new Date(entry.timestamp).toISOString();
    const logMessage = `[${timestamp}] ${levelName} [${component}] ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, data);
        break;
      case LogLevel.INFO:
        console.info(logMessage, data);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, data);
        break;
      case LogLevel.ERROR:
        console.error(logMessage, data);
        break;
    }
  }

  public getEntries(component?: string): LogEntry[] {
    if (component) {
      return this.entries.filter(entry => entry.component === component);
    }
    return [...this.entries];
  }

  public exportLogs(): string {
    return this.entries.map(entry => {
      const timestamp = new Date(entry.timestamp).toISOString();
      const levelName = LogLevel[entry.level];
      return `${timestamp} ${levelName} [${entry.component}] ${entry.message}`;
    }).join('\\n');
  }
}
