import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

import { type TAnyColor, CUSTOM_SOLID, customColorStyle, isCustomColor } from "@/calendar/colors";

const eventBulletVariants = cva("size-2 rounded-full", {
  variants: {
    color: {
      blue: "bg-blue-600 dark:bg-blue-500",
      green: "bg-green-600 dark:bg-green-500",
      red: "bg-red-600 dark:bg-red-500",
      yellow: "bg-yellow-600 dark:bg-yellow-500",
      purple: "bg-purple-600 dark:bg-purple-500",
      gray: "bg-neutral-600 dark:bg-neutral-500",
      orange: "bg-orange-600 dark:bg-orange-500",
      amber: "bg-amber-500",
      brand: "bg-primary",
      custom: CUSTOM_SOLID,
    },
  },
  defaultVariants: {
    color: "blue",
  },
});

export function EventBullet({ color, className }: { color: TAnyColor; className: string }) {
  return (
    <div
      className={cn(eventBulletVariants({ color: isCustomColor(color) ? "custom" : color, className }))}
      style={customColorStyle(color)}
    />
  );
}
