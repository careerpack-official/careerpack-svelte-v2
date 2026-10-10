import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/shared/lib/utils"

const buttonVariants = cva(
  // `transition-all 150ms` + `hover:-translate-y-0.5 hover:shadow-md` +
  // `active:translate-y-0` gives every button a subtle lift on hover.
  // Brutalism presets read punchy (offset shadow + 2px border), refined
  // presets read polished (soft shadow + rounded) because the lift motion
  // is identical; only the theme tokens change.
  "inline-flex min-w-0 max-w-full min-h-[44px] items-center justify-center gap-2 whitespace-normal break-words rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 lg:min-h-0 lg:whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground hover:shadow-none hover:translate-y-0",
        link:
          "text-primary underline-offset-4 hover:underline hover:shadow-none hover:translate-y-0",
      },
      size: {
        default: "h-auto px-4 py-2 lg:h-9",
        sm: "h-auto rounded-md px-3 py-2 text-xs lg:h-8 lg:py-0",
        lg: "h-auto px-8 py-2 lg:h-10",
        icon: "h-[44px] w-[44px] min-w-[44px] shrink-0 lg:h-9 lg:w-9 lg:min-w-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
