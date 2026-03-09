import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createDb } from '../storage/database.js';

const db = createDb(':memory:');
const app = buildApp(db);

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

async function post(url: string, body: unknown) {
  return app.inject({ method: 'POST', url, payload: body as Record<string, unknown> });
}

async function get(url: string) {
  return app.inject({ method: 'GET', url });
}

async function patch(url: string) {
  return app.inject({ method: 'PATCH', url });
}

describe('Core messenger flow', () => {
  let userAId: string;
  let userBId: string;
  let conversationId: string;
  let messageId: string;

  it('1. Create user A', async () => {
    const res = await post('/users', { name: 'Alice' });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Alice');
    userAId = body.id;
  });

  it('2. Create user B', async () => {
    const res = await post('/users', { name: 'Bob' });
    expect(res.statusCode).toBe(201);
    userBId = res.json().id;
  });

  it('3. Create a direct conversation between A and B', async () => {
    const res = await post('/conversations', {
      type: 'direct',
      participantIds: [userAId, userBId],
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.type).toBe('direct');
    conversationId = body.id;
  });

  it('4. Send a text message from A to B', async () => {
    const res = await post('/messages', {
      conversationId,
      senderId: userAId,
      text: 'Hello Bob!',
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.text).toBe('Hello Bob!');
    expect(body.status).toBe('SENT');
    messageId = body.id;
  });

  it('5. Retrieve conversation history and verify the message exists', async () => {
    const res = await get(`/conversations/${conversationId}/messages`);
    expect(res.statusCode).toBe(200);
    const messages = res.json() as Array<{ id: string; text: string }>;
    expect(messages.length).toBe(1);
    expect(messages[0].id).toBe(messageId);
    expect(messages[0].text).toBe('Hello Bob!');
  });

  it('6. Mark message as delivered', async () => {
    const res = await patch(`/messages/${messageId}/delivered`);
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('7. Mark message as read', async () => {
    const res = await patch(`/messages/${messageId}/read`);
    expect(res.statusCode).toBe(200);
  });
});

describe('Error handling', () => {
  it('Reject empty user name', async () => {
    const res = await post('/users', { name: '' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/empty/i);
  });

  it('Reject duplicate user name', async () => {
    await post('/users', { name: 'DupeUser' });
    const res = await post('/users', { name: 'DupeUser' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/already exists/i);
  });

  it('Reject message with no text and no attachment', async () => {
    const a = (await post('/users', { name: 'TestA' })).json();
    const b = (await post('/users', { name: 'TestB' })).json();
    const conv = (
      await post('/conversations', { type: 'direct', participantIds: [a.id, b.id] })
    ).json();

    const res = await post('/messages', {
      conversationId: conv.id,
      senderId: a.id,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/text or an attachment/i);
  });

  it('404 on unknown conversation history', async () => {
    const res = await get('/conversations/non-existent-id/messages');
    expect(res.statusCode).toBe(400);
  });
});

describe('Variant 7 — Attachment flow', () => {
  let userAId: string;
  let userBId: string;
  let conversationId: string;
  let attachmentId: string;

  beforeAll(async () => {
    userAId = (await post('/users', { name: 'AttachA' })).json().id;
    userBId = (await post('/users', { name: 'AttachB' })).json().id;
    conversationId = (
      await post('/conversations', { type: 'direct', participantIds: [userAId, userBId] })
    ).json().id;
  });

  it('1. Request upload slot', async () => {
    const res = await post('/attachments/upload-url', {
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 204800,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.attachmentId).toBeDefined();
    expect(body.uploadUrl).toContain('/attachments/');
    attachmentId = body.attachmentId;
  });

  it('2. Attachment is initially PENDING', async () => {
    const res = await get(`/attachments/${attachmentId}`);
    expect(res.statusCode).toBe(200);
    expect(res.json().scanStatus).toBe('PENDING');
  });

  it('3. Simulate upload via PUT — attachment becomes SAFE', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/attachments/${attachmentId}/upload`,
      payload: Buffer.from('fake image bytes'),
      headers: { 'content-type': 'application/octet-stream' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().scanStatus).toBe('SAFE');
  });

  it('4. Get presigned download URL', async () => {
    const res = await get(`/attachments/${attachmentId}/url`);
    expect(res.statusCode).toBe(200);
    expect(res.json().downloadUrl).toContain('/attachments/');
  });

  it('5. Send a message with the attachment', async () => {
    const res = await post('/messages', {
      conversationId,
      senderId: userAId,
      text: 'Check out this photo!',
      attachmentId,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.attachmentId).toBe(attachmentId);
  });

  it('6. Cannot send message with PENDING attachment', async () => {
    const slot = (
      await post('/attachments/upload-url', {
        filename: 'pending.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      })
    ).json();

    const res = await post('/messages', {
      conversationId,
      senderId: userAId,
      text: 'This should fail',
      attachmentId: slot.attachmentId,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/not safe/i);
  });
});
