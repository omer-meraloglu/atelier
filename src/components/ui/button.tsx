import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-none border border-transparent text-[0.6875rem] font-medium uppercase tracking-[0.14em] whitespace-nowrap transition-all duration-300 outline-none select-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-oxblood",
        outline:
          "border-hairline bg-transparent hover:border-ink aria-expanded:border-ink",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost:
          "text-muted-foreground hover:text-foreground aria-expanded:text-foreground",
        destructive:
          "border-hairline text-oxblood hover:border-oxblood focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline normal-case tracking-normal text-sm",
      },
      size: {
        default: "h-10 gap-2 px-5",
        xs: "h-7 gap-1.5 px-3 text-[0.625rem] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-2 px-4",
        lg: "h-12 gap-2.5 px-8",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
