"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";

function AuthPanel({
  mode,
}: {
  mode: "login" | "registro";
}) {
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
      <div className="auth-photo" role="img" aria-label="Foto do quadro branco de tarefas" />
      <section className="auth-panel">
        <p className="kicker">Lousa</p>
        <h1>{mode === "login" ? "Entra no quadro." : "Abre a sua lousa."}</h1>
        <p className="lead">
          {mode === "login"
            ? "O mesmo quadro da parede, agora com relógio. A sessão no navegador vale 8 horas; se você continuar usando, ela se renova por até 14 dias."
            : "Cadastro por e-mail e senha. Cada conta vê só o próprio quadro — projetos, timers e fotos não se misturam."}
        </p>
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
            Senha
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
      </section>
    </main>
  );
}

export default function LoginPage() {
  return <AuthPanel mode="login" />;
}
