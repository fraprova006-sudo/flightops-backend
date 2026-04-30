-- schema.sql

-- UTENTI
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL,
  is_bcu_active BOOLEAN DEFAULT FALSE,   -- solo Capisquadra
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VOLI
CREATE TABLE flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_number VARCHAR(20) NOT NULL,
  airline_code VARCHAR(5) NOT NULL,
  flight_type VARCHAR(3) NOT NULL CHECK (flight_type IN ('ARR','DEP')),
  origin_destination VARCHAR(100) NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  estimated_time TIMESTAMPTZ,
  actual_time TIMESTAMPTZ,
  delay_minutes INTEGER DEFAULT 0,
  stand VARCHAR(10),
  gate VARCHAR(10),
  aircraft_type VARCHAR(20),
  pax_count INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'scheduled',
  -- status: scheduled | boarding | departed | arrived | cancelled | diverted
  flight_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ASSEGNAZIONI STAFF AI VOLI
CREATE TABLE flight_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id UUID REFERENCES flights(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  role_assigned VARCHAR(50) NOT NULL,   -- gate_agent | rampa | checkin
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  notified BOOLEAN DEFAULT FALSE,
  UNIQUE(flight_id, role_assigned)
);

-- CHAT MESSAGGI
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id UUID REFERENCES flights(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id),
  message_type VARCHAR(20) DEFAULT 'text',   -- text | system | voice
  content TEXT NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_chat_flight ON chat_messages(flight_id, created_at);

-- TIMELINE EVENTI
CREATE TABLE timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id UUID REFERENCES flights(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  -- es: preboarding_start | boarding_start | boarding_end | fuel_start | ...
  triggered_by UUID REFERENCES users(id),
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);
CREATE INDEX idx_timeline_flight ON timeline_events(flight_id);

-- NOTIFICHE
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(30) NOT NULL,   -- assignment | system | emergency
  title VARCHAR(100),
  body TEXT,
  flight_id UUID REFERENCES flights(id),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notif_user ON notifications(user_id, is_read);

-- LOG GLOBALE IMMUTABILE (append-only)
CREATE TABLE global_log (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50),
  actor_id UUID REFERENCES users(id),
  flight_id UUID REFERENCES flights(id),
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- NO UPDATE, NO DELETE su questa tabella (policy applicata via trigger)

CREATE OR REPLACE FUNCTION prevent_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Global log is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_global_log
  BEFORE UPDATE OR DELETE ON global_log
  FOR EACH ROW EXECUTE FUNCTION prevent_log_modification();