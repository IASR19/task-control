-- Quem concluiu a task (no projeto compartilhado qualquer membro pode concluir).

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES users(id) ON DELETE SET NULL;

-- Até aqui só o dono do quadro conseguia concluir.
UPDATE tasks SET completed_by = user_id WHERE status = 'done' AND completed_by IS NULL;
