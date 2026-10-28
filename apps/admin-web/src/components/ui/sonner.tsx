"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { LuCircleCheck, LuInfo, LuLoaderCircle, LuOctagonX, LuTriangleAlert } from "react-icons/lu";
import { cn } from "cn"

// Toasts for the admin and the storefront. Sonner keeps the positioning,
// stacking and swipe-to-dismiss; the card itself is fully styled here
// (`unstyled`): card in the theme's popover colour, coloured icon badge per type, title + description,
// small dark action button, close button on hover.

/** Round icon badge, tinted by toast type. */
function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", className)}>{children}</span>
  )
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      className="toaster group"
      closeButton
      gap={10}
      style={{ "--width": "380px" } as React.CSSProperties}
      icons={{
        success: (
          <Badge className="bg-emerald-100 text-emerald-700">
            <LuCircleCheck className="size-[18px]" strokeWidth={2} />
          </Badge>
        ),
        info: (
          <Badge className="bg-sky-100 text-sky-700">
            <LuInfo className="size-[18px]" strokeWidth={2} />
          </Badge>
        ),
        warning: (
          <Badge className="bg-amber-100 text-amber-700">
            <LuTriangleAlert className="size-[18px]" strokeWidth={2} />
          </Badge>
        ),
        error: (
          <Badge className="bg-red-100 text-red-700">
            <LuOctagonX className="size-[18px]" strokeWidth={2} />
          </Badge>
        ),
        loading: (
          <Badge className="bg-muted text-muted-foreground">
            <LuLoaderCircle className="size-[18px] animate-spin" strokeWidth={2} />
          </Badge>
        ),
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: cn(
            "group/toast flex w-[var(--width)] items-center gap-3 rounded-2xl border border-black/[0.06] bg-popover p-3.5 dark:border-white/10 pe-10 font-sans",
            "shadow-[0_12px_32px_-12px_rgb(0_0_0/0.22),0_2px_6px_-2px_rgb(0_0_0/0.06)]",
          ),
          // Fixed size: the loading spinner is positioned absolutely inside this slot.
          icon: "relative size-8 shrink-0 self-start",
          content: "grid min-w-0 flex-1 gap-0.5",
          title: "text-foreground text-sm leading-5 font-semibold",
          description: "text-[13px] leading-[18px] text-muted-foreground",
          actionButton: cn(
            "bg-foreground text-background hover:bg-foreground/85 shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
          ),
          cancelButton:
            "bg-muted text-foreground hover:bg-muted/70 shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
          closeButton: cn(
            // Top-right, shown on hover (always reachable with the keyboard).
            "!absolute !start-auto !end-2.5 !top-2.5 flex size-6 !translate-x-0 !translate-y-0 items-center justify-center rounded-md",
            "!border-0 !bg-transparent text-muted-foreground hover:!bg-muted hover:text-foreground",
            "opacity-0 transition-opacity group-hover/toast:opacity-100 focus-visible:opacity-100 [&>svg]:size-3.5",
          ),
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
