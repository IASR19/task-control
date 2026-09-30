"use client";

import { useState } from "react";
import { avatarTone, initials } from "@/lib/initials";
import type { Person } from "@/lib/types";

export function Avatar({ person, size = 22, hint }: { person: Person; size?: number; hint?: string }) {
  const label = hint ? `${person.name} · ${hint}` : person.name;
  return (
    <span
      className={`avatar tone-${avatarTone(person.id)}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      title={label}
      aria-label={label}
      role="img"
    >
      {initials(person.name)}
    </span>
  );
}

// Owner (quem criou) e, depois da seta, os demais responsáveis. O owner já é responsável, então não repete.
export function TaskPeople({
  owner,
  assignees,
  executors = [],
  showOwner = true,
  size = 20,
}: {
  owner: Person;
  assignees: Person[];
  executors?: Person[];
  showOwner?: boolean;
  size?: number;
}) {
  const others = assignees.filter((person) => person.id !== owner.id);
  if (!showOwner && !others.length && !executors.length) return null;
  return (
    <span className="task-people">
      {showOwner ? <Avatar person={owner} size={size} hint="criou" /> : null}
      {showOwner && others.length ? <span className="people-arrow" aria-hidden>→</span> : null}
      {others.length ? (
        <span className="avatar-stack">
          {others.map((person) => (
            <Avatar key={person.id} person={person} size={size} hint="responsável" />
          ))}
        </span>
      ) : null}
      {executors.length ? (
        <span className="people-exec" title="Executores">
          <span className="exec-mark" aria-hidden>
            ▶
          </span>
          <span className="avatar-stack">
            {executors.map((person) => (
              <Avatar key={person.id} person={person} size={size} hint="executor" />
            ))}
          </span>
        </span>
      ) : null}
    </span>
  );
}

export function AssigneePicker({
  people,
  selected,
  onToggle,
  disabled,
  lockedId,
}: {
  people: Person[];
  selected: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
  lockedId?: string;
}) {
  if (!people.length) return <p className="empty-col">Ninguém no projeto ainda.</p>;
  return (
    <div className="assignee-picks">
      {people.map((person) => {
        const locked = person.id === lockedId;
        const on = locked || selected.includes(person.id);
        return (
          <button
            key={person.id}
            type="button"
            className={`assignee-pick${on ? " on" : ""}${locked ? " locked" : ""}`}
            onClick={() => onToggle(person.id)}
            aria-pressed={on}
            disabled={disabled || locked}
            title={locked ? "Owner: sempre responsável" : undefined}
          >
            <Avatar person={person} size={22} />
            <span>{person.name}</span>
            {locked ? <small>owner</small> : null}
          </button>
        );
      })}
    </div>
  );
}

function RoleRow({
  label,
  selected,
  people,
  canEdit,
  lockedId,
  busy,
  onToggle,
  empty,
}: {
  label: string;
  selected: Person[];
  people: Person[];
  canEdit: boolean;
  lockedId?: string;
  busy?: boolean;
  onToggle?: (id: string) => void;
  empty: string;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="role-row">
      <span className="role-label">{label}</span>
      <div className="role-body">
        {editing && onToggle ? (
          <AssigneePicker
            people={people}
            selected={selected.map((person) => person.id)}
            onToggle={onToggle}
            disabled={busy}
            lockedId={lockedId}
          />
        ) : selected.length ? (
          <span className="role-people">
            {selected.map((person) => (
              <span key={person.id} className="role-person">
                <Avatar person={person} size={20} />
                {person.name}
              </span>
            ))}
          </span>
        ) : (
          <span className="role-empty">{empty}</span>
        )}
      </div>
      {canEdit && onToggle ? (
        <button type="button" className="text-btn role-edit" onClick={() => setEditing((value) => !value)}>
          {editing ? "pronto" : "editar"}
        </button>
      ) : null}
    </div>
  );
}

// Bloco "Pessoas" da task: owner (fixo), responsáveis e executores, cada um com o seu "editar".
export function PeopleRoles({
  owner,
  assignees,
  executors,
  people,
  canEditAssignees,
  canEditExecutors,
  busy,
  onToggleAssignee,
  onToggleExecutor,
}: {
  owner: Person;
  assignees: Person[];
  executors: Person[];
  people: Person[];
  canEditAssignees: boolean;
  canEditExecutors: boolean;
  busy?: boolean;
  onToggleAssignee?: (id: string) => void;
  onToggleExecutor?: (id: string) => void;
}) {
  return (
    <div className="people-roles">
      <div className="role-row">
        <span className="role-label">Owner</span>
        <div className="role-body">
          <span className="role-person">
            <Avatar person={owner} size={20} />
            {owner.name}
          </span>
        </div>
      </div>
      <RoleRow
        label="Responsáveis"
        selected={assignees}
        people={people}
        canEdit={canEditAssignees}
        lockedId={owner.id}
        busy={busy}
        onToggle={onToggleAssignee}
        empty="—"
      />
      <RoleRow
        label="Executores"
        selected={executors}
        people={people}
        canEdit={canEditExecutors}
        busy={busy}
        onToggle={onToggleExecutor}
        empty="Ninguém executando ainda"
      />
    </div>
  );
}
