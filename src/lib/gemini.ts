import type { ExtractedBoard } from "@/lib/reconcile";
import { parsePriority } from "@/lib/priority";
import { HttpError } from "@/lib/http";

const SYSTEM_PROMPT = `Você lê fotos de um quadro branco de tarefas pessoais.
A legenda do quadro é sempre:
1 = hoje
2 = amanhã
3 = nesta semana
O ou 0 = baixa prioridade

Os títulos vermelhos/maiores são projetos.
As linhas numeradas embaixo são tarefas.
Ignore rabiscos vazios, apagados ou ilegíveis.
Se a prioridade não estiver clara, use 0.

Responda SOMENTE um JSON válido neste formato:
{"projects":[{"name":"Nome do projeto","tasks":[{"title":"texto da tarefa","priority":0,"order":1}]}]}

priority deve ser 0, 1, 2 ou 3.
Títulos de projeto em Title Case curto (ex.: Powersave, Hacktown, Bora Rio).
Não invente tarefa que não esteja escrita.`;

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

export async function readBoardImage(imageBase64: string, mimeType: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new HttpError(503, "GEMINI_API_KEY não está configurada no ambiente.");
  }
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const payload = {
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
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Gemini error", response.status, detail);
    throw new HttpError(502, "A Gemini não conseguiu ler essa foto.");
  }

  const body = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
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
