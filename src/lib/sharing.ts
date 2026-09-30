import { randomBytes } from "node:crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { projectMembers, projectShares, projects, taskAssignees, tasks, users } from "@/db/schema";
import { HttpError } from "@/lib/http";

export function newShareToken() {
  return randomBytes(24).toString("base64url");
}

export async function activeShare(projectId: string) {
  const rows = await db()
    .select()
    .from(projectShares)
    .where(and(eq(projectShares.projectId, projectId), isNull(projectShares.revokedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findShareByToken(token: string) {
  const rows = await db()
    .select({
      projectId: projects.id,
      projectName: projects.name,
      ownerId: projects.userId,
      ownerName: users.name,
    })
    .from(projectShares)
    .innerJoin(projects, eq(projects.id, projectShares.projectId))
    .innerJoin(users, eq(users.id, projects.userId))
    .where(and(eq(projectShares.token, token), isNull(projectShares.revokedAt)))
    .limit(1);
  const share = rows[0];
  if (!share) throw new HttpError(404, "Link inválido ou desativado.");
  return share;
}

// Membro só enxerga o projeto enquanto houver um link ativo: desativar o link corta o acesso de todos.
export async function requireMembership(userId: string, projectId: string) {
  const rows = await db()
    .select({
      projectId: projects.id,
      projectName: projects.name,
      ownerId: projects.userId,
      ownerName: users.name,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projects.id, projectMembers.projectId))
    .innerJoin(users, eq(users.id, projects.userId))
    .innerJoin(
      projectShares,
      and(eq(projectShares.projectId, projects.id), isNull(projectShares.revokedAt)),
    )
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  const membership = rows[0];
  if (!membership) throw new HttpError(404, "Você não tem acesso a esse projeto.");
  return membership;
}

// Dono do projeto ou membro com link ativo.
export async function requireProjectAccess(userId: string, projectId: string) {
  const [project] = await db()
    .select({ projectId: projects.id, projectName: projects.name, ownerId: projects.userId, ownerName: users.name })
    .from(projects)
    .innerJoin(users, eq(users.id, projects.userId))
    .where(eq(projects.id, projectId))
    .limit(1);
  if (project && project.ownerId === userId) return project;
  return requireMembership(userId, projectId);
}

// Pessoas que podem ser responsáveis: o dono do projeto e quem entrou pelo link (só com link ativo).
export async function projectPeople(projectId: string) {
  const [owner] = await db()
    .select({ id: users.id, name: users.name })
    .from(projects)
    .innerJoin(users, eq(users.id, projects.userId))
    .where(eq(projects.id, projectId))
    .limit(1);
  const members = await db()
    .select({ id: users.id, name: users.name })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .innerJoin(
      projectShares,
      and(eq(projectShares.projectId, projectMembers.projectId), isNull(projectShares.revokedAt)),
    )
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(asc(users.name));
  return owner ? [owner, ...members] : members;
}

// Valida os responsáveis e garante o owner na lista (se ele ainda fizer parte do projeto).
// `current` mantém quem já era responsável mesmo sem acesso agora (ex.: link desativado).
export async function resolveAssignees(
  projectId: string,
  ownerId: string,
  userIds: string[],
  current: string[] = [],
) {
  const allowed = new Set([...(await projectPeople(projectId)).map((person) => person.id), ...current]);
  if (userIds.some((id) => !allowed.has(id))) {
    throw new HttpError(400, "Responsável fora do projeto.");
  }
  const ids = allowed.has(ownerId) ? [ownerId, ...userIds] : userIds;
  return Array.from(new Set(ids));
}

type Executor = Pick<ReturnType<typeof db>, "insert" | "delete">;

export async function replaceAssignees(executor: Executor, taskId: string, userIds: string[]) {
  await executor.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
  const unique = Array.from(new Set(userIds));
  if (unique.length) {
    await executor.insert(taskAssignees).values(unique.map((userId) => ({ taskId, userId })));
  }
}

// Tira responsáveis que não fazem mais parte do projeto (task movida ou membro removido).
export async function pruneAssignees(scope: { taskId: string } | { projectId: string }) {
  const filter = "taskId" in scope ? sql`t.id = ${scope.taskId}` : sql`t.project_id = ${scope.projectId}`;
  await db().execute(sql`
    delete from task_assignees ta
    using tasks t, projects p
    where ta.task_id = t.id
      and p.id = t.project_id
      and ${filter}
      and ta.user_id <> p.user_id
      and not exists (
        select 1 from project_members m where m.project_id = p.id and m.user_id = ta.user_id
      )
  `);
}

// Executar a task (timer, concluir, iterações, checklist, comentários): dono do quadro ou membro com link ativo.
export async function requireTaskAccess(userId: string, taskId: string) {
  const [task] = await db().select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) throw new HttpError(404, "Tarefa não encontrada.");
  if (task.userId === userId) return { task, isBoardOwner: true };
  await requireMembership(userId, task.projectId);
  return { task, isBoardOwner: false };
}
