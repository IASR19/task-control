import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import { normalizeKey, parsePriority } from "@/lib/priority";
import type { Priority, ReconcileSummary } from "@/lib/types";

export type ExtractedBoard = {
  projects: {
    name: string;
    tasks: { title: string; priority: number; order?: number }[];
  }[];
};

const MATCH_THRESHOLD = 0.72;

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = Math.min(
        row[j] + 1,
        prev + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      row[j - 1] = prev;
      prev = current;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

function similarity(a: string, b: string) {
  const left = normalizeKey(a);
  const right = normalizeKey(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const max = Math.max(left.length, right.length);
  return 1 - levenshtein(left, right) / max;
}

type OpenTask = {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  priority: number;
  source: string;
};

function findMatch(list: OpenTask[], projectName: string, title: string) {
  const sameProject = list.filter(
    (task) => normalizeKey(task.projectName) === normalizeKey(projectName),
  );
  let best: { task: OpenTask; score: number } | null = null;
  for (const task of sameProject) {
    const score = similarity(task.title, title);
    if (!best || score > best.score) best = { task, score };
  }
  if (best && best.score >= MATCH_THRESHOLD) return best.task;
  return null;
}

export async function reconcileBoard(userId: string, extracted: ExtractedBoard) {
  const database = db();
  const existingProjects = await database
    .select()
    .from(projects)
    .where(eq(projects.userId, userId));

  const openRows = await database
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      projectName: projects.name,
      title: tasks.title,
      priority: tasks.priority,
      source: tasks.source,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(eq(tasks.userId, userId), inArray(tasks.status, ["open", "in_progress", "remanejada"])),
    );

  const openTasks: OpenTask[] = openRows.map((row) => ({
    ...row,
    projectName: row.projectName,
  }));

  const matchedIds = new Set<string>();
  const summary: ReconcileSummary = {
    created: [],
    completed: [],
    remanejadas: [],
    unchanged: 0,
  };

  const projectByKey = new Map(
    existingProjects.map((project) => [normalizeKey(project.name), project]),
  );

  let sortCursor = existingProjects.length;

  for (const incoming of extracted.projects) {
    const name = incoming.name.trim();
    if (!name) continue;
    const key = normalizeKey(name);
    let project = projectByKey.get(key);
    if (!project) {
      const inserted = await database
        .insert(projects)
        .values({ userId, name, sortOrder: sortCursor })
        .returning();
      project = inserted[0];
      projectByKey.set(key, project);
      sortCursor += 1;
    }

    incoming.tasks.forEach((incomingTask, index) => {
      incomingTask.order = incomingTask.order ?? index;
    });

    for (const incomingTask of incoming.tasks) {
      const title = incomingTask.title.trim();
      if (!title) continue;
      const priority = parsePriority(incomingTask.priority);
      const match = findMatch(openTasks, project.name, title);

      if (!match) {
        await database.insert(tasks).values({
          userId,
          projectId: project.id,
          title,
          priority,
          status: "open",
          source: "board",
          boardKey: normalizeKey(title),
          sortOrder: incomingTask.order ?? 0,
        });
        summary.created.push({ title, project: project.name, priority });
        continue;
      }

      matchedIds.add(match.id);
      if (match.priority !== priority) {
        await database
          .update(tasks)
          .set({
            priority,
            previousPriority: match.priority,
            status: "remanejada",
            source: "board",
            boardKey: normalizeKey(title),
            title,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, match.id));
        summary.remanejadas.push({
          title,
          project: project.name,
          from: match.priority as Priority,
          to: priority,
        });
      } else {
        await database
          .update(tasks)
          .set({
            source: "board",
            boardKey: normalizeKey(title),
            title,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, match.id));
        summary.unchanged += 1;
      }
    }
  }

  const vanished = openTasks.filter(
    (task) => task.source === "board" && !matchedIds.has(task.id),
  );
  for (const task of vanished) {
    await database
      .update(tasks)
      .set({
        status: "done",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, task.id));
    summary.completed.push({ title: task.title, project: task.projectName });
  }

  return summary;
}
