"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useCalendar } from "@/calendar/contexts/calendar-context";
import { IconChevronDown } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api-client";
import { type Act, actSwatch } from "@/lib/payments";
import { cn } from "@/lib/utils";

/**
 * Act filter: tick the acts to show (Paramètres › Tarifs), each with its
 * agenda colour; none ticked shows them all. An appointment matches by its motif.
 */
export function ActFilter() {
  const { selectedActs, setSelectedActs } = useCalendar();
  const t = useTranslations("agenda.actFilter");
  // The same list as the booking form's motif.
  const acts = useQuery({ queryKey: ["acts"], queryFn: () => api<Act[]>("/acts") });
  const list = acts.data ?? [];
  if (acts.isSuccess && list.length === 0) return null;

  const isOn = (name: string) => selectedActs.some((a) => a.toLowerCase() === name.toLowerCase());
  const toggle = (name: string, on: boolean) =>
    setSelectedActs(
      // Kept in the price list's order, whatever the order of the clicks.
      list.map((a) => a.name).filter((n) => (n === name ? on : isOn(n))),
    );
  const chosen = list.filter((a) => isOn(a.name));
  const label = chosen.length === 0 ? t("all") : chosen.length === 1 ? chosen[0].name : t("some", { count: chosen.length });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-9 w-full justify-between gap-2 font-normal sm:w-52", chosen.length > 0 && "border-primary")}
          aria-label={t("label")}
        >
          <span className="flex min-w-0 items-center gap-2">
            {chosen.length > 0 && (
              <span className="flex shrink-0 -space-x-0.5">
                {chosen.slice(0, 4).map((a) => (
                  <span key={a.id} className={cn("ring-background size-2 rounded-full ring-1", actSwatch(a.color).className)} style={actSwatch(a.color).style} />
                ))}
              </span>
            )}
            <span className="truncate">{label}</span>
          </span>
          <IconChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1">
        <ul role="group" aria-label={t("label")} className="max-h-72 overflow-y-auto">
          {list.map((a) => (
            <li key={a.id}>
              <label className="hover:bg-muted flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm">
                <Checkbox checked={isOn(a.name)} onCheckedChange={(on) => toggle(a.name, on === true)} aria-label={a.name} />
                <span className={cn("size-2 shrink-0 rounded-full", actSwatch(a.color).className)} style={actSwatch(a.color).style} />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
              </label>
            </li>
          ))}
        </ul>
        {chosen.length > 0 && (
          <div className="mt-1 border-t pt-1">
            <Button variant="ghost" size="sm" className="text-muted-foreground w-full" onClick={() => setSelectedActs([])}>
              {t("reset")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
