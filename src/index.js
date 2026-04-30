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

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(helmet());
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/flights', authenticateToken, flightRoutes);
app.use('/api/chat', authenticateToken, chatRoutes);
app.use('/api/assignments', authenticateToken, assignmentRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

setupSocketHandlers(io);

setIo(io);

export { io };

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`✅ FlightOps backend avviato su http://localhost:${PORT}`));