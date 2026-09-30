"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { SharedWorkspace } from "@/lib/types";

const HOME = "/quadro";

export function WorkspaceSwitch() {
  const pathname = usePathname();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<SharedWorkspace[]>([]);

  const sharedId = pathname.startsWith("/compartilhado/") ? pathname.split("/")[2] : null;

  // Recarrega ao trocar de workspace: cobre o caso de quem acabou de aceitar um convite.
  useEffect(() => {
    let alive = true;
    api<{ workspaces: SharedWorkspace[] }>("/api/shared/workspaces")
      .then((data) => {
        if (alive) setWorkspaces(data.workspaces);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [sharedId]);

  if (!workspaces.length) return null;

  return (
    <label className="workspace-switch" data-tour="workspace-switch">
      <span className="sr-only">Workspace</span>
      <select
        value={sharedId ? `/compartilhado/${sharedId}` : HOME}
        onChange={(event) => router.push(event.target.value)}
      >
        <option value={HOME}>Minha lousa</option>
        {workspaces.map((item) => (
          <option key={item.projectId} value={`/compartilhado/${item.projectId}`}>
            {item.projectName} · de {item.ownerName}
          </option>
        ))}
      </select>
    </label>
  );
}
