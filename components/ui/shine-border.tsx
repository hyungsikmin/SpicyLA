"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface ShineBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Width of the border in pixels
   * @default 1
   */
  borderWidth?: number
  /**
   * Duration of the animation in seconds
   * @default 14
   */
  duration?: number
  /**
   * Color of the border, can be a single color or an array of colors
   * @default "#000000"
   */
  shineColor?: string | string[]
}

function getShineGradient(shineColor: string | string[]): string {
  if (Array.isArray(shineColor) && shineColor.length > 0) {
    const colors = shineColor
    if (colors.length === 1) {
      const c = colors[0]!
      return `linear-gradient(105deg, transparent 0%, transparent 30%, ${c} 45%, ${c} 55%, transparent 70%, transparent 100%)`
    }
    const segment = 30 / colors.length
    const parts: string[] = ["transparent 0%", "transparent 25%"]
    colors.forEach((c, i) => {
      const start = 25 + i * segment
      const end = 25 + (i + 1) * segment
      parts.push(`${c} ${start}%`, `${c} ${end}%`)
    })
    parts.push("transparent 55%", "transparent 100%")
    return `linear-gradient(105deg, ${parts.join(", ")})`
  }
  const color = typeof shineColor === "string" ? shineColor : "#94a3b8"
  return `linear-gradient(105deg, transparent 0%, transparent 30%, ${color} 45%, ${color} 55%, transparent 70%, transparent 100%)`
}

/**
 * Shine Border
 *
 * Animated border effect. Renders as a full-size layer; use with a sibling that has
 * inset by borderWidth so the gradient shows in the ring (no mask).
 */
export function ShineBorder({
  borderWidth = 1,
  duration = 14,
  shineColor = "#000000",
  className,
  style,
  ...props
}: ShineBorderProps) {
  return (
    <div
      style={
        {
          "--border-width": `${borderWidth}px`,
          "--duration": `${duration}s`,
          backgroundImage: getShineGradient(shineColor),
          backgroundSize: "400% 400%",
          animation: "shine var(--duration) infinite linear",
          padding: "var(--border-width)",
          ...style,
        } as React.CSSProperties
      }
      className={cn(
        "pointer-events-none absolute inset-0 size-full rounded-[inherit] will-change-[background-position] motion-safe:animate-shine",
        className
      )}
      {...props}
    />
  )
}
