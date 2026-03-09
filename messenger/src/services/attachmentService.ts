import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import type { Attachment } from '../models/types.js';
import type { Db } from '../storage/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export interface UploadSlot {
  attachmentId: string;
  uploadUrl: string;
}

export class AttachmentService {
  constructor(private db: Db) {}

  createUploadSlot(
    filename: string,
    mimeType: string,
    sizeBytes: number,
    baseUrl: string,
  ): UploadSlot {
    if (!filename || filename.trim() === '') {
      throw new Error('Filename must not be empty.');
    }
    if (sizeBytes <= 0) {
      throw new Error('File size must be greater than 0.');
    }

    const id = uuidv4();
    const objectKey = `${id}-${path.basename(filename)}`;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    this.db
      .prepare(
        `INSERT INTO attachments
           (id, filename, mimeType, sizeBytes, objectKey, scanStatus, expiresAt, createdAt)
         VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)`
      )
      .run(id, filename.trim(), mimeType, sizeBytes, objectKey, expiresAt, now);

    return {
      attachmentId: id,
      uploadUrl: `${baseUrl}/attachments/${id}/upload`,
    };
  }

  markUploaded(id: string): Attachment {
    const att = this.getById(id);
    if (att.scanStatus !== 'PENDING') {
      throw new Error(`Attachment ${id} already processed (${att.scanStatus}).`);
    }

    this.db
      .prepare(`UPDATE attachments SET scanStatus = 'SAFE' WHERE id = ?`)
      .run(id);

    return this.getById(id);
  }

  getDownloadUrl(id: string, baseUrl: string): string {
    const att = this.getById(id);
    if (att.scanStatus !== 'SAFE') {
      throw new Error(`Attachment ${id} is not available for download (${att.scanStatus}).`);
    }
    return `${baseUrl}/attachments/${id}/download`;
  }

  getById(id: string): Attachment {
    const att = this.db
      .prepare('SELECT * FROM attachments WHERE id = ?')
      .get(id) as Attachment | undefined;
    if (!att) throw new Error(`Attachment "${id}" not found.`);
    return att;
  }

  localPath(objectKey: string): string {
    return path.join(UPLOADS_DIR, objectKey);
  }

  quarantine(id: string): void {
    this.db
      .prepare(`UPDATE attachments SET scanStatus = 'QUARANTINED' WHERE id = ?`)
      .run(id);
  }
}
