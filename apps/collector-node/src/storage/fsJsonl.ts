import fs from 'fs';
import path from 'path';

export interface JsonlWriter {
  write(record: any): void;
  close(): Promise<void>;
}

export class StreamingJsonlWriter implements JsonlWriter {
  private stream: fs.WriteStream;

  constructor(filePath: string) {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.stream = fs.createWriteStream(filePath, { flags: 'a' });
  }

  write(record: any): void {
    this.stream.write(JSON.stringify(record) + '\n');
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stream.end((error: any) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

export class BufferedJsonlWriter implements JsonlWriter {
  private buffer: any[] = [];
  private filePath: string;
  private batchSize: number;

  constructor(filePath: string, batchSize = 100) {
    this.filePath = filePath;
    this.batchSize = batchSize;

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  write(record: any): void {
    this.buffer.push(record);
    
    if (this.buffer.length >= this.batchSize) {
      this.flush();
    }
  }

  private flush(): void {
    if (this.buffer.length === 0) return;

    const content = this.buffer.map(record => JSON.stringify(record)).join('\n') + '\n';
    fs.appendFileSync(this.filePath, content, 'utf8');
    this.buffer = [];
  }

  async close(): Promise<void> {
    this.flush();
  }
}

export function createJsonlWriter(filePath: string, buffered = false, batchSize = 100): JsonlWriter {
  if (buffered) {
    return new BufferedJsonlWriter(filePath, batchSize);
  } else {
    return new StreamingJsonlWriter(filePath);
  }
}
