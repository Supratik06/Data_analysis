import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, 'database.sqlite');

let db = null;

export async function getDb() {
  if (db) return db;

  // Open database connection
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.run('PRAGMA foreign_keys = ON;');

  // Initialize tables from schema.sql
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  // SQLite executes multiple statements using exec()
  await db.exec(schema);

  // Seed default users if empty
  const userCount = await db.get('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    console.log('Seeding default users and groups...');
    const defaultPassword = 'password123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(defaultPassword, salt);

    const members = [
      { name: 'Aisha', email: 'aisha@example.com' },
      { name: 'Rohan', email: 'rohan@example.com' },
      { name: 'Priya', email: 'priya@example.com' },
      { name: 'Meera', email: 'meera@example.com' },
      { name: 'Sam', email: 'sam@example.com' },
      { name: 'Dev', email: 'dev@example.com' },
      { name: 'Kabir', email: 'kabir@example.com' }
    ];

    const userMap = {};
    for (const member of members) {
      const result = await db.run(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
        [member.name, member.email, hash]
      );
      userMap[member.name] = result.lastID;
    }

    // Seed default Group: "Flatmates"
    const groupResult = await db.run(
      'INSERT INTO groups (name, description) VALUES (?, ?)',
      ['Flatmates', 'Shared household expenses and trips']
    );
    const groupId = groupResult.lastID;

    // Seed group memberships matching their real timelines
    const memberships = [
      { name: 'Aisha', joined: '2026-02-01', left: null },
      { name: 'Rohan', joined: '2026-02-01', left: null },
      { name: 'Priya', joined: '2026-02-01', left: null },
      { name: 'Meera', joined: '2026-02-01', left: '2026-03-31' },
      { name: 'Sam', joined: '2026-04-15', left: null },
      { name: 'Dev', joined: '2026-02-01', left: null },
      { name: 'Kabir', joined: '2026-03-11', left: '2026-03-12' } // Dev's friend Kabir joined just for the parasailing day
    ];

    for (const membership of memberships) {
      await db.run(
        'INSERT INTO group_memberships (group_id, user_id, joined_at, left_at) VALUES (?, ?, ?, ?)',
        [groupId, userMap[membership.name], membership.joined, membership.left]
      );
    }
    console.log('Database seeded successfully!');
  }

  return db;
}
