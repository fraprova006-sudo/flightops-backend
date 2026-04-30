import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

const SUPERVISOR_ROLES = ['COS', 'Responsabile', 'RIT Landside', 'RIT Airside'];

router.get('/', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const flights = db.prepare(`
      SELECT * FROM flights WHERE flight_date = ? ORDER BY scheduled_time ASC
    `).all(date);

    const result = flights.map(flight => {
      const assignments = db.prepare(`
        SELECT fa.role_assigned, u.id, u.full_name, u.username, u.role
        FROM flight_assignments fa
        JOIN users u ON u.id = fa.user_id
        WHERE fa.flight_id = ?
      `).all(flight.id);

      const assignmentsMap = {};
      assignments.forEach(a => {
        assignmentsMap[a.role_assigned] = {
          userId: a.id,
          fullName: a.full_name,
          username: a.username,
          role: a.role,
        };
      });

      return { ...flight, assignments: assignmentsMap };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore DB' });
  }
});

router.get('/:id', (req, res) => {
  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(req.params.id);
  if (!flight) return res.status(404).json({ error: 'Volo non trovato' });
  res.json(flight);
});

router.post('/', (req, res) => {
  if (!SUPERVISOR_ROLES.includes(req.user.role))
    return res.status(403).json({ error: 'Permesso negato' });

  const {
    flightNumber, airlineCode, flightType, originDestination,
    scheduledTime, stand, gate, aircraftType, paxCount, flightDate
  } = req.body;

  try {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    db.prepare(`
      INSERT INTO flights 
        (id, flight_number, airline_code, flight_type, origin_destination,
         scheduled_time, stand, gate, aircraft_type, pax_count, flight_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, flightNumber, airlineCode, flightType, originDestination,
           scheduledTime, stand, gate, aircraftType, paxCount,
           flightDate || new Date().toISOString().split('T')[0]);

    const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(id);
    res.status(201).json(flight);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore creazione volo' });
  }
});

router.patch('/:id', (req, res) => {
  if (!SUPERVISOR_ROLES.includes(req.user.role))
    return res.status(403).json({ error: 'Permesso negato' });

  const allowed = ['status', 'delay_minutes', 'estimated_time', 'gate', 'stand', 'actual_time'];
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (!updates.length) return res.status(400).json({ error: 'Nessun campo valido' });

  const setClause = updates.map(([k]) => `${k} = ?`).join(', ');
  const values = updates.map(([, v]) => v);

  db.prepare(`UPDATE flights SET ${setClause} WHERE id = ?`).run(...values, req.params.id);
  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(req.params.id);
  res.json(flight);
});

export default router;