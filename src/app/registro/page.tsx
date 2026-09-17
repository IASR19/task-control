"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";

export default function RegistroPage() {
  const { register, user, ready } = useAuth();
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
      await register(name, email, password);
      router.replace("/quadro");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não registrou.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-stage">
      <div className="auth-photo" role="img" aria-label="Foto do quadro branco de tarefas" />
      <section className="auth-panel">
        <p className="kicker">Lousa</p>
        <h1>Abre a sua lousa.</h1>
        <p className="lead">
          Cadastro aberto por e-mail e senha. A sessão fica no navegador por 8 horas e se
          renova por até 14 dias. Só essa conta vê o quadro.
        </p>
        <form onSubmit={onSubmit}>
          <label>
            Nome
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
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
            Senha (mín. 8)
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn-ink" disabled={busy}>
            {busy ? "Aguarde…" : "Criar conta"}
          </button>
        </form>
        <p className="auth-switch">
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      </section>
    </main>
  );
}
