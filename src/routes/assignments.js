import { Router } from 'express';
import db, { newId, save } from '../db/database.js';

const router = Router();
const SUPERVISOR_ROLES = ['COS', 'Responsabile', 'RIT Landside', 'RIT Airside'];

let io = null;
export const setIo = (ioInstance) => { io = ioInstance; };

router.post('/', async (req, res) => {
  if (!SUPERVISOR_ROLES.includes(req.user.role))
    return res.status(403).json({ error: 'Solo i supervisori possono assegnare' });

  const { flightId, userId, roleAssigned } = req.body;

  try {
    const existing = db.data.flight_assignments.find(
      a => a.flight_id === flightId && a.role_assigned === roleAssigned
    );

    if (existing) {
      existing.user_id = userId;
      existing.assigned_by = req.user.id;
      existing.assigned_at = new Date().toISOString();
    } else {
      db.data.flight_assignments.push({
        id: newId(),
        flight_id: flightId,
        user_id: userId,
        role_assigned: roleAssigned,
        assigned_by: req.user.id,
        assigned_at: new Date().toISOString(),
        notified: 0,
      });
    }

    const flight = db.data.flights.find(f => f.id === flightId);

    db.data.notifications.push({
      id: newId(),
      user_id: userId,
      type: 'assignment',
      title: `Assegnato: ${flight.flight_number}`,
      body: `Sei stato assegnato come ${roleAssigned} per il volo ${flight.flight_number} - ${flight.origin_destination}`,
      flight_id: flightId,
      is_read: 0,
      created_at: new Date().toISOString(),
    });

    db.data.global_log.push({
      event_type: 'assignment',
      actor_id: req.user.id,
      flight_id: flightId,
      payload: JSON.stringify({ userId, roleAssigned }),
      created_at: new Date().toISOString(),
    });

    await save();

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
  const assignments = db.data.flight_assignments
    .filter(a => a.flight_id === req.params.flightId)
    .map(a => {
      const user = db.data.users.find(u => u.id === a.user_id);
      return { ...a, full_name: user?.full_name, username: user?.username, role: user?.role };
    });
  res.json(assignments);
});

export default router;
