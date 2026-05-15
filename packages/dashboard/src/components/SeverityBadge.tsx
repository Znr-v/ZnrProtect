import clsx from "clsx";

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const colors: Record<Severity, string> = {
  LOW: "bg-green-500/20 text-green-400",
  MEDIUM: "bg-yellow-500/20 text-yellow-400",
  HIGH: "bg-orange-500/20 text-orange-400",
  CRITICAL: "bg-red-500/20 text-red-400",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", colors[severity])}>
      {severity}
    </span>
  );
}
