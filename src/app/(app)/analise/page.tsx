"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDayLabel, formatDuration } from "@/lib/format";
import type { AnalyticsPayload } from "@/lib/types";

export default function AnalisePage() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<AnalyticsPayload>("/api/analytics")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha"));
  }, []);

  if (error) return <p className="form-error">{error}</p>;
  if (!data) return <p className="kicker">Medindo o esforço…</p>;

  const maxProject = Math.max(1, ...data.byProject.map((row) => row.seconds));
  const maxDay = Math.max(1, ...data.byDay.map((row) => row.seconds));

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">Esforço</p>
          <h1>Tempo de verdade, não chute.</h1>
        </div>
      </div>

      <section className="effort-hero">
        <div>
          <p className="kicker">esta semana</p>
          <p className="effort-number">{formatDuration(data.weekSeconds)}</p>
        </div>
        <div>
          <p>
            Hoje já foram <strong>{formatDuration(data.todaySeconds)}</strong>. No quadro restam{" "}
            <strong>{data.openCount}</strong> linhas abertas, {data.doneCount} saíram da lousa e{" "}
            {data.remanejadaCount} foram remanejadas.
          </p>
        </div>
      </section>

      <h2 style={{ fontSize: 28, fontStyle: "italic", margin: "0 0 16px" }}>Por projeto, nesta semana</h2>
      {data.byProject.length === 0 ? (
        <p className="empty-col">Ainda não ligou o timer em nada.</p>
      ) : (
        <div className="bars">
          {data.byProject.map((row) => (
            <div key={row.name} className="bar-row">
              <span className="proj-name">{row.name}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(row.seconds / maxProject) * 100}%` }} />
              </div>
              <span className="mono">{formatDuration(row.seconds)}</span>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 28, fontStyle: "italic", margin: "36px 0 8px" }}>Últimos 14 dias</h2>
      <div className="day-bars">
        {data.byDay.map((row) => (
          <div key={row.date} className="day-col">
            <div
              className="day-fill"
              style={{ height: `${Math.max(4, (row.seconds / maxDay) * 100)}%` }}
              title={formatDuration(row.seconds)}
            />
            <span>{formatDayLabel(row.date)}</span>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 28, fontStyle: "italic", margin: "36px 0 8px" }}>Onde o relógio parou mais</h2>
      <table className="review-table">
        <thead>
          <tr>
            <th>Tarefa</th>
            <th>Projeto</th>
            <th>Esforço</th>
          </tr>
        </thead>
        <tbody>
          {data.topTasks.length === 0 ? (
            <tr>
              <td colSpan={3}>Nenhuma sessão fechada ainda.</td>
            </tr>
          ) : (
            data.topTasks.map((row) => (
              <tr key={row.id}>
                <td>{row.title}</td>
                <td className="proj-name">{row.projectName}</td>
                <td className="mono">{formatDuration(row.seconds)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
