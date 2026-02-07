'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type ChartConfig = {
  [k: string]: {
    label?: React.ReactNode
    color?: string
  }
}

type ChartContainerProps = React.ComponentProps<'div'> & {
  config: ChartConfig
  children: React.ReactNode
}

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ config, className, children, style, ...props }, ref) => {
    const varStyle = React.useMemo(() => {
      const s: Record<string, string> = {}
      Object.entries(config).forEach(([key, c]) => {
        if (c?.color) s[`--color-${key}` as string] = c.color
      })
      return { ...(style as object), ...s }
    }, [config, style])

    return (
      <div ref={ref} className={cn('w-full', className)} style={varStyle} {...props}>
        {children}
      </div>
    )
  }
)
ChartContainer.displayName = 'ChartContainer'

export { ChartContainer }
