"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTour } from "@/context/tour-context";
import { LOUSA_KEY, sharedKey } from "@/lib/tour-steps";

// Dentro de um projeto compartilhado refaz o tour dele; em qualquer outra tela, vai ao Quadro e refaz o da lousa.
export function TourButton({ onStart }: { onStart?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { replay } = useTour();

  function start() {
    onStart?.();
    if (pathname.startsWith("/compartilhado/")) {
      replay("shared", sharedKey(pathname.split("/")[2]));
      return;
    }
    if (!pathname.startsWith("/quadro")) router.push("/quadro");
    replay("lousa", LOUSA_KEY);
  }

  return (
    <button type="button" className="text-btn tour-trigger" onClick={start} data-tour="tour-button">
      Tutorial
    </button>
  );
}
