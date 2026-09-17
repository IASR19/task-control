"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/lib/format";
import { PriorityStamp } from "@/components/priority-stamp";

const CHATS = [
  { who: "lousa", text: "Foto da parede lida. Duas linhas novas no Atelier Norte." },
  { who: "timer", text: "Oficina 4 · capa do catálogo — relógio ligado." },
  { who: "quadro", text: "Casa Clara: revisar o texto saiu da lousa. Marquei feita." },
  { who: "lousa", text: "Linha Doce remanejada. Saiu de hoje para amanhã." },
  { who: "timer", text: "Estúdio Mar · recorte. Cai no dia." },
  { who: "quadro", text: "Pátio continua no 3. Sem prioridade." },
  { who: "lousa", text: "Folha: montar o índice ainda nesta semana." },
  { who: "timer", text: "Vaga-Lume · prova de cor. Sessão curta, 12 minutos." },
  { who: "quadro", text: "Barco Seco: abrir o dossiê. Linha nova." },
  { who: "lousa", text: "Sala 12 ainda em branco. Nada pra incluir." },
];

const PROJECTS = [
  "Atelier Norte",
  "Oficina 4",
  "Casa Clara",
  "Linha Doce",
  "Estúdio Mar",
  "Pátio",
  "Folha",
  "Vaga-Lume",
];

export function AuthLive() {
  const [elapsed, setElapsed] = useState(42 * 60 + 11);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <aside className="auth-live" aria-hidden="true">
      <div className="auth-live-grid">
        <div className="auth-chat-col">
          <p className="auth-live-kicker">sala do quadro</p>
          <div className="auth-chat-window">
            <div className="auth-chat-track">
              {[0, 1].map((copy) => (
                <div key={copy} className="auth-chat-copy">
                  {CHATS.map((item) => (
                    <article key={`${copy}-${item.text}`} className={`auth-chat auth-chat-${item.who}`}>
                      <span>{item.who}</span>
                      <p>{item.text}</p>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="auth-live-side">
          <p className="auth-live-kicker">em curso</p>
          <p className="auth-live-clock">{formatClock(elapsed)}</p>
          <p className="auth-live-task">
            <em>Oficina 4</em>
            Capa do catálogo
          </p>
          <div className="auth-live-stamps">
            <PriorityStamp priority={0} large />
            <PriorityStamp priority={1} large />
            <PriorityStamp priority={2} large />
            <PriorityStamp priority={3} large />
          </div>
          <p className="auth-live-legend">hoje · amanhã · semana · sem prioridade</p>
        </div>
      </div>

      <div className="auth-marquee">
        <div className="auth-marquee-track">
          {[0, 1].map((copy) => (
            <p key={copy}>
              {PROJECTS.map((name) => (
                <span key={`${copy}-${name}`}>{name}</span>
              ))}
            </p>
          ))}
        </div>
      </div>
    </aside>
  );
}
