PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX sessions_by_user ON sessions(user_id);
CREATE INDEX sessions_by_expiry ON sessions(expires_at);

CREATE TABLE app_states (
  user_id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE photos (
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  name TEXT NOT NULL,
  content_type TEXT,
  created_at TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, client_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX photos_by_user ON photos(user_id);
