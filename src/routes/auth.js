import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../db/database.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Credenziali mancanti' });

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: 'Credenziali errate' });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'flightops-secret-dev-2024',
      { expiresIn: '12h' }
    );

    db.prepare('UPDATE users SET is_online = 1, last_seen = datetime(\'now\') WHERE id = ?').run(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        isBcuActive: user.is_bcu_active === 1,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Errore server' });
  }
});

router.post('/logout', (req, res) => {
  const { userId } = req.body;
  if (userId) {
    db.prepare('UPDATE users SET is_online = 0, last_seen = datetime(\'now\') WHERE id = ?').run(userId);
  }
  res.json({ ok: true });
});

export default router;