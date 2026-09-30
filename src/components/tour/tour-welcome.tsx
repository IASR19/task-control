"use client";

import { useEffect, useRef } from "react";
import type { TourId } from "@/lib/tour-steps";

const COPY: Record<TourId, { auto: { title: string; body: string }; manual: { title: string; body: string } }> = {
  lousa: {
    auto: {
      title: "Um tour rápido pela sua lousa",
      body: "Em menos de um minuto mostro onde fica cada coisa: projetos, tasks, timer e as outras abas. Ele só aparece sozinho desta vez. Dá pra pular e rever quando quiser no botão Tutorial, no topo.",
    },
    manual: {
      title: "Refazer o tour da lousa?",
      body: "Passo de novo pelo Quadro, Atividades, Arquivo e Foto.",
    },
  },
  shared: {
    auto: {
      title: "Você entrou num projeto compartilhado",
      body: "Um tour rápido mostra o que dá pra fazer aqui: mandar tasks, escolher responsáveis e acompanhar tudo do projeto. Ele só aparece sozinho na primeira vez em cada projeto. Dá pra pular e rever no botão Tutorial.",
    },
    manual: {
      title: "Refazer o tour deste projeto?",
      body: "Mostro de novo como mandar tasks, escolher responsáveis e acompanhar o projeto.",
    },
  },
};

export function TourWelcome({
  tour,
  auto,
  onStart,
  onSkip,
}: {
  tour: TourId;
  auto: boolean;
  onStart: () => void;
  onSkip: () => void;
}) {
  const startRef = useRef<HTMLButtonElement>(null);
  const copy = COPY[tour][auto ? "auto" : "manual"];

  useEffect(() => {
    startRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  return (
    <div className="tour-welcome-backdrop">
      <div className="tour-welcome" role="dialog" aria-modal="true" aria-labelledby="tour-welcome-title">
        <p className="kicker">Tutorial</p>
        <h2 id="tour-welcome-title">{copy.title}</h2>
        <p>{copy.body}</p>
        <div className="tour-welcome-actions">
          <button ref={startRef} type="button" className="btn-ink" onClick={onStart}>
            Começar
          </button>
          <button type="button" className="text-btn" onClick={onSkip}>
            Pular
          </button>
        </div>
      </div>
    </div>
  );
}
