import jwt from 'jsonwebtoken';
import db from '../db/database.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token mancante' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'flightops-secret-dev-2024');
    const user = db.prepare(
      'SELECT id, username, full_name, role, is_bcu_active FROM users WHERE id = ?'
    ).get(payload.userId);
    if (!user) return res.status(401).json({ error: 'Utente non trovato' });
    req.user = user;
    next();
  } catch {
    res.status(403).json({ error: 'Token non valido' });
  }
};

export const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ error: 'Permesso negato' });
  next();
};