import { v4 as uuidv4 } from 'uuid';
import type { User } from '../models/types.js';
import type { Db } from '../storage/database.js';

export class UserService {
  constructor(private db: Db) {}

  create(name: string): User {
    if (!name || name.trim() === '') {
      throw new Error('User name must not be empty.');
    }

    const existing = this.db
      .prepare('SELECT id FROM users WHERE name = ?')
      .get(name.trim()) as { id: string } | undefined;

    if (existing) {
      throw new Error(`User with name "${name}" already exists.`);
    }

    const user: User = { id: uuidv4(), name: name.trim() };
    this.db.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run(user.id, user.name);
    return user;
  }

  getById(id: string): User {
    const user = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
    if (!user) throw new Error(`User "${id}" not found.`);
    return user;
  }

  list(): User[] {
    return this.db.prepare('SELECT * FROM users ORDER BY name').all() as User[];
  }
}
