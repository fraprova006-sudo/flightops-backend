import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcrypt';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '../../../flightops.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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

  CREATE TABLE IF NOT EXISTS flights (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    flight_number TEXT NOT NULL,
    airline_code TEXT NOT NULL,
    flight_type TEXT NOT NULL,
    origin_destination TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    estimated_time TEXT,
    actual_time TEXT,
    delay_minutes INTEGER DEFAULT 0,
    stand TEXT,
    gate TEXT,
    aircraft_type TEXT,
    pax_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'scheduled',
    flight_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS flight_assignments (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    flight_id TEXT REFERENCES flights(id),
    user_id TEXT REFERENCES users(id),
    role_assigned TEXT NOT NULL,
    assigned_by TEXT REFERENCES users(id),
    assigned_at TEXT DEFAULT (datetime('now')),
    notified INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    flight_id TEXT REFERENCES flights(id),
    sender_id TEXT REFERENCES users(id),
    message_type TEXT DEFAULT 'text',
    content TEXT NOT NULL,
    is_system INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS timeline_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    flight_id TEXT REFERENCES flights(id),
    event_type TEXT NOT NULL,
    triggered_by TEXT REFERENCES users(id),
    triggered_at TEXT DEFAULT (datetime('now')),
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT REFERENCES users(id),
    type TEXT NOT NULL,
    title TEXT,
    body TEXT,
    flight_id TEXT REFERENCES flights(id),
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS global_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT,
    actor_id TEXT REFERENCES users(id),
    flight_id TEXT REFERENCES flights(id),
    payload TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Crea utenti di test se non esistono
const esistono = db.prepare('SELECT COUNT(*) as n FROM users').get();
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

export default db;