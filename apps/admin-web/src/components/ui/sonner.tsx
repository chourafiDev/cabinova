"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert } from "lucide-react"
import { cn } from "cn"

// Toasts for the admin and the storefront. Sonner keeps the positioning,
// stacking and swipe-to-dismiss; the card itself is fully styled here
// (`unstyled`): white card, coloured icon badge per type, title + description,
// small dark action button, close button on hover.

/** Round icon badge, tinted by toast type. */
function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", className)}>{children}</span>
  )
}

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      // The app is light-only: don't follow the OS dark mode (it would turn
      // descriptions light grey on our white cards).
      theme="light"
      className="toaster group"
      closeButton
      gap={10}
      style={{ "--width": "380px" } as React.CSSProperties}
      icons={{
        success: (
          <Badge className="bg-emerald-100 text-emerald-700">
            <CircleCheck className="size-[18px]" strokeWidth={2} />
          </Badge>
        ),
        info: (
          <Badge className="bg-sky-100 text-sky-700">
            <Info className="size-[18px]" strokeWidth={2} />
          </Badge>
        ),
        warning: (
          <Badge className="bg-amber-100 text-amber-700">
            <TriangleAlert className="size-[18px]" strokeWidth={2} />
          </Badge>
        ),
        error: (
          <Badge className="bg-red-100 text-red-700">
            <OctagonX className="size-[18px]" strokeWidth={2} />
          </Badge>
        ),
        loading: (
          <Badge className="bg-muted text-muted-foreground">
            <Loader2 className="size-[18px] animate-spin" strokeWidth={2} />
          </Badge>
        ),
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: cn(
            "group/toast flex w-[var(--width)] items-center gap-3 rounded-2xl border border-black/[0.06] bg-white p-3.5 pe-10 font-sans",
            "shadow-[0_12px_32px_-12px_rgb(0_0_0/0.22),0_2px_6px_-2px_rgb(0_0_0/0.06)]",
          ),
          // Fixed size: the loading spinner is positioned absolutely inside this slot.
          icon: "relative size-8 shrink-0 self-start",
          content: "grid min-w-0 flex-1 gap-0.5",
          title: "text-foreground text-sm leading-5 font-semibold",
          description: "text-[13px] leading-[18px] text-neutral-500",
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
