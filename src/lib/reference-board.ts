import type { Priority } from "./types";

export const REFERENCE_BOARD: {
  name: string;
  tasks: { title: string; priority: Priority }[];
}[] = [
  {
    name: "Powersave",
    tasks: [
      { title: "Finalizar task de bugfix", priority: 3 },
      { title: "Superar tarefas da equipe", priority: 3 },
    ],
  },
  {
    name: "Hacktown",
    tasks: [
      { title: "Iniciar refactor", priority: 2 },
      { title: "Verificar existência de necessidade pós evento", priority: 1 },
      { title: "Revisar PRs", priority: 3 },
    ],
  },
  {
    name: "Uberkan",
    tasks: [],
  },
  {
    name: "Poromapp",
    tasks: [{ title: "Unificar nova estrutura", priority: 3 }],
  },
  {
    name: "Ebook",
    tasks: [{ title: "Criar objetivo do 1º ebook", priority: 2 }],
  },
  {
    name: "Manzai",
    tasks: [
      { title: "Finalizar overlay", priority: 1 },
      { title: "Ajustar backend", priority: 1 },
      { title: "Usar Railway (BE + BD)", priority: 1 },
    ],
  },
  {
    name: "Aponta",
    tasks: [
      { title: "Refatorar front + back", priority: 2 },
      { title: "Implementar STAPS", priority: 1 },
      { title: "Mobile", priority: 0 },
      { title: "Teste", priority: 3 },
    ],
  },
  {
    name: "Bora Rio",
    tasks: [{ title: "Iniciar desenvolvimento", priority: 3 }],
  },
  {
    name: "Onchat",
    tasks: [
      { title: "Iniciar metanases", priority: 2 },
      { title: "Estudar pacificação", priority: 2 },
    ],
  },
];
