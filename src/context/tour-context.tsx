"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TourSpotlight } from "@/components/tour/tour-spotlight";
import { TourWelcome } from "@/components/tour/tour-welcome";
import { api } from "@/lib/api";
import { TOURS, type TourId } from "@/lib/tour-steps";

type Prompt = { tour: TourId; key: string; auto: boolean };
type Active = Prompt & { segment: number; step: number };

type TourContextValue = {
  // Oferece o tour sozinho, uma vez por usuário/chave. As páginas chamam depois de carregar.
  offer: (tour: TourId, key: string) => void;
  // Botão "Tutorial": sempre abre o aviso, sem mexer no que já foi marcado como visto.
  replay: (tour: TourId, key: string) => void;
  // A página pergunta se o trecho dela está rodando (para mostrar dados de exemplo).
  isRunningOn: (route: string) => boolean;
};

const TourContext = createContext<TourContextValue | null>(null);

function sharedIdFrom(pathname: string) {
  return pathname.startsWith("/compartilhado/") ? pathname.split("/")[2] : null;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [seen, setSeen] = useState<Set<string> | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  // Trava em memória: re-render/re-mount (StrictMode) não reabre o aviso na mesma sessão.
  const offered = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;
    api<{ seen: string[] }>("/api/tutorials")
      .then((data) => {
        if (alive) setSeen(new Set(data.seen));
      })
      // Sem saber o que já foi visto, melhor não abrir nada sozinho.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const markSeen = useCallback((key: string) => {
    setSeen((current) => new Set(current ?? []).add(key));
    void api("/api/tutorials", { method: "POST", body: JSON.stringify({ key }) }).catch(() => undefined);
  }, []);

  const offer = useCallback(
    (tour: TourId, key: string) => {
      if (!seen || seen.has(key) || offered.current.has(key) || prompt || active) return;
      offered.current.add(key);
      setPrompt({ tour, key, auto: true });
    },
    [seen, prompt, active],
  );

  const replay = useCallback((tour: TourId, key: string) => {
    offered.current.add(key);
    setActive(null);
    setPrompt({ tour, key, auto: false });
  }, []);

  const end = useCallback(
    (completed: boolean) => {
      if (active && (completed || active.auto)) markSeen(active.key);
      setActive(null);
    },
    [active, markSeen],
  );

  // Continuidade entre páginas: a navegação real para o próximo trecho avança o tour;
  // sair do roteiro encerra (e conta como visto se ele tinha aberto sozinho).
  useEffect(() => {
    if (!active) return;
    const segments = TOURS[active.tour];
    const sameProject = active.tour !== "shared" || active.key === `shared:${sharedIdFrom(pathname)}`;
    if (pathname.startsWith(segments[active.segment].route) && sameProject) return;
    const next = segments[active.segment + 1];
    if (next && pathname.startsWith(next.route)) {
      setActive({ ...active, segment: active.segment + 1, step: 0 });
      return;
    }
    end(false);
  }, [pathname, active, end]);

  const isRunningOn = useCallback(
    (route: string) => Boolean(active && TOURS[active.tour][active.segment].route === route),
    [active],
  );

  const value = useMemo(() => ({ offer, replay, isRunningOn }), [offer, replay, isRunningOn]);

  // O aviso espera a página do 1º trecho (ex.: "Tutorial" clicado fora do Quadro navega antes).
  const promptReady = prompt ? pathname.startsWith(TOURS[prompt.tour][0].route) : false;
  const segments = active ? TOURS[active.tour] : null;
  const segment = active && segments ? segments[active.segment] : null;
  const step = active && segment ? segment.steps[active.step] : null;

  return (
    <TourContext.Provider value={value}>
      {children}
      {prompt && promptReady ? (
        <TourWelcome
          tour={prompt.tour}
          auto={prompt.auto}
          onStart={() => {
            setActive({ ...prompt, segment: 0, step: 0 });
            setPrompt(null);
          }}
          onSkip={() => {
            if (prompt.auto) markSeen(prompt.key);
            setPrompt(null);
          }}
        />
      ) : null}
      {active && segments && segment && step ? (
        <TourSpotlight
          key={`${active.tour}-${active.segment}-${active.step}`}
          step={step}
          index={active.step}
          total={segment.steps.length}
          segmentIndex={active.segment}
          segmentTotal={segments.length}
          isLast={active.segment === segments.length - 1 && active.step === segment.steps.length - 1}
          onBack={() => setActive({ ...active, step: Math.max(0, active.step - 1) })}
          onNext={() => {
            if (step.navigate) {
              router.push(step.navigate.href);
              return;
            }
            if (active.step < segment.steps.length - 1) {
              setActive({ ...active, step: active.step + 1 });
              return;
            }
            end(true);
          }}
          onSkip={() => end(false)}
        />
      ) : null}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour fora do TourProvider");
  return ctx;
}
