CREATE TABLE IF NOT EXISTS posts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(60) NOT NULL DEFAULT 'Convidado',
  message     TEXT        NOT NULL DEFAULT '',
  photo_data  BYTEA       NOT NULL,
  photo_mime  VARCHAR(50) NOT NULL DEFAULT 'image/jpeg',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts (created_at DESC);
