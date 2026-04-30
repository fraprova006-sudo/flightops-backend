import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Su Railway il filesystem è temporaneo, usiamo /tmp
const file = process.env.RAILWAY_ENVIRONMENT
  ? '/tmp/flightops-db.json'
  : join(__dirname, '../../../flightops-db.json');

const adapter = new JSONFile(file);
const db = new Low(adapter, {
  users: [],
  flights: [],
  flight_assignments: [],
  chat_messages: [],
  timeline_events: [],
  notifications: [],
  global_log: [],
});

await db.read();

// Inizializza con utenti di test se vuoto
if (db.data.users.length === 0) {
  const hash = bcrypt.hashSync('password', 10);
  const newId = () => randomBytes(8).toString('hex');

  db.data.users.push(
    { id: newId(), username: 'cos1',     password_hash: hash, full_name: 'Mario Rossi',   role: 'COS',          is_bcu_active: 0, is_online: 0, created_at: new Date().toISOString() },
    { id: newId(), username: 'gate1',    password_hash: hash, full_name: 'Luigi Bianchi',  role: 'Gate Agent',   is_bcu_active: 0, is_online: 0, created_at: new Date().toISOString() },
    { id: newId(), username: 'rampa1',   password_hash: hash, full_name: 'Anna Verdi',     role: 'Rampa',        is_bcu_active: 0, is_online: 0, created_at: new Date().toISOString() },
    { id: newId(), username: 'checkin1', password_hash: hash, full_name: 'Sara Neri',      role: 'Check-in',     is_bcu_active: 0, is_online: 0, created_at: new Date().toISOString() },
    { id: newId(), username: 'resp1',    password_hash: hash, full_name: 'Carlo Blu',      role: 'Responsabile', is_bcu_active: 0, is_online: 0, created_at: new Date().toISOString() },
  );
  await db.write();
  console.log('  Utenti di test creati (password: password)');
}

export const newId = () => randomBytes(8).toString('hex');
export const save = () => db.write();
export default db;