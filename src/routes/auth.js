import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db, { save } from '../db/database.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Credenziali mancanti' });
  try {
    const user = db.data.users.find(u => u.username === username);
    if (!user || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: 'Credenziali errate' });
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'flightops-segreto-lunghissimo-2024',
      { expiresIn: '12h' }
    );
    user.is_online = 1;
    user.last_seen = new Date().toISOString();
    await save();
    res.json({
      token,
      user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role, isBcuActive: user.is_bcu_active === 1 },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore server' });
  }
});

router.post('/logout', async (req, res) => {
  const { userId } = req.body;
  if (userId) {
    const user = db.data.users.find(u => u.id === userId);
    if (user) { user.is_online = 0; user.last_seen = new Date().toISOString(); await save(); }
  }
  res.json({ ok: true });
});

router.get('/users', (req, res) => {
  const users = db.data.users.map(u => ({ id: u.id, username: u.username, full_name: u.full_name, role: u.role }));
  res.json(users);
});

export default router;
