import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // Colour + shimmer come from .skeleton-shimmer in globals.css (tuned per light/dark).
      className={cn("skeleton-shimmer rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
