"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAccessValid, isRefreshValid, readSession } from "@/lib/token-store";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const session = readSession();
    router.replace(isAccessValid(session) || isRefreshValid(session) ? "/quadro" : "/login");
  }, [router]);
  return <p className="kicker" style={{ padding: 24 }}>Abrindo a lousa…</p>;
}
