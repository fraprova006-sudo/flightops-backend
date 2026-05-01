import { Router } from 'express';
import db, { newId, save } from '../db/database.js';

const router = Router();
const SUPERVISOR_ROLES = ['COS', 'Responsabile', 'RIT Landside', 'RIT Airside'];

// Seed pubblico (senza auth)
router.post('/seed', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const voli = [
      { id: newId(), flight_number: 'FR 1234', airline_code: 'FR', flight_type: 'DEP', origin_destination: 'Londra Stansted', scheduled_time: `${today}T06:35:00`, stand: '7', gate: 'B3', aircraft_type: 'B738', pax_count: 189, status: 'boarding', flight_date: today, delay_minutes: 0, estimated_time: null, actual_time: null, created_at: new Date().toISOString() },
      { id: newId(), flight_number: 'AZ 0203', airline_code: 'AZ', flight_type: 'ARR', origin_destination: 'Roma Fiumicino', scheduled_time: `${today}T07:50:00`, stand: '3', gate: 'A1', aircraft_type: 'A320', pax_count: 156, status: 'arrived', flight_date: today, delay_minutes: 0, estimated_time: null, actual_time: null, created_at: new Date().toISOString() },
      { id: newId(), flight_number: 'EI 0718', airline_code: 'EI', flight_type: 'DEP', origin_destination: 'Dublino', scheduled_time: `${today}T10:10:00`, stand: '11', gate: 'C2', aircraft_type: 'A319', pax_count: 143, status: 'scheduled', flight_date: today, delay_minutes: 0, estimated_time: null, actual_time: null, created_at: new Date().toISOString() },
      { id: newId(), flight_number: 'W6 2241', airline_code: 'W6', flight_type: 'DEP', origin_destination: 'Cracovia', scheduled_time: `${today}T14:25:00`, stand: '9', gate: 'B1', aircraft_type: 'A320', pax_count: 164, status: 'scheduled', flight_date: today, delay_minutes: 15, estimated_time: null, actual_time: null, created_at: new Date().toISOString() },
      { id: newId(), flight_number: 'VY 6201', airline_code: 'VY', flight_type: 'ARR', origin_destination: 'Barcellona', scheduled_time: `${today}T16:40:00`, stand: '5', gate: 'A2', aircraft_type: 'A320', pax_count: 178, status: 'scheduled', flight_date: today, delay_minutes: 0, estimated_time: null, actual_time: null, created_at: new Date().toISOString() },
    ];
    voli.forEach(v => {
      if (!db.data.flights.find(f => f.flight_number === v.flight_number && f.flight_date === today))
        db.data.flights.push(v);
    });
    await save();
    res.json({ ok: true, count: db.data.flights.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore seed' });
  }
});

// GET tutti i voli del giorno
router.get('/', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const flights = db.data.flights
      .filter(f => f.flight_date === date)
      .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));

    const result = flights.map(flight => {
      const assignments = db.data.flight_assignments.filter(a => a.flight_id === flight.id);
      const assignmentsMap = {};
      assignments.forEach(a => {
        const user = db.data.users.find(u => u.id === a.user_id);
        if (user) {
          assignmentsMap[a.role_assigned] = {
            userId: user.id,
            fullName: user.full_name,
            username: user.username,
            role: user.role,
          };
        }
      });
      return { ...flight, assignments: assignmentsMap };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore DB' });
  }
});

// GET singolo volo
router.get('/:id', (req, res) => {
  const flight = db.data.flights.find(f => f.id === req.params.id);
  if (!flight) return res.status(404).json({ error: 'Volo non trovato' });
  res.json(flight);
});

// POST nuovo volo
router.post('/', async (req, res) => {
  if (!SUPERVISOR_ROLES.includes(req.user.role))
    return res.status(403).json({ error: 'Permesso negato' });

  const { flightNumber, airlineCode, flightType, originDestination, scheduledTime, stand, gate, aircraftType, paxCount, flightDate } = req.body;

  try {
    const flight = {
      id: newId(),
      flight_number: flightNumber,
      airline_code: airlineCode,
      flight_type: flightType,
      origin_destination: originDestination,
      scheduled_time: scheduledTime,
      estimated_time: null,
      actual_time: null,
      delay_minutes: 0,
      stand: stand || null,
      gate: gate || null,
      aircraft_type: aircraftType || null,
      pax_count: paxCount || 0,
      status: 'scheduled',
      flight_date: flightDate || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };
    db.data.flights.push(flight);
    await save();
    res.status(201).json(flight);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore creazione volo' });
  }
});

// PATCH aggiorna volo
router.patch('/:id', async (req, res) => {
  if (!SUPERVISOR_ROLES.includes(req.user.role))
    return res.status(403).json({ error: 'Permesso negato' });

  const allowed = ['status', 'delay_minutes', 'estimated_time', 'gate', 'stand', 'actual_time'];
  const flight = db.data.flights.find(f => f.id === req.params.id);
  if (!flight) return res.status(404).json({ error: 'Volo non trovato' });

  Object.entries(req.body).forEach(([k, v]) => { if (allowed.includes(k)) flight[k] = v; });
  await save();
  res.json(flight);
});

export default router;
