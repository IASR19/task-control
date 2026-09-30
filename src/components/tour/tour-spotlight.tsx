"use client";

import { useEffect, useRef, useState } from "react";
import type { TourStep } from "@/lib/tour-steps";

type Box = { top: number; left: number; width: number; height: number };

const PAD = 6;
const GAP = 12;
const GUTTER = 16;
const FIND_TIMEOUT = 2000;

// Pega o primeiro alvo visível: o mesmo data-tour pode existir no menu do topo e na barra do celular.
function findTarget(name: string) {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const node of Array.from(nodes)) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return node;
  }
  return null;
}

function sameBox(a: Box | null, b: Box | null) {
  return (
    a === b ||
    (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height)
  );
}

export function TourSpotlight({
  step,
  index,
  total,
  segmentIndex,
  segmentTotal,
  isLast,
  onBack,
  onNext,
  onSkip,
}: {
  step: TourStep;
  index: number;
  total: number;
  segmentIndex: number;
  segmentTotal: number;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [hole, setHole] = useState<Box | null>(null);
  const [missing, setMissing] = useState(false);
  const [balloon, setBalloon] = useState<{ top: number; left: number } | null>(null);
  const balloonRef = useRef<HTMLDivElement>(null);

  // Acha o alvo (esperando a página montar), rola até ele e acompanha rolagem/redimensionamento.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startedAt = performance.now();
    let target: HTMLElement | null = null;
    let frame = 0;
    let last: Box | null = null;

    const loop = () => {
      if (!target || !target.isConnected) {
        target = findTarget(step.target);
        if (target) {
          target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
        } else if (performance.now() - startedAt > FIND_TIMEOUT) {
          setMissing(true);
        }
      }
      if (target) {
        const rect = target.getBoundingClientRect();
        const next: Box = {
          top: Math.max(0, rect.top - PAD),
          left: Math.max(0, rect.left - PAD),
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
        };
        if (!sameBox(last, next)) {
          last = next;
          setHole(next);
          setMissing(false);
        }
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [step.target]);

  // Balão embaixo do alvo; se não couber, em cima; sempre dentro da tela.
  useEffect(() => {
    const node = balloonRef.current;
    if (!node) return;
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Enquanto procura o alvo, o balão fica oculto (evita aparecer no centro e pular).
    if (!hole && !missing) {
      setBalloon(null);
      return;
    }
    if (!hole) {
      setBalloon({ top: Math.max(GUTTER, (vh - height) / 2), left: Math.max(GUTTER, (vw - width) / 2) });
      return;
    }
    const clampX = (x: number) => Math.min(Math.max(GUTTER, x), Math.max(GUTTER, vw - width - GUTTER));
    const clampY = (y: number) => Math.min(Math.max(GUTTER, y), Math.max(GUTTER, vh - height - GUTTER));
    const below = hole.top + hole.height + GAP;
    const above = hole.top - GAP - height;
    const top = below + height <= vh - GUTTER ? below : above >= GUTTER ? above : clampY(below);
    setBalloon({ top, left: clampX(hole.left + hole.width / 2 - width / 2) });
  }, [hole, missing]);

  useEffect(() => {
    balloonRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const bottom = hole ? hole.top + hole.height : 0;
  const right = hole ? hole.left + hole.width : 0;
  const nextLabel = step.navigate ? `Ir para ${step.navigate.label}` : isLast ? "Concluir" : "Próximo";

  return (
    <div className="tour-layer">
      {hole && !missing ? (
        <>
          {/* Quatro faixas escuras em volta do alvo: bloqueiam cliques no resto da tela. */}
          <div className="tour-shade" style={{ top: 0, left: 0, right: 0, height: hole.top }} />
          <div className="tour-shade" style={{ top: bottom, left: 0, right: 0, bottom: 0 }} />
          <div className="tour-shade" style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }} />
          <div className="tour-shade" style={{ top: hole.top, left: right, right: 0, height: hole.height }} />
          <div className="tour-hole" style={hole} />
          {/* No passo de navegação o clique atravessa o buraco até o item real do menu. */}
          {step.navigate ? null : <div className="tour-hole-block" style={hole} />}
        </>
      ) : (
        <div className="tour-shade" style={{ inset: 0 }} />
      )}

      <div
        ref={balloonRef}
        className="tour-balloon"
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-step-title"
        tabIndex={-1}
        style={balloon ?? { visibility: "hidden", top: 0, left: 0 }}
      >
        <p className="tour-count">
          {segmentTotal > 1 ? `Parte ${segmentIndex + 1}/${segmentTotal} · ` : ""}
          {index + 1}/{total}
        </p>
        <h3 id="tour-step-title">{step.title}</h3>
        <p>{step.body}</p>
        <div className="tour-actions">
          <button type="button" className="text-btn" onClick={onSkip}>
            Pular tour
          </button>
          <span className="tour-nav">
            <button type="button" className="btn-ghost" onClick={onBack} disabled={index === 0}>
              Voltar
            </button>
            <button type="button" className="btn-ink" onClick={onNext}>
              {nextLabel}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
