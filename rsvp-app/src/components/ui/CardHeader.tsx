import type React from "react";

export function CardHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {action}
    </div>
  );
}
