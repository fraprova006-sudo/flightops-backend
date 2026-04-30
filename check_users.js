import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcrypt';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '../../../flightops.db'));

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      is_bcu_active INTEGER DEFAULT 0,
      is_online INTEGER DEFAULT 0,
      last_seen TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  console.log('Table created');
} catch (e) {
  console.error('Error creating table:', e);
}

const esistono = db.prepare('SELECT COUNT(*) as n FROM users').get();
console.log('Users count:', esistono.n);
if (esistono.n === 0) {
  const hash = bcrypt.hashSync('password', 10);
  const inserisci = db.prepare(`
    INSERT INTO users (id, username, password_hash, full_name, role)
    VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)
  `);
  inserisci.run('cos1', hash, 'Mario Rossi', 'COS');
  inserisci.run('gate1', hash, 'Luigi Bianchi', 'Gate Agent');
  inserisci.run('rampa1', hash, 'Anna Verdi', 'Rampa');
  inserisci.run('checkin1', hash, 'Sara Neri', 'Check-in');
  console.log('✅ Utenti di test creati (password: password)');
}

const users = db.prepare('SELECT id, username, full_name, role FROM users').all();
console.log('Users:', users);

db.close();