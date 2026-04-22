import { STATUS_CLASSES, STATUS_LABELS, type Status } from "@/lib/types";

export function StatusBadge({ status, large = false }: { status: Status; large?: boolean }) {
  const size = large
    ? "text-sm px-3 py-1 font-semibold"
    : "text-xs px-2.5 py-0.5 font-medium";
  return (
    <span className={`inline-flex items-center rounded-full ${size} ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
