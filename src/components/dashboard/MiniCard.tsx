import { Card } from "../ui/Card";
import { cn } from "../../utils/ui";
import { pillClasses } from "../../utils/dashboardFormat";
import type { MiniCardItem } from "../../types/dashboard";

export function MiniCard({ title, subtitle, value, status }: MiniCardItem) {
  const badge = status === "published" ? "Live" : "Info";

  return (
    <Card className="transition hover:shadow-md">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
          </div>
          <div className="h-8 w-8 rounded-xl bg-slate-100" />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-lg font-semibold text-slate-900">{value}</p>
          <span className={cn("rounded-full border px-3 py-1 text-xs", pillClasses(status))}>
            {badge}
          </span>
        </div>
      </div>
    </Card>
  );
}
