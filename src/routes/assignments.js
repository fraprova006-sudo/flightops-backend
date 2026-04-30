import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

const SUPERVISOR_ROLES = ['COS', 'Responsabile', 'RIT Landside', 'RIT Airside'];

let io = null;
export const setIo = (ioInstance) => { io = ioInstance; };

router.post('/', (req, res) => {
  if (!SUPERVISOR_ROLES.includes(req.user.role))
    return res.status(403).json({ error: 'Solo i supervisori possono assegnare' });

  const { flightId, userId, roleAssigned } = req.body;

  try {
    const existing = db.prepare(
      'SELECT id FROM flight_assignments WHERE flight_id = ? AND role_assigned = ?'
    ).get(flightId, roleAssigned);

    if (existing) {
      db.prepare(
        'UPDATE flight_assignments SET user_id = ?, assigned_by = ?, assigned_at = datetime("now") WHERE id = ?'
      ).run(userId, req.user.id, existing.id);
    } else {
      const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      db.prepare(`
        INSERT INTO flight_assignments (id, flight_id, user_id, role_assigned, assigned_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, flightId, userId, roleAssigned, req.user.id);
    }

    const flight = db.prepare(
      'SELECT flight_number, origin_destination, gate FROM flights WHERE id = ?'
    ).get(flightId);

    const notifId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, body, flight_id)
      VALUES (?, ?, 'assignment', ?, ?, ?)
    `).run(
      notifId, userId,
      `Assegnato: ${flight.flight_number}`,
      `Sei stato assegnato come ${roleAssigned} per il volo ${flight.flight_number} - ${flight.origin_destination}`,
      flightId
    );

    db.prepare(`
      INSERT INTO global_log (event_type, actor_id, flight_id, payload)
      VALUES ('assignment', ?, ?, ?)
    `).run(req.user.id, flightId, JSON.stringify({ userId, roleAssigned }));

    if (io) {
      io.to(`user:${userId}`).emit('notification:assignment', {
        flightId,
        flightNumber: flight.flight_number,
        roleAssigned,
        gate: flight.gate,
      });
      io.emit('flight:updated', { flightId });
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore assegnazione' });
  }
});

router.get('/flight/:flightId', (req, res) => {
  const assignments = db.prepare(`
    SELECT fa.*, u.full_name, u.username, u.role
    FROM flight_assignments fa
    JOIN users u ON u.id = fa.user_id
    WHERE fa.flight_id = ?
  `).all(req.params.flightId);
  res.json(assignments);
});

export default router;