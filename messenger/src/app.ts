import Fastify from 'fastify';
import { registerRoutes } from './api/routes.js';
import type { Db } from './storage/database.js';
import { createDb } from './storage/database.js';

export function buildApp(db?: Db) {
  const app = Fastify({ logger: false });

  const database = db ?? createDb();
  registerRoutes(app, database);

  return app;
}
