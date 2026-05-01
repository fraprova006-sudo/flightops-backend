import { Router } from 'express';
import db, { newId, save } from '../db/database.js';

const router = Router();
const SUPERVISOR_ROLES = ['COS', 'Responsabile', 'RIT Landside', 'RIT Airside'];

function canAccessFlight(userId, role, flightId) {
  if (SUPERVISOR_ROLES.includes(role)) return true;
  return db.data.flight_assignments.some(
    a => a.flight_id === flightId && a.user_id === userId
  );
}

router.get('/:flightId', (req, res) => {
  if (!canAccessFlight(req.user.id, req.user.role, req.params.flightId))
    return res.status(403).json({ error: 'Accesso negato' });

  const messages = db.data.chat_messages
    .filter(m => m.flight_id === req.params.flightId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(m => {
      const user = db.data.users.find(u => u.id === m.sender_id);
      return { ...m, sender_name: user?.full_name, sender_role: user?.role };
    });

  res.json(messages);
});

router.get('/:flightId/timeline', (req, res) => {
  if (!canAccessFlight(req.user.id, req.user.role, req.params.flightId))
    return res.status(403).json({ error: 'Accesso negato' });

  const events = db.data.timeline_events
    .filter(e => e.flight_id === req.params.flightId)
    .sort((a, b) => a.triggered_at.localeCompare(b.triggered_at));

  res.json(events);
});

router.get('/notifications/:userId', (req, res) => {
  const notifications = db.data.notifications
    .filter(n => n.user_id === req.params.userId && n.is_read === 0)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  res.json(notifications);
});

router.patch('/notifications/:id/read', async (req, res) => {
  const notif = db.data.notifications.find(n => n.id === req.params.id);
  if (notif) { notif.is_read = 1; await save(); }
  res.json({ ok: true });
});

export default router;
