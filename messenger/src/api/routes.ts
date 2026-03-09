import type { FastifyInstance, FastifyRequest } from 'fastify';
import fs from 'fs';
import { AttachmentService } from '../services/attachmentService.js';
import { ConversationService } from '../services/conversationService.js';
import { MessageService } from '../services/messageService.js';
import { UserService } from '../services/userService.js';
import type { Db } from '../storage/database.js';

export function registerRoutes(app: FastifyInstance, db: Db): void {
  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer' },
    (_req: FastifyRequest, body: Buffer, done) => done(null, body),
  );

  const users = new UserService(db);
  const conversations = new ConversationService(db);
  const messages = new MessageService(db);
  const attachments = new AttachmentService(db);

  const baseUrl = (req: { hostname: string; protocol: string }): string =>
    `${req.protocol}://${req.hostname}`;

  app.get('/health', async () => ({ status: 'ok' }));

  app.post<{ Body: { name: string } }>('/users', async (req, reply) => {
    const { name } = req.body ?? {};
    const user = users.create(name);
    return reply.status(201).send(user);
  });

  app.get('/users', async () => users.list());

  app.get<{ Params: { id: string } }>('/users/:id', async (req) =>
    users.getById(req.params.id),
  );

  app.post<{ Body: { type: 'direct' | 'group'; participantIds: string[] } }>(
    '/conversations',
    async (req, reply) => {
      const { type, participantIds } = req.body ?? {};
      const conv = conversations.create(type, participantIds);
      return reply.status(201).send(conv);
    },
  );

  app.get<{ Params: { id: string } }>('/conversations/:id', async (req) =>
    conversations.getById(req.params.id),
  );

  app.post<{
    Body: {
      conversationId: string;
      senderId: string;
      text?: string;
      attachmentId?: string;
    };
  }>('/messages', async (req, reply) => {
    const msg = messages.send(req.body);
    return reply.status(201).send(msg);
  });

  app.get<{ Params: { id: string } }>(
    '/conversations/:id/messages',
    async (req) => messages.getHistory(req.params.id),
  );

  app.patch<{ Params: { id: string } }>('/messages/:id/delivered', async (req) => {
    messages.markDelivered(req.params.id);
    return { ok: true };
  });

  app.patch<{ Params: { id: string } }>('/messages/:id/read', async (req) => {
    messages.markRead(req.params.id);
    return { ok: true };
  });

  app.post<{
    Body: { filename: string; mimeType: string; sizeBytes: number };
  }>('/attachments/upload-url', async (req, reply) => {
    const { filename, mimeType, sizeBytes } = req.body ?? {};
    const slot = attachments.createUploadSlot(filename, mimeType, sizeBytes, baseUrl(req));
    return reply.status(201).send(slot);
  });

  app.put<{ Params: { id: string }; Body: Buffer }>(
    '/attachments/:id/upload',
    async (req, reply) => {
      const att = attachments.getById(req.params.id);
      const dest = attachments.localPath(att.objectKey);
      fs.writeFileSync(dest, req.body);
      const updated = attachments.markUploaded(req.params.id);
      return reply.status(200).send(updated);
    },
  );

  app.get<{ Params: { id: string } }>('/attachments/:id/url', async (req) => {
    const url = attachments.getDownloadUrl(req.params.id, baseUrl(req));
    return { downloadUrl: url };
  });

  app.get<{ Params: { id: string } }>('/attachments/:id/download', async (req, reply) => {
    const att = attachments.getById(req.params.id);
    if (att.scanStatus !== 'SAFE') {
      return reply.status(403).send({ error: 'File not available.' });
    }
    const filePath = attachments.localPath(att.objectKey);
    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: 'File not found on storage.' });
    }
    return reply
      .header('Content-Type', att.mimeType)
      .header('Content-Disposition', `attachment; filename="${att.filename}"`)
      .send(fs.createReadStream(filePath));
  });

  app.get<{ Params: { id: string } }>('/attachments/:id', async (req) =>
    attachments.getById(req.params.id),
  );

  app.setErrorHandler((error: any, _req, reply) => {
    const statusCode = error.statusCode ?? 400;
    reply.status(statusCode).send({ error: error.message });
  });
}
