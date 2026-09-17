"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AuthLive } from "@/components/auth-live";
import { BrandMark } from "@/components/brand-mark";
import { Spinner } from "@/components/spinner";
import { useAuth } from "@/context/auth-context";

export function AuthScreen({ mode }: { mode: "login" | "registro" }) {
  const { login, register, user, ready } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace("/quadro");
  }, [ready, user, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "registro") await register(name, email, password);
      else await login(email, password);
      router.replace("/quadro");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não entrou.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-stage">
      <AuthLive />
      <section className="auth-panel">
        {!ready ? (
          <Spinner label="Conferindo sessão…" />
        ) : (
          <>
        <BrandMark href="/login" size="auth" />
        <p className="brand-tag">O quadro da parede, com relógio.</p>
        <h1>
          {mode === "login" ? (
            <>
              Organize o seu dia <span className="mark">do seu jeito</span>.
            </>
          ) : (
            "Abre a sua lousa."
          )}
        </h1>
        {mode === "registro" ? (
          <p className="lead">Cadastro por e-mail e senha. Cada conta vê só o próprio quadro.</p>
        ) : (
          <p className="lead">Da lousa física para um quadro vivo.</p>
        )}
        <form onSubmit={onSubmit}>
          {mode === "registro" ? (
            <label>
              Nome
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
          ) : null}
          <label>
            E-mail
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            {mode === "registro" ? "Senha (mín. 8)" : "Senha"}
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn-ink" disabled={busy}>
            {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>
        <p className="auth-switch">
          {mode === "login" ? (
            <>
              Ainda não tem lousa? <Link href="/registro">Registrar</Link>
            </>
          ) : (
            <>
              Já tem conta? <Link href="/login">Entrar</Link>
            </>
          )}
        </p>
          </>
        )}
      </section>
    </main>
  );
}
