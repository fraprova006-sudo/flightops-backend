import jwt from 'jsonwebtoken';
import db from '../db/database.js';

const SUPERVISOR_ROLES = ['COS', 'Responsabile', 'RIT Landside', 'RIT Airside'];

function canAccessFlight(userId, role, flightId) {
  if (SUPERVISOR_ROLES.includes(role)) return true;
  const assignment = db.prepare(
    'SELECT id FROM flight_assignments WHERE flight_id = ? AND user_id = ?'
  ).get(flightId, userId);
  return !!assignment;
}

function formatEventLabel(eventType) {
  const labels = {
    preboarding_start: 'Preimbarco iniziato',
    preboarding_end: 'Preimbarco terminato',
    boarding_start: 'Imbarco iniziato',
    boarding_end: 'Imbarco terminato',
    fuel_start: 'Rifornimento iniziato',
    fuel_end: 'Rifornimento terminato',
    loading_start: 'Loading iniziato',
    loading_end: 'Loading terminato',
    cleaning_start: 'Pulizie iniziate',
    cleaning_end: 'Pulizie terminate',
    prm_start: 'PRM iniziato',
    prm_end: 'PRM terminato',
    prm_ok: 'PRM OK',
    deicing_start: 'De-icing iniziato',
    deicing_end: 'De-icing terminato',
    doors_closed: 'Porte chiuse',
  };
  return labels[eventType] || eventType;
}

export const setupSocketHandlers = (io) => {

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Non autenticato'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'flightops-secret-dev-2024');
      socket.user = payload;
      next();
    } catch {
      next(new Error('Token non valido'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, role } = socket.user;
    console.log(`[Socket] connesso: ${userId} (${role})`);

    socket.join(`user:${userId}`);
    if (SUPERVISOR_ROLES.includes(role)) socket.join('supervisors');

    socket.on('flight:join', ({ flightId }) => {
      if (!canAccessFlight(userId, role, flightId))
        return socket.emit('error', { message: 'Accesso negato' });
      socket.join(`flight:${flightId}`);
      socket.emit('flight:joined', { flightId });
    });

    socket.on('flight:leave', ({ flightId }) => {
      socket.leave(`flight:${flightId}`);
    });

    socket.on('chat:send', ({ flightId, content, messageType = 'text' }) => {
      if (!canAccessFlight(userId, role, flightId))
        return socket.emit('error', { message: 'Accesso negato' });

      try {
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        db.prepare(`
          INSERT INTO chat_messages (id, flight_id, sender_id, content, message_type)
          VALUES (?, ?, ?, ?, ?)
        `).run(id, flightId, userId, content, messageType);

        const user = db.prepare('SELECT full_name, role FROM users WHERE id = ?').get(userId);
        const msg = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id);

        const enrichedMsg = {
          ...msg,
          senderName: user?.full_name,
          senderRole: user?.role,
        };

        io.to(`flight:${flightId}`).emit('chat:message', enrichedMsg);
        io.to('supervisors').emit('chat:message', { ...enrichedMsg, flightId });

      } catch (err) {
        console.error(err);
        socket.emit('error', { message: 'Errore invio messaggio' });
      }
    });

    socket.on('timeline:event', ({ flightId, eventType, notes }) => {
      if (!canAccessFlight(userId, role, flightId)) return;

      try {
        const evId = Math.random().toString(36).slice(2) + Date.now().toString(36);
        db.prepare(`
          INSERT INTO timeline_events (id, flight_id, event_type, triggered_by, notes)
          VALUES (?, ?, ?, ?, ?)
        `).run(evId, flightId, eventType, userId, notes || null);

        const msgId = Math.random().toString(36).slice(2) + Date.now().toString(36);
        db.prepare(`
          INSERT INTO chat_messages (id, flight_id, sender_id, content, message_type, is_system)
          VALUES (?, ?, ?, ?, 'system', 1)
        `).run(msgId, flightId, userId, `⏱ ${formatEventLabel(eventType)}`);

        db.prepare(`
          INSERT INTO global_log (event_type, actor_id, flight_id, payload)
          VALUES ('timeline', ?, ?, ?)
        `).run(userId, flightId, JSON.stringify({ eventType, notes }));

        const msg = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(msgId);

        io.to(`flight:${flightId}`).emit('chat:message', msg);
        io.to(`flight:${flightId}`).emit('timeline:updated', { flightId, eventType });
        io.emit('flight:updated', { flightId });

      } catch (err) {
        console.error(err);
      }
    });

    socket.on('disconnect', () => {
      db.prepare('UPDATE users SET is_online = 0, last_seen = datetime("now") WHERE id = ?').run(userId);
      console.log(`[Socket] disconnesso: ${userId}`);
    });
  });
};