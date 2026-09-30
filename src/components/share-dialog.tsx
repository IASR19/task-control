"use client";

import { useCallback, useEffect, useState } from "react";
import { IconClose } from "@/components/icons";
import { api } from "@/lib/api";
import { formatStamp } from "@/lib/format";
import type { Project, ProjectMember, ProjectShare } from "@/lib/types";

export function ShareDialog({
  project,
  onClose,
  onChanged,
}: {
  project: Project;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [share, setShare] = useState<ProjectShare | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await api<{ share: ProjectShare | null; members: ProjectMember[] }>(
      `/api/projects/share?projectId=${project.id}`,
    );
    setShare(data.share);
    setMembers(data.members);
  }, [project.id]);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Não carregou."))
      .finally(() => setLoading(false));
  }, [load]);

  const link = share ? `${window.location.origin}/c/${share.token}` : "";

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não deu certo.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Não copiou. Seleciona o link e copia à mão.");
    }
  }

  return (
    <>
      <button type="button" className="sheet-backdrop" aria-label="Fechar" onClick={onClose} />
      <aside className="sheet share-sheet" aria-label={`Compartilhar ${project.name}`}>
        <div className="sheet-head">
          <p className="kicker">Compartilhar · {project.name}</p>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <IconClose width={16} height={16} />
          </button>
        </div>

        <p className="share-lead">
          Quem abrir o link cria uma conta e passa a mandar tasks para este projeto. Cada pessoa vê só as tasks
          que ela criou; elas caem no seu quadro com o nome de quem mandou.
        </p>

        {loading ? (
          <p className="empty-col">Carregando…</p>
        ) : share ? (
          <div className="share-link">
            <input readOnly value={link} onFocus={(event) => event.target.select()} aria-label="Link de compartilhamento" />
            <div className="share-actions">
              <button type="button" className="btn-ink" onClick={() => void copy()}>
                {copied ? "Copiado" : "Copiar link"}
              </button>
              <button
                type="button"
                className="text-btn danger"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm("Desativar o link? Quem entrou perde o acesso até você gerar outro.")) return;
                  void run(() => api(`/api/projects/share?projectId=${project.id}`, { method: "DELETE" }));
                }}
              >
                Desativar link
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn-ink"
            disabled={busy}
            onClick={() =>
              void run(() =>
                api("/api/projects/share", { method: "POST", body: JSON.stringify({ projectId: project.id }) }),
              )
            }
          >
            {busy ? "Gerando…" : members.length ? "Gerar novo link" : "Gerar link"}
          </button>
        )}

        {error ? <p className="form-error">{error}</p> : null}

        <section className="share-members">
          <p className="kicker">Pessoas · {members.length}</p>
          {members.length === 0 ? (
            <p className="empty-col">Ninguém entrou ainda.</p>
          ) : (
            <ul>
              {members.map((member) => (
                <li key={member.id}>
                  <div>
                    <strong>{member.name}</strong>
                    <span>
                      {member.email} · desde {formatStamp(member.createdAt)} · {member.taskCount} task
                      {member.taskCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-btn danger"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`Remover ${member.name}? As tasks que já mandou continuam no seu quadro.`)) return;
                      void run(() => api(`/api/projects/members?id=${member.id}`, { method: "DELETE" }));
                    }}
                  >
                    remover
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!share && members.length ? (
            <p className="share-note">Link desativado: essas pessoas estão sem acesso até você gerar um novo.</p>
          ) : null}
        </section>
      </aside>
    </>
  );
}
