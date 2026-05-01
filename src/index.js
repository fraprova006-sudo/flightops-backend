import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import flightRoutes from './routes/flights.js';
import chatRoutes from './routes/chat.js';
import { setupSocketHandlers } from './socket/handlers.js';
import { authenticateToken } from './middleware/auth.js';
import './db/database.js';
import assignmentRoutes, { setIo } from './routes/assignments.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || '*';

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(helmet());
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/flights', authenticateToken, flightRoutes);
app.use('/api/chat', authenticateToken, chatRoutes);
app.use('/api/assignments', authenticateToken, assignmentRoutes);
app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.post('/api/seed', async (req, res) => {
  const { default: db, newId, save } = await import('./db/database.js');
  const today = new Date().toISOString().split('T')[0];
  const voli = [
    { id: newId(), flight_number: 'FR 1234', airline_code: 'FR', flight_type: 'DEP', origin_destination: 'Londra Stansted', scheduled_time: `${today}T06:35:00`, stand: '7', gate: 'B3', aircraft_type: 'B738', pax_count: 189, status: 'boarding', flight_date: today, delay_minutes: 0, estimated_time: null, actual_time: null, created_at: new Date().toISOString() },
    { id: newId(), flight_number: 'AZ 0203', airline_code: 'AZ', flight_type: 'ARR', origin_destination: 'Roma Fiumicino', scheduled_time: `${today}T07:50:00`, stand: '3', gate: 'A1', aircraft_type: 'A320', pax_count: 156, status: 'arrived', flight_date: today, delay_minutes: 0, estimated_time: null, actual_time: null, created_at: new Date().toISOString() },
    { id: newId(), flight_number: 'EI 0718', airline_code: 'EI', flight_type: 'DEP', origin_destination: 'Dublino', scheduled_time: `${today}T10:10:00`, stand: '11', gate: 'C2', aircraft_type: 'A319', pax_count: 143, status: 'scheduled', flight_date: today, delay_minutes: 0, estimated_time: null, actual_time: null, created_at: new Date().toISOString() },
    { id: newId(), flight_number: 'W6 2241', airline_code: 'W6', flight_type: 'DEP', origin_destination: 'Cracovia', scheduled_time: `${today}T14:25:00`, stand: '9', gate: 'B1', aircraft_type: 'A320', pax_count: 164, status: 'scheduled', flight_date: today, delay_minutes: 15, estimated_time: null, actual_time: null, created_at: new Date().toISOString() },
    { id: newId(), flight_number: 'VY 6201', airline_code: 'VY', flight_type: 'ARR', origin_destination: 'Barcellona', scheduled_time: `${today}T16:40:00`, stand: '5', gate: 'A2', aircraft_type: 'A320', pax_count: 178, status: 'scheduled', flight_date: today, delay_minutes: 0, estimated_time: null, actual_time: null, created_at: new Date().toISOString() },
  ];
  voli.forEach(v => { if (!db.data.flights.find(f => f.flight_number === v.flight_number && f.flight_date === today)) db.data.flights.push(v); });
  await save();
  res.json({ ok: true, count: db.data.flights.length });
});

setupSocketHandlers(io);
setIo(io);

export { io };

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`FlightOps backend avviato su http://localhost:${PORT}`));
