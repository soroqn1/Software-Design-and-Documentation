# Messenger — Lab 2, Variant 7: File Attachments

A minimal but fully functional messenger API prototype built for the **Software Design and Documentation** course (Lab 2).

Implements all mandatory architecture requirements **plus** Variant 7: **File Attachments** (images, documents).

---

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Language | TypeScript (ESM)                    |
| Runtime  | Node.js 20+                         |
| HTTP     | [Fastify](https://fastify.dev)      |
| Database | SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Tests    | [Vitest](https://vitest.dev)        |

---

## Project Structure

```
messenger/
├── src/
│   ├── main.ts                  # Entry point
│   ├── app.ts                   # Fastify app factory (for DI in tests)
│   ├── models/
│   │   └── types.ts             # TypeScript interfaces
│   ├── storage/
│   │   └── database.ts          # SQLite init + schema
│   ├── services/
│   │   ├── userService.ts       # User CRUD
│   │   ├── conversationService.ts
│   │   ├── messageService.ts    # Send, history, status updates
│   │   └── attachmentService.ts # Upload slot, scan, presigned URL (Variant 7)
│   ├── api/
│   │   └── routes.ts            # All HTTP routes
│   └── tests/
│       └── integration.test.ts  # Integration tests
├── data/                        # SQLite DB file (auto-created)
├── uploads/                     # Local file storage simulating S3 (auto-created)
├── postman_collection.json      # Postman API collection
├── package.json
└── tsconfig.json
```

---

## How to Run

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
```

Server starts at **http://localhost:3000**

---

## API Reference

### Core (Mandatory)

| Method | Endpoint                              | Description                     |
|--------|---------------------------------------|---------------------------------|
| GET    | `/health`                             | Health check                    |
| POST   | `/users`                              | Create a user                   |
| GET    | `/users`                              | List all users                  |
| GET    | `/users/:id`                          | Get user by ID                  |
| POST   | `/conversations`                      | Create a conversation            |
| GET    | `/conversations/:id`                  | Get conversation by ID          |
| POST   | `/messages`                           | Send a message                  |
| GET    | `/conversations/:id/messages`         | Get message history             |
| PATCH  | `/messages/:id/delivered`             | Mark message as delivered       |
| PATCH  | `/messages/:id/read`                  | Mark message as read            |

### Variant 7 — Attachments

| Method | Endpoint                              | Description                              |
|--------|---------------------------------------|------------------------------------------|
| POST   | `/attachments/upload-url`             | Get presigned upload slot                |
| PUT    | `/attachments/:id/upload`             | Upload file bytes (simulates S3 PUT)     |
| GET    | `/attachments/:id`                    | Get attachment metadata                  |
| GET    | `/attachments/:id/url`                | Get presigned download URL               |
| GET    | `/attachments/:id/download`           | Download the actual file                 |

---

## Quick Start (curl)

```bash
# 1. Create users
curl -X POST http://localhost:3000/users -H 'Content-Type: application/json' -d '{"name":"Alice"}'
curl -X POST http://localhost:3000/users -H 'Content-Type: application/json' -d '{"name":"Bob"}'

# 2. Create conversation (paste IDs from step 1)
curl -X POST http://localhost:3000/conversations \
  -H 'Content-Type: application/json' \
  -d '{"type":"direct","participantIds":["<aliceId>","<bobId>"]}'

# 3. Send a message
curl -X POST http://localhost:3000/messages \
  -H 'Content-Type: application/json' \
  -d '{"conversationId":"<convId>","senderId":"<aliceId>","text":"Hello!"}'

# 4. Read history
curl http://localhost:3000/conversations/<convId>/messages

# 5. Upload a file attachment
curl -X POST http://localhost:3000/attachments/upload-url \
  -H 'Content-Type: application/json' \
  -d '{"filename":"photo.jpg","mimeType":"image/jpeg","sizeBytes":204800}'

# 6. Upload file bytes to the returned uploadUrl
curl -X PUT http://localhost:3000/attachments/<attachId>/upload \
  --data-binary @photo.jpg -H 'Content-Type: application/octet-stream'

# 7. Send message with attachment
curl -X POST http://localhost:3000/messages \
  -H 'Content-Type: application/json' \
  -d '{"conversationId":"<convId>","senderId":"<aliceId>","text":"See photo!","attachmentId":"<attachId>"}'
```

---

## Run Tests

```bash
npm test
```

The integration test suite covers:
- Full user → conversation → message → history → status flow
- Error handling (empty name, no text/attachment, unknown conversation)
- Complete Variant 7 attachment lifecycle (slot → upload → SAFE → send)
- Rejection of messages with PENDING (unscanned) attachments

---

## Implemented Features

- ✅ Message persistence (SQLite, survives restarts)
- ✅ Unique `messageId`, `senderId`, `timestamp` on every message
- ✅ Error handling (user not found, empty message, invalid conversation, non-participant sender)
- ✅ Modular code structure (`models / services / storage / api / tests`)
- ✅ HTTP API (Fastify)
- ✅ Postman collection with auto-saved variables and test scripts
- ✅ Integration test (Vitest)
- ✅ **Variant 7**: Upload slot, simulated virus scan, presigned download URL, attachment lifecycle

---

## Architecture (from Lab 1)

```
Client → HTTP API → Message Service → SQLite DB
                 → Attachment Service → Local FS (simulates S3)
                                     → Virus Scanner (simulated: always SAFE)
```

The `Attachment` state machine:
```
PENDING → SAFE → (available for download)
        → QUARANTINED → (blocked)
```
