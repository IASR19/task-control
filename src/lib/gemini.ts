import type { ExtractedBoard } from "@/lib/types";
import { parsePriority } from "@/lib/priority";
import { HttpError } from "@/lib/http";

const SYSTEM_PROMPT = `Você lê fotos de um quadro branco de tarefas pessoais.
A legenda do quadro é sempre:
0 = hoje
1 = amanhã
2 = esta semana
3 = sem prioridade

Os títulos vermelhos/maiores são projetos.
As linhas numeradas embaixo são tarefas.
Ignore rabiscos vazios, apagados ou ilegíveis.
Se a prioridade não estiver clara, use 3.

Responda SOMENTE um JSON válido neste formato:
{"projects":[{"name":"Nome do projeto","tasks":[{"title":"texto da tarefa","priority":0,"order":1}]}]}

priority deve ser 0, 1, 2 ou 3.
Títulos de projeto em Title Case curto (ex.: Atelier Norte, Oficina 4).
Não invente tarefa que não esteja escrita.`;

const FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-flash-latest"];

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) {
    throw new HttpError(502, "A leitura da lousa não voltou JSON.");
  }
  return JSON.parse(raw.slice(start, end + 1)) as ExtractedBoard;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBoard(text: string): ExtractedBoard {
  const extracted = extractJson(text);
  extracted.projects = (extracted.projects ?? [])
    .map((project) => ({
      name: String(project.name ?? "").trim(),
      tasks: (project.tasks ?? [])
        .map((task, index) => ({
          title: String(task.title ?? "").trim(),
          priority: parsePriority(task.priority),
          order: Number(task.order ?? index + 1),
        }))
        .filter((task) => task.title.length > 0),
    }))
    .filter((project) => project.name.length > 0);
  return extracted;
}

function modelsToTry() {
  const preferred = process.env.GEMINI_MODEL || FALLBACK_MODELS[0];
  return [preferred, ...FALLBACK_MODELS.filter((model) => model !== preferred)];
}

async function generateOnce(
  key: string,
  model: string,
  imageBase64: string,
  mimeType: string,
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: SYSTEM_PROMPT },
            {
              inline_data: {
                mime_type: mimeType || "image/jpeg",
                data: imageBase64.replace(/^data:[^;]+;base64,/, ""),
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });

  const detail = await response.text();
  if (!response.ok) {
    console.error("Gemini error", model, response.status, detail.slice(0, 500));
    return { ok: false as const, status: response.status };
  }

  const body = JSON.parse(detail) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  return { ok: true as const, text };
}

export async function readBoardImage(imageBase64: string, mimeType: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new HttpError(503, "GEMINI_API_KEY não está configurada no ambiente.");
  }

  const [primary, ...fallbacks] = modelsToTry();
  let lastStatus = 0;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await generateOnce(key, primary, imageBase64, mimeType);
    if (result.ok) return normalizeBoard(result.text);
    lastStatus = result.status;
    if (result.status === 404) break;
    if (result.status === 429 || result.status === 503) {
      await wait(1400 * (attempt + 1));
      continue;
    }
    break;
  }

  if (lastStatus === 404 || lastStatus === 429 || lastStatus === 503) {
    for (const model of fallbacks) {
      const result = await generateOnce(key, model, imageBase64, mimeType);
      if (result.ok) return normalizeBoard(result.text);
      lastStatus = result.status;
      if (result.status !== 404 && result.status !== 429 && result.status !== 503) break;
    }
  }

  if (lastStatus === 503 || lastStatus === 429) {
    throw new HttpError(
      503,
      "A leitura está congestionada agora. Espera uns segundos e manda a foto de novo.",
    );
  }
  if (lastStatus === 404) {
    throw new HttpError(502, "O modelo da Gemini não está disponível. Confira GEMINI_MODEL.");
  }
  throw new HttpError(502, "A Gemini não conseguiu ler essa foto.");
}
