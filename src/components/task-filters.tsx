"use client";

import { useEffect, useRef } from "react";
import { IconSearch } from "@/components/icons";
import { EFFORT_SCALE } from "@/lib/effort";
import {
  EMPTY_FILTERS,
  filtersActive,
  presetOn,
  QUADRO_PRESETS,
  toggleValue,
  type SortKey,
  type TaskFilters,
} from "@/lib/filters";
import { PRIORITY_COLUMNS } from "@/lib/priority";
import type { Effort, Priority, Project } from "@/lib/types";

type Props = {
  filters: TaskFilters;
  projects: Project[];
  resultCount: number;
  presets?: typeof QUADRO_PRESETS;
  sorts?: { value: SortKey; label: string }[];
  showProjects?: boolean;
  onChange: (next: TaskFilters) => void;
};

const DEFAULT_SORTS: { value: SortKey; label: string }[] = [
  { value: "priority", label: "Prioridade" },
  { value: "effort", label: "Esforço" },
  { value: "updated", label: "Recente" },
  { value: "title", label: "A–Z" },
];

export function TaskFilters({
  filters,
  projects,
  resultCount,
  presets = QUADRO_PRESETS,
  sorts = DEFAULT_SORTS,
  showProjects = true,
  onChange,
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="filter-stack">
      <div className="filter-search">
        <IconSearch width={14} height={14} />
        <input
          ref={searchRef}
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          placeholder="Busca título, brief, projeto — /"
          aria-label="Buscar tarefas"
        />
        <span className="filter-count">{resultCount}</span>
        <select
          value={filters.sort}
          onChange={(event) => onChange({ ...filters, sort: event.target.value as SortKey })}
          aria-label="Ordenar"
        >
          {sorts.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-pills">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={presetOn(filters, preset) ? "pill on" : "pill"}
            onClick={() => onChange({ ...filters, ...preset.patch })}
          >
            {preset.label}
          </button>
        ))}
        {filtersActive(filters) ? (
          <button type="button" className="pill clear" onClick={() => onChange({ ...EMPTY_FILTERS, sort: filters.sort })}>
            Limpar
          </button>
        ) : null}
      </div>

      <div className="filter-pills">
        <span className="filter-label">Pri</span>
        {PRIORITY_COLUMNS.map((column) => (
          <button
            key={column.value}
            type="button"
            className={filters.priorities.includes(column.value) ? "pill on" : "pill"}
            onClick={() =>
              onChange({ ...filters, priorities: toggleValue(filters.priorities, column.value as Priority) })
            }
          >
            {column.stamp} {column.label}
          </button>
        ))}
      </div>

      <div className="filter-pills">
        <span className="filter-label">Esf</span>
        <button
          type="button"
          className={filters.efforts.includes(0) ? "pill on" : "pill"}
          onClick={() => onChange({ ...filters, efforts: toggleValue(filters.efforts, 0 as Effort) })}
        >
          —
        </button>
        {EFFORT_SCALE.map((item) => (
          <button
            key={item.value}
            type="button"
            className={filters.efforts.includes(item.value) ? "pill on" : "pill"}
            onClick={() => onChange({ ...filters, efforts: toggleValue(filters.efforts, item.value) })}
          >
            {item.stamp}
          </button>
        ))}
      </div>

      {showProjects && projects.length > 0 ? (
        <div className="filter-pills wrap">
          <span className="filter-label">Proj</span>
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={filters.projectIds.includes(project.id) ? "pill on" : "pill"}
              onClick={() =>
                onChange({ ...filters, projectIds: toggleValue(filters.projectIds, project.id) })
              }
            >
              {project.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
