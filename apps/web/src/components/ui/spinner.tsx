import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"

interface SpinnerProps {
  className?: string
  size?: number
}

function Spinner({ className, size = 16 }: SpinnerProps) {
  return (
    <HugeiconsIcon 
      icon={Loading03Icon} 
      size={size}
      role="status" 
      aria-label="Loading" 
      className={cn("animate-spin", className)} 
    />
  )
}

export { Spinner }