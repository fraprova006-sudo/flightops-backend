import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

const SUPERVISOR_ROLES = ['COS', 'Responsabile', 'RIT Landside', 'RIT Airside'];

function canAccessFlight(userId, role, flightId) {
  if (SUPERVISOR_ROLES.includes(role)) return true;
  const assignment = db.prepare(
    'SELECT id FROM flight_assignments WHERE flight_id = ? AND user_id = ?'
  ).get(flightId, userId);
  return !!assignment;
}

router.get('/:flightId', (req, res) => {
  if (!canAccessFlight(req.user.id, req.user.role, req.params.flightId))
    return res.status(403).json({ error: 'Accesso negato' });

  const messages = db.prepare(`
    SELECT m.*, u.full_name as sender_name, u.role as sender_role
    FROM chat_messages m
    LEFT JOIN users u ON u.id = m.sender_id
    WHERE m.flight_id = ?
    ORDER BY m.created_at ASC
  `).all(req.params.flightId);

  res.json(messages);
});

router.get('/:flightId/timeline', (req, res) => {
  if (!canAccessFlight(req.user.id, req.user.role, req.params.flightId))
    return res.status(403).json({ error: 'Accesso negato' });

  const events = db.prepare(`
    SELECT * FROM timeline_events
    WHERE flight_id = ?
    ORDER BY triggered_at ASC
  `).all(req.params.flightId);

  res.json(events);
});

router.get('/notifications/:userId', (req, res) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ? AND is_read = 0
    ORDER BY created_at DESC
  `).all(req.params.userId);
  res.json(notifications);
});

router.patch('/notifications/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;