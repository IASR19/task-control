import type { GuestTask, Person, Project, Task } from "@/lib/types";

// Dados de exemplo do tutorial: só existem na tela enquanto o trecho roda e nunca vão ao servidor.
export const DEMO_PREFIX = "__demo_";

export function isDemo(id: string) {
  return id.startsWith(DEMO_PREFIX);
}

const DEMO_PERSON: Person = { id: `${DEMO_PREFIX}person`, name: "Ana Souza" };

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

export function demoBoard(user: Person): { project: Project; tasks: Task[] } {
  const project: Project = { id: `${DEMO_PREFIX}project`, name: "Site novo", sortOrder: 999, openCount: 2, shared: false };
  const now = new Date().toISOString();
  const base = {
    projectId: project.id,
    projectName: project.name,
    notes: "",
    previousPriority: null,
    status: "open" as const,
    source: "manual" as const,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    startAt: null,
    endAt: null,
    ownerId: user.id,
    ownerName: user.name,
  };
  return {
    project,
    tasks: [
      {
        ...base,
        id: `${DEMO_PREFIX}task-1`,
        title: "Revisar a proposta do cliente",
        priority: 0,
        sortOrder: 0,
        effort: 2,
        deadlineAt: hoursFromNow(-20),
        assignees: [user],
        effortSeconds: 25 * 60,
        checkTotal: 3,
        checkDone: 1,
      },
      {
        ...base,
        id: `${DEMO_PREFIX}task-2`,
        title: "Mandar o orçamento",
        priority: 1,
        sortOrder: 0,
        effort: 1,
        deadlineAt: hoursFromNow(72),
        assignees: [user, DEMO_PERSON],
        effortSeconds: 0,
        checkTotal: 0,
        checkDone: 0,
      },
    ],
  };
}

export function demoGuestTask(user: Person, ownerName: string): GuestTask {
  return {
    id: `${DEMO_PREFIX}guest-task`,
    title: "Ajustar o texto da página inicial",
    notes: "Exemplo do tutorial: as tasks que você mandar aparecem assim.",
    status: "open",
    ownerId: user.id,
    ownerName: user.name,
    assignees: [user, { id: `${DEMO_PREFIX}owner`, name: ownerName }],
    deadlineAt: hoursFromNow(48),
    imageCount: 0,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}
