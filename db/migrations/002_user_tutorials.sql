-- Tutorial guiado: registra quem já viu cada tour ("lousa" ou "shared:<project_id>").

CREATE TABLE IF NOT EXISTS user_tutorials (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tour_key text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tour_key)
);

-- Quem já usa o sistema antes do tutorial existir não recebe o tour automático.
INSERT INTO user_tutorials (user_id, tour_key)
SELECT id, 'lousa' FROM users
ON CONFLICT DO NOTHING;

INSERT INTO user_tutorials (user_id, tour_key)
SELECT user_id, 'shared:' || project_id FROM project_members
ON CONFLICT DO NOTHING;
