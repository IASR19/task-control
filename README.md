# Lousa

O quadro da parede, com relógio.

Next.js na Vercel (front + API serverless) e PostgreSQL no Railway. Lê a foto da lousa com Gemini, compara com o que já existe, conta esforço com timer e mostra o quadro por prioridade, lista ou mural — a mesma grade da parede.

## Conta e sessão

- Registro e login por e-mail e senha.
- Access token: **8 horas** (ajustável em `JWT_ACCESS_EXPIRES_IN`).
- Refresh token: **14 dias** (`JWT_REFRESH_EXPIRES_IN`).
- Os dois ficam no `localStorage` (`lousa.session`). Quando o access vence, o app troca pelo refresh; se o refresh também venceu, volta para o login.

## Foto da lousa

A leitura faz três coisas:

| No quadro novo | No Lousa |
|---|---|
| Linha que não existia | **Inclui** |
| Mesma linha, prioridade diferente | Marca **remanejada** e atualiza o carimbo (0 / 1 / 2 / 3) |
| Linha da foto anterior que sumiu | Marca **concluída** (saiu da parede) |

Tarefas criadas à mão não são apagadas só porque a foto não as trouxe.

## Subir

### 1. Banco no Railway

1. Crie um PostgreSQL no [Railway](https://railway.app).
2. Copie a `DATABASE_URL` (Connections).
3. Rode o schema: cole `db/init.sql` no Query do Railway **ou**, com a URL no `.env.local`:

```bash
cp .env.example .env.local
# preencha DATABASE_URL, JWT_SECRET e GEMINI_API_KEY
npm run db:migrate
```

Se o Postgres local não usa TLS: `DATABASE_SSL=false`.

### 2. Variáveis na Vercel

| Variável | Valor |
|---|---|
| `DATABASE_URL` | URL do Railway |
| `DATABASE_SSL` | `true` |
| `JWT_SECRET` | string longa (`openssl rand -base64 48`) |
| `JWT_ACCESS_EXPIRES_IN` | `8h` |
| `JWT_REFRESH_EXPIRES_IN` | `14d` |
| `GEMINI_API_KEY` | chave da Google AI Studio |
| `GEMINI_MODEL` | `gemini-3.6-flash` |

Não commite a chave. Se ela já apareceu num chat, gere outra na AI Studio.

### 3. Deploy

```bash
npm i
npx vercel
```

No primeiro acesso, registre um usuário em `/registro`.

## Local

```bash
npm i
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Abre `http://localhost:3000`.

## Carimbos da parede

`0` hoje · `1` amanhã · `2` esta semana · `3` sem prioridade
