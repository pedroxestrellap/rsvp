import type React from "react";
import { cn } from "../../utils/ui";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      {children}
    </article>
  );
}
