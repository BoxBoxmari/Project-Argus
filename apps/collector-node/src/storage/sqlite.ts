// Optional SQLite storage for batch processing
// This is a placeholder implementation - would require sqlite3 dependency

export interface SqliteStorage {
  insert(record: any): Promise<void>;
  insertBatch(records: any[]): Promise<void>;
  query(sql: string, params?: any[]): Promise<any[]>;
  close(): Promise<void>;
}

export class SqliteStorageImpl implements SqliteStorage {
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    console.warn('[SQLite] SQLite storage is not implemented yet. Use NDJSON for now.');
  }

  async insert(record: any): Promise<void> {
    throw new Error('SQLite storage not implemented');
  }

  async insertBatch(records: any[]): Promise<void> {
    throw new Error('SQLite storage not implemented');
  }

  async query(sql: string, params?: any[]): Promise<any[]> {
    throw new Error('SQLite storage not implemented');
  }

  async close(): Promise<void> {
    // No-op for now
  }
}

export function createSqliteStorage(dbPath: string): SqliteStorage {
  return new SqliteStorageImpl(dbPath);
}

// Future implementation would use better-sqlite3:
/*
import Database from 'better-sqlite3';

export class SqliteStorageImpl implements SqliteStorage {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        place_url TEXT NOT NULL,
        place_id TEXT,
        review_id TEXT,
        author TEXT,
        relative_time TEXT,
        text TEXT,
        rating INTEGER,
        translated BOOLEAN,
        likes INTEGER,
        photos INTEGER,
        captured_at TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_place_url ON reviews(place_url);
      CREATE INDEX IF NOT EXISTS idx_place_id ON reviews(place_id);
      CREATE INDEX IF NOT EXISTS idx_review_id ON reviews(review_id);
    `);
  }

  async insert(record: any): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO reviews (
        place_url, place_id, review_id, author, relative_time, 
        text, rating, translated, likes, photos, captured_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      record.place_url,
      record.place_id,
      record.review_id,
      record.author,
      record.relative_time,
      record.text,
      record.rating,
      record.translated ? 1 : 0,
      record.likes,
      record.photos,
      record.captured_at
    );
  }

  async insertBatch(records: any[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO reviews (
        place_url, place_id, review_id, author, relative_time, 
        text, rating, translated, likes, photos, captured_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const transaction = this.db.transaction((records: any[]) => {
      for (const record of records) {
        stmt.run(
          record.place_url,
          record.place_id,
          record.review_id,
          record.author,
          record.relative_time,
          record.text,
          record.rating,
          record.translated ? 1 : 0,
          record.likes,
          record.photos,
          record.captured_at
        );
      }
    });
    
    transaction(records);
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
*/
