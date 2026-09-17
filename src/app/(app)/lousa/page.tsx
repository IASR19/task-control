"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { compressImage } from "@/lib/compress-image";
import { stampFor } from "@/lib/priority";
import type { BoardSnapshot, ReconcileSummary } from "@/lib/types";

export default function LousaPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ReconcileSummary | null>(null);
  const [history, setHistory] = useState<BoardSnapshot[]>([]);
  const [seedMessage, setSeedMessage] = useState("");

  async function loadHistory() {
    const data = await api<{ snapshots: BoardSnapshot[] }>("/api/board/history");
    setHistory(data.snapshots);
  }

  useEffect(() => {
    void loadHistory().catch(() => undefined);
  }, []);

  async function onFile(file: File) {
    setBusy(true);
    setError("");
    setSummary(null);
    try {
      const { base64, mimeType } = await compressImage(file);
      const result = await api<{ summary: ReconcileSummary }>("/api/board/ingest", {
        method: "POST",
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      setSummary(result.summary);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "A foto não foi lida.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">Foto da lousa</p>
          <h1>Aponta a câmera para o quadro.</h1>
        </div>
      </div>
      <p className="lead" style={{ maxWidth: "38rem", color: "var(--ink-soft)", marginTop: 0 }}>
        A leitura compara com o que já está salvo: linha nova entra; prioridade diferente vira
        remanejada; o que sumiu da parede é marcado como concluído. Tarefas criadas à mão não
        desaparecem só porque não estavam na foto.
      </p>

      <label className="dropzone">
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
        <span>{busy ? "Lendo a parede…" : "Solta a foto aqui, ou clica para escolher."}</span>
      </label>

      {error ? <p className="form-error" style={{ marginTop: 16 }}>{error}</p> : null}

      <p style={{ marginTop: 20 }}>
        Primeira vez e o quadro ainda está vazio? Dá para carregar o recorte de 17/09 sem passar pela
        IA.
      </p>
      <button
        type="button"
        className="btn-ghost"
        onClick={async () => {
          const result = await api<{ seeded: boolean; message?: string }>("/api/board/seed-reference", {
            method: "POST",
          });
          setSeedMessage(
            result.seeded
              ? "Quadro de 17/09 copiado. Abre a aba Quadro."
              : result.message ?? "Não semeei.",
          );
        }}
      >
        Carregar o quadro fotografado
      </button>
      {seedMessage ? <p>{seedMessage}</p> : null}

      {summary ? (
        <table className="review-table">
          <thead>
            <tr>
              <th>O que a foto fez</th>
              <th>Projeto</th>
              <th>Linha</th>
              <th>Pri.</th>
            </tr>
          </thead>
          <tbody>
            {summary.created.map((row) => (
              <tr key={`c-${row.project}-${row.title}`}>
                <td>Incluída</td>
                <td className="proj-name">{row.project}</td>
                <td>{row.title}</td>
                <td className="mono">{stampFor(row.priority)}</td>
              </tr>
            ))}
            {summary.remanejadas.map((row) => (
              <tr key={`r-${row.project}-${row.title}`}>
                <td>Remanejada</td>
                <td className="proj-name">{row.project}</td>
                <td>{row.title}</td>
                <td className="mono">
                  {stampFor(row.from)} → {stampFor(row.to)}
                </td>
              </tr>
            ))}
            {summary.completed.map((row) => (
              <tr key={`d-${row.project}-${row.title}`}>
                <td>Saiu da lousa</td>
                <td className="proj-name">{row.project}</td>
                <td>{row.title}</td>
                <td />
              </tr>
            ))}
            {summary.created.length + summary.remanejadas.length + summary.completed.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  Nada mudou ({summary.unchanged} linhas iguais às da parede).
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      ) : null}

      {history.length > 0 ? (
        <>
          <h2 style={{ fontSize: 28, fontStyle: "italic", margin: "36px 0 8px" }}>Leituras anteriores</h2>
          <table className="review-table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Incluiu</th>
                <th>Remanejou</th>
                <th>Concluiu</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString("pt-BR")}</td>
                  <td>{row.summary.created.length}</td>
                  <td>{row.summary.remanejadas.length}</td>
                  <td>{row.summary.completed.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}
