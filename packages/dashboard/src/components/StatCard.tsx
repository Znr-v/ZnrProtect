import clsx from "clsx";

type Props = {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: "green" | "yellow" | "red" | "blue" | "gray";
};

const colorMap = {
  green: "text-green-400",
  yellow: "text-yellow-400",
  red: "text-red-400",
  blue: "text-discord",
  gray: "text-gray-100",
};

export function StatCard({ label, value, subtitle, color = "gray" }: Props) {
  return (
    <div className="bg-dark-800 rounded-xl p-5 border border-dark-700">
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className={clsx("text-2xl font-bold", colorMap[color])}>{value}</p>
      {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
    </div>
  );
}
