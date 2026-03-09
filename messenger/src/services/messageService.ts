import { v4 as uuidv4 } from 'uuid';
import type { Message } from '../models/types.js';
import type { Db } from '../storage/database.js';

export class MessageService {
  constructor(private db: Db) {}

  send(params: {
    conversationId: string;
    senderId: string;
    text?: string;
    attachmentId?: string;
  }): Message {
    const { conversationId, senderId, text, attachmentId } = params;

    if ((!text || text.trim() === '') && !attachmentId) {
      throw new Error('Message must have either text or an attachment.');
    }

    const conv = this.db
      .prepare('SELECT id FROM conversations WHERE id = ?')
      .get(conversationId);
    if (!conv) throw new Error(`Conversation "${conversationId}" not found.`);

    const participant = this.db
      .prepare('SELECT 1 FROM participants WHERE conversationId = ? AND userId = ?')
      .get(conversationId, senderId);
    if (!participant) {
      throw new Error(`User "${senderId}" is not a participant of this conversation.`);
    }

    if (attachmentId) {
      const att = this.db
        .prepare('SELECT scanStatus FROM attachments WHERE id = ?')
        .get(attachmentId) as { scanStatus: string } | undefined;
      if (!att) throw new Error(`Attachment "${attachmentId}" not found.`);
      if (att.scanStatus !== 'SAFE') {
        throw new Error(
          `Attachment "${attachmentId}" is not safe for delivery (status: ${att.scanStatus}).`
        );
      }
    }

    const msg: Message = {
      id: uuidv4(),
      conversationId,
      senderId,
      text: text?.trim() ?? null,
      attachmentId: attachmentId ?? null,
      status: 'SENT',
      createdAt: new Date().toISOString(),
    };

    this.db
      .prepare(
        `INSERT INTO messages (id, conversationId, senderId, text, attachmentId, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(msg.id, msg.conversationId, msg.senderId, msg.text, msg.attachmentId, msg.status, msg.createdAt);

    return msg;
  }

  getHistory(conversationId: string): Message[] {
    const conv = this.db
      .prepare('SELECT id FROM conversations WHERE id = ?')
      .get(conversationId);
    if (!conv) throw new Error(`Conversation "${conversationId}" not found.`);

    return this.db
      .prepare('SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt ASC')
      .all(conversationId) as Message[];
  }

  markDelivered(messageId: string): void {
    this.db
      .prepare(`UPDATE messages SET status = 'DELIVERED' WHERE id = ? AND status = 'SENT'`)
      .run(messageId);
  }

  markRead(messageId: string): void {
    this.db
      .prepare(`UPDATE messages SET status = 'READ' WHERE id = ? AND status != 'READ'`)
      .run(messageId);
  }
}
