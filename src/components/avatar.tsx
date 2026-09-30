"use client";

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
  showOwner = true,
  size = 20,
}: {
  owner: Person;
  assignees: Person[];
  showOwner?: boolean;
  size?: number;
}) {
  const others = assignees.filter((person) => person.id !== owner.id);
  if (!showOwner && !others.length) return null;
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
