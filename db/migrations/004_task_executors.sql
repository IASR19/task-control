-- Executores: quem põe a mão na massa. Qualquer pessoa do projeto pode trocar.

CREATE TABLE IF NOT EXISTS task_executors (
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS task_executors_user_idx ON task_executors (user_id);
