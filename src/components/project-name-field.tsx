"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { IconEdit } from "@/components/icons";
import type { Project } from "@/lib/types";

type Props = {
  project: Project;
  variant?: "rail" | "mural";
  selected?: boolean;
  onToggle?: () => void;
  onRename: (id: string, name: string) => Promise<void>;
};

export function ProjectNameField({
  project,
  variant = "rail",
  selected = false,
  onToggle,
  onRename,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(project.name);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(project.name);
  }, [project.name]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function commit() {
    const next = value.trim();
    if (!next || next === project.name) {
      setValue(project.name);
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onRename(project.id, next);
      setEditing(false);
    } catch {
      setValue(project.name);
    } finally {
      setBusy(false);
    }
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void commit();
    }
    if (event.key === "Escape") {
      setValue(project.name);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={variant === "mural" ? "project-name-input mural" : "project-name-input"}
        value={value}
        disabled={busy}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={onKey}
        aria-label="Nome do projeto"
      />
    );
  }

  if (variant === "mural" || !onToggle) {
    return (
      <button
        type="button"
        className={variant === "mural" ? "project-name-btn mural" : "project-name-btn"}
        onClick={() => setEditing(true)}
        title="Editar nome do projeto"
      >
        {project.name}
      </button>
    );
  }

  return (
    <span className={selected ? "project-chip on" : "project-chip"}>
      <button type="button" onClick={onToggle} title="Filtrar por este projeto">
        {project.name}
        {project.openCount ? <em>{project.openCount}</em> : null}
      </button>
      <button
        type="button"
        className="chip-edit"
        onClick={() => setEditing(true)}
        aria-label={`Renomear ${project.name}`}
      >
        <IconEdit width={11} height={11} />
      </button>
    </span>
  );
}
