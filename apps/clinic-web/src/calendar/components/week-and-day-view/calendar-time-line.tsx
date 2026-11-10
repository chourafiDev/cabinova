import { fmt } from "@/calendar/locale";

import { useSyncExternalStore } from "react";

interface IProps {
  firstVisibleHour: number;
  lastVisibleHour: number;
}

const MINUTE = 60 * 1000;
const thisMinute = () => Math.floor(Date.now() / MINUTE);
const subscribe = (tick: () => void) => {
  const timer = setInterval(tick, MINUTE);
  return () => clearInterval(timer);
};

/** The browser's clock, so nothing of it is rendered on the server. */
export function CalendarTimeline({ firstVisibleHour, lastVisibleHour }: IProps) {
  const minute = useSyncExternalStore(subscribe, thisMinute, () => null);
  if (minute === null) return null;
  const currentTime = new Date(minute * MINUTE);

  const getCurrentTimePosition = () => {
    const minutes = currentTime.getHours() * 60 + currentTime.getMinutes();

    const visibleStartMinutes = firstVisibleHour * 60;
    const visibleEndMinutes = lastVisibleHour * 60;
    const visibleRangeMinutes = visibleEndMinutes - visibleStartMinutes;

    return ((minutes - visibleStartMinutes) / visibleRangeMinutes) * 100;
  };

  const formatCurrentTime = () => {
    return fmt(currentTime, "HH:mm");
  };

  const currentHour = currentTime.getHours();
  if (currentHour < firstVisibleHour || currentHour >= lastVisibleHour) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 z-50 border-t border-primary" style={{ top: `${getCurrentTimePosition()}%` }}>
      <div className="absolute start-0 top-0 size-3 -translate-x-1/2 rtl:translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"></div>
      <div className="absolute -start-18 flex w-16 -translate-y-1/2 justify-end bg-background pe-1 text-xs font-medium text-primary">{formatCurrentTime()}</div>
    </div>
  );
}
