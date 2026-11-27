CREATE TABLE simulation_sessions (
  id text PRIMARY KEY,
  vehicle_profile_id text NOT NULL,
  scenario_id text NOT NULL,
  seed integer NOT NULL CHECK (seed BETWEEN 0 AND 2147483647),
  catalog_version text NOT NULL,
  current_tick integer NOT NULL DEFAULT 0 CHECK (current_tick >= 0),
  session_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE session_snapshots (
  session_id text NOT NULL REFERENCES simulation_sessions(id) ON DELETE CASCADE,
  tick integer NOT NULL CHECK (tick >= 0),
  snapshot jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, tick)
);

CREATE TABLE telemetry_readings (
  session_id text NOT NULL,
  tick integer NOT NULL,
  signal_id text NOT NULL,
  value jsonb NOT NULL,
  PRIMARY KEY (session_id, tick, signal_id),
  FOREIGN KEY (session_id, tick) REFERENCES session_snapshots(session_id, tick) ON DELETE CASCADE
);

CREATE TABLE session_events (
  session_id text NOT NULL REFERENCES simulation_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  first_tick integer NOT NULL CHECK (first_tick >= 0),
  PRIMARY KEY (session_id, event_type)
);

CREATE TABLE indicator_states (
  session_id text NOT NULL,
  tick integer NOT NULL,
  indicator_id text NOT NULL,
  rule_id text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('warning', 'critical')),
  status text NOT NULL CHECK (status IN ('active', 'clear')),
  explanation text NOT NULL,
  PRIMARY KEY (session_id, tick, indicator_id),
  FOREIGN KEY (session_id, tick) REFERENCES session_snapshots(session_id, tick) ON DELETE CASCADE
);

CREATE TABLE reports (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES simulation_sessions(id) ON DELETE CASCADE,
  tick integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX session_snapshots_captured_idx ON session_snapshots(session_id, captured_at DESC);
CREATE INDEX reports_session_created_idx ON reports(session_id, created_at DESC);
