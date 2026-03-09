import { v4 as uuidv4 } from 'uuid';
import type { Conversation } from '../models/types.js';
import type { Db } from '../storage/database.js';

export class ConversationService {
  constructor(private db: Db) {}

  create(type: 'direct' | 'group', participantIds: string[]): Conversation {
    if (!participantIds || participantIds.length < 2) {
      throw new Error('A conversation requires at least 2 participants.');
    }

    if (type === 'direct' && participantIds.length !== 2) {
      throw new Error('A direct conversation must have exactly 2 participants.');
    }

    for (const uid of participantIds) {
      const exists = this.db.prepare('SELECT id FROM users WHERE id = ?').get(uid);
      if (!exists) throw new Error(`User "${uid}" not found.`);
    }

    const conv: Conversation = { id: uuidv4(), type };

    const insertConv = this.db.prepare(
      'INSERT INTO conversations (id, type) VALUES (?, ?)'
    );
    const insertParticipant = this.db.prepare(
      'INSERT INTO participants (conversationId, userId) VALUES (?, ?)'
    );

    const runAll = this.db.transaction(() => {
      insertConv.run(conv.id, conv.type);
      for (const uid of participantIds) {
        insertParticipant.run(conv.id, uid);
      }
    });
    runAll();

    return conv;
  }

  getById(id: string): Conversation {
    const conv = this.db
      .prepare('SELECT * FROM conversations WHERE id = ?')
      .get(id) as Conversation | undefined;
    if (!conv) throw new Error(`Conversation "${id}" not found.`);
    return conv;
  }

  assertParticipant(conversationId: string, userId: string): void {
    const row = this.db
      .prepare('SELECT 1 FROM participants WHERE conversationId = ? AND userId = ?')
      .get(conversationId, userId);
    if (!row) {
      throw new Error(`User "${userId}" is not a participant of conversation "${conversationId}".`);
    }
  }
}
