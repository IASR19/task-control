"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { Spinner } from "@/components/spinner";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api";
import { withNext } from "@/lib/next-path";
import type { SharePreview } from "@/lib/types";

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { user, ready } = useAuth();
  const router = useRouter();
  const [preview, setPreview] = useState<SharePreview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ preview: SharePreview }>(`/api/shared/join?token=${encodeURIComponent(token)}`)
      .then((data) => setPreview(data.preview))
      .catch((err) => setError(err instanceof Error ? err.message : "Link inválido."));
  }, [token]);

  useEffect(() => {
    if (!ready || !user || !preview) return;
    api<{ projectId: string; owner: boolean }>("/api/shared/join", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((data) => router.replace(data.owner ? "/quadro" : `/compartilhado/${data.projectId}`))
      .catch((err) => setError(err instanceof Error ? err.message : "Não entrou no projeto."));
  }, [ready, user, preview, token, router]);

  const here = `/c/${token}`;

  return (
    <main className="auth-stage join-stage">
      <section className="auth-panel">
        <BrandMark href="/login" size="auth" />
        {error ? (
          <>
            <h1>Link fora do ar.</h1>
            <p className="lead">{error}</p>
            <Link href="/" className="btn-ghost">
              Ir para a minha lousa
            </Link>
          </>
        ) : !preview || !ready || user ? (
          <Spinner label={user ? "Abrindo o projeto…" : "Conferindo o link…"} />
        ) : (
          <>
            <p className="brand-tag">Convite</p>
            <h1>
              {preview.ownerName} abriu o <span className="mark">{preview.projectName}</span> pra você.
            </h1>
            <p className="lead">
              Você vai poder mandar tasks para esse projeto e acompanhar as que criou. Para isso, entre ou crie
              uma conta.
            </p>
            <div className="join-actions">
              <Link href={withNext("/registro", here)} className="btn-ink">
                Criar conta
              </Link>
              <Link href={withNext("/login", here)} className="btn-ghost">
                Já tenho conta
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
