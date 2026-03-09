import { buildApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = buildApp();

try {
  const address = await app.listen({ port: PORT, host: HOST });
  console.log(`\n🚀 Messenger API running at ${address}`);
  console.log(`   GET  ${address}/health`);
  console.log(`   POST ${address}/users`);
  console.log(`   POST ${address}/conversations`);
  console.log(`   POST ${address}/messages`);
  console.log(`   POST ${address}/attachments/upload-url\n`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
