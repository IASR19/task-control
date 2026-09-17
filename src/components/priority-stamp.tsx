import type { Priority } from "@/lib/types";
import { stampFor } from "@/lib/priority";

export function PriorityStamp({
  priority,
  large = false,
}: {
  priority: Priority;
  large?: boolean;
}) {
  return (
    <span className={`stamp stamp-${priority} ${large ? "stamp-lg" : ""}`} title={`Prioridade ${stampFor(priority)}`}>
      {stampFor(priority)}
    </span>
  );
}
