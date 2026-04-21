import { STATUS_CLASSES, STATUS_LABELS, type Status } from "@/lib/types";

export function StatusBadge({ status, large = false }: { status: Status; large?: boolean }) {
  const base = "inline-flex items-center font-medium rounded-full";
  const size = large ? "text-sm px-3 py-1" : "text-xs px-2.5 py-0.5";
  return (
    <span className={`${base} ${size} ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
