import jwt from 'jsonwebtoken';
import db, { newId, save } from '../db/database.js';

const SUPERVISOR_ROLES = ['COS', 'Responsabile', 'RIT Landside', 'RIT Airside'];

function canAccessFlight(userId, role, flightId) {
  if (SUPERVISOR_ROLES.includes(role)) return true;
  return db.data.flight_assignments.some(
    a => a.flight_id === flightId && a.user_id === userId
  );
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
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'flightops-segreto-lunghissimo-2024');
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

    socket.on('chat:send', async ({ flightId, content, messageType = 'text' }) => {
      if (!canAccessFlight(userId, role, flightId))
        return socket.emit('error', { message: 'Accesso negato' });

      try {
        const user = db.data.users.find(u => u.id === userId);
        const msg = {
          id: newId(),
          flight_id: flightId,
          sender_id: userId,
          content,
          message_type: messageType,
          is_system: 0,
          created_at: new Date().toISOString(),
          sender_name: user?.full_name,
          sender_role: user?.role,
        };
        db.data.chat_messages.push(msg);
        await save();

        // Manda a chi ha la chat aperta
        io.to(`flight:${flightId}`).emit('chat:message', msg);

        // Notifica gli operatori assegnati che non sono nella room
        const assignments = db.data.flight_assignments.filter(a => a.flight_id === flightId);
        assignments.forEach(a => {
          if (a.user_id !== userId) {
            io.to(`user:${a.user_id}`).emit('chat:notification', { flightId, msg });
          }
        });

        // Notifica i supervisori
        const supervisors = db.data.users.filter(u => SUPERVISOR_ROLES.includes(u.role) && u.id !== userId);
        supervisors.forEach(s => {
          io.to(`user:${s.id}`).emit('chat:notification', { flightId, msg });
        });

      } catch (err) {
        console.error(err);
        socket.emit('error', { message: 'Errore invio messaggio' });
      }
    });

    socket.on('timeline:event', async ({ flightId, eventType, notes }) => {
      if (!canAccessFlight(userId, role, flightId)) return;

      try {
        db.data.timeline_events.push({
          id: newId(),
          flight_id: flightId,
          event_type: eventType,
          triggered_by: userId,
          triggered_at: new Date().toISOString(),
          notes: notes || null,
        });

        const user = db.data.users.find(u => u.id === userId);
        const msg = {
          id: newId(),
          flight_id: flightId,
          sender_id: userId,
          content: `⏱ ${formatEventLabel(eventType)}`,
          message_type: 'system',
          is_system: 1,
          created_at: new Date().toISOString(),
          sender_name: user?.full_name,
          sender_role: user?.role,
        };
        db.data.chat_messages.push(msg);

        db.data.global_log.push({
          event_type: 'timeline',
          actor_id: userId,
          flight_id: flightId,
          payload: JSON.stringify({ eventType, notes }),
          created_at: new Date().toISOString(),
        });

        await save();

        io.to(`flight:${flightId}`).emit('chat:message', msg);
        io.to(`flight:${flightId}`).emit('timeline:updated', { flightId, eventType });
        io.emit('flight:updated', { flightId });

      } catch (err) {
        console.error(err);
      }
    });

    socket.on('disconnect', async () => {
      const user = db.data.users.find(u => u.id === userId);
      if (user) {
        user.is_online = 0;
        user.last_seen = new Date().toISOString();
        await save();
      }
      console.log(`[Socket] disconnesso: ${userId}`);
    });
  });
};
