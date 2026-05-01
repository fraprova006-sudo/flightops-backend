import { Router } from 'express';
import db from '../db/database.js';
import { newId, save } from '../db/database.js';

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

router.post('/seed', async (req, res) => {

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

// Route per aggiungere voli di test

  try {
    const today = new Date().toISOString().split('T')[0];
    const voli = [
      { id: newId(), flight_number: 'FR 1234', airline_code: 'FR', flight_type: 'DEP', origin_destination: 'Londra Stansted', scheduled_time: `${today}T06:35:00`, stand: '7', gate: 'B3', aircraft_type: 'B738', pax_count: 189, status: 'boarding', flight_date: today, delay_minutes: 0, created_at: new Date().toISOString() },
      { id: newId(), flight_number: 'AZ 0203', airline_code: 'AZ', flight_type: 'ARR', origin_destination: 'Roma Fiumicino', scheduled_time: `${today}T07:50:00`, stand: '3', gate: 'A1', aircraft_type: 'A320', pax_count: 156, status: 'arrived', flight_date: today, delay_minutes: 0, created_at: new Date().toISOString() },
      { id: newId(), flight_number: 'EI 0718', airline_code: 'EI', flight_type: 'DEP', origin_destination: 'Dublino', scheduled_time: `${today}T10:10:00`, stand: '11', gate: 'C2', aircraft_type: 'A319', pax_count: 143, status: 'scheduled', flight_date: today, delay_minutes: 0, created_at: new Date().toISOString() },
      { id: newId(), flight_number: 'W6 2241', airline_code: 'W6', flight_type: 'DEP', origin_destination: 'Cracovia', scheduled_time: `${today}T14:25:00`, stand: '9', gate: 'B1', aircraft_type: 'A320', pax_count: 164, status: 'scheduled', flight_date: today, delay_minutes: 15, created_at: new Date().toISOString() },
      { id: newId(), flight_number: 'VY 6201', airline_code: 'VY', flight_type: 'ARR', origin_destination: 'Barcellona', scheduled_time: `${today}T16:40:00`, stand: '5', gate: 'A2', aircraft_type: 'A320', pax_count: 178, status: 'scheduled', flight_date: today, delay_minutes: 0, created_at: new Date().toISOString() },
    ];

    voli.forEach(v => {
      const exists = db.data.flights.find(f => f.flight_number === v.flight_number && f.flight_date === today);
      if (!exists) db.data.flights.push(v);
    });
    await save();
    res.json({ ok: true, count: voli.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore seed' });
  }
});

export default router;