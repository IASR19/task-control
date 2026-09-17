import type { Priority } from "./types";

export const REFERENCE_BOARD: {
  name: string;
  tasks: { title: string; priority: Priority }[];
}[] = [
  {
    name: "Powersave",
    tasks: [
      { title: "Finalizar task de bugfix", priority: 0 },
      { title: "Superar tarefas da equipe", priority: 0 },
    ],
  },
  {
    name: "Hacktown",
    tasks: [
      { title: "Iniciar refactor", priority: 3 },
      { title: "Verificar existência de necessidade pós evento", priority: 2 },
      { title: "Revisar PRs", priority: 0 },
    ],
  },
  {
    name: "Uberkan",
    tasks: [],
  },
  {
    name: "Poromapp",
    tasks: [{ title: "Unificar nova estrutura", priority: 0 }],
  },
  {
    name: "Ebook",
    tasks: [{ title: "Criar objetivo do 1º ebook", priority: 3 }],
  },
  {
    name: "Manzai",
    tasks: [
      { title: "Finalizar overlay", priority: 2 },
      { title: "Ajustar backend", priority: 2 },
      { title: "Usar Railway (BE + BD)", priority: 2 },
    ],
  },
  {
    name: "Aponta",
    tasks: [
      { title: "Refatorar front + back", priority: 3 },
      { title: "Implementar STAPS", priority: 2 },
      { title: "Mobile", priority: 1 },
      { title: "Teste", priority: 0 },
    ],
  },
  {
    name: "Bora Rio",
    tasks: [{ title: "Iniciar desenvolvimento", priority: 0 }],
  },
  {
    name: "Onchat",
    tasks: [
      { title: "Iniciar metanases", priority: 3 },
      { title: "Estudar pacificação", priority: 3 },
    ],
  },
];
