import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'messenger.db');

export function createDb(dbPath = DB_PATH): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id   TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('direct','group'))
    );

    CREATE TABLE IF NOT EXISTS participants (
      conversationId TEXT NOT NULL REFERENCES conversations(id),
      userId         TEXT NOT NULL REFERENCES users(id),
      PRIMARY KEY (conversationId, userId)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id          TEXT PRIMARY KEY,
      filename    TEXT NOT NULL,
      mimeType    TEXT NOT NULL,
      sizeBytes   INTEGER NOT NULL,
      objectKey   TEXT NOT NULL,
      scanStatus  TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK(scanStatus IN ('PENDING','SAFE','QUARANTINED')),
      expiresAt   TEXT,
      createdAt   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id             TEXT PRIMARY KEY,
      conversationId TEXT NOT NULL REFERENCES conversations(id),
      senderId       TEXT NOT NULL REFERENCES users(id),
      text           TEXT,
      attachmentId   TEXT REFERENCES attachments(id),
      status         TEXT NOT NULL DEFAULT 'SENT'
                     CHECK(status IN ('SENT','DELIVERED','READ')),
      createdAt      TEXT NOT NULL
    );
  `);

  return db;
}

export type Db = Database.Database;
