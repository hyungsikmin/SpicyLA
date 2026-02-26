"use client"

import * as React from "react"
import Image from "next/image"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import SiriOrb from "@/components/smoothui/siri-orb"
import confetti from "canvas-confetti"

export type BlurCarouselSlide = {
  icon?: React.ReactNode
  /** 첫 슬라이드에서 글로우 오브 안에 로고 표시 (icon 무시) */
  logoInOrb?: boolean
  title: string
  description: string
}

export type BlurCarouselModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  slides: BlurCarouselSlide[]
  onFinish: () => void
  nextLabel?: string
  finishLabel?: string
  /** logoInOrb 슬라이드에서 오브 안에 쓸 로고 이미지 경로 (예: /ani-ssap.png) */
  logoSrc?: string
  className?: string
}

export function BlurCarouselModal({
  open,
  onOpenChange,
  slides,
  onFinish,
  nextLabel = "다음",
  finishLabel = "커뮤니티 이용 약관을 준수하겠습니다",
  logoSrc = "/ani-ssap.png",
  className,
}: BlurCarouselModalProps) {
  const [index, setIndex] = React.useState(0)
  const isLast = index >= slides.length - 1
  const slide = slides[index]
  const useLogoOrb = slide?.logoInOrb === true

  React.useEffect(() => {
    if (!open) setIndex(0)
  }, [open])

  if (!open) return null

  const handleNext = async () => {
    if (isLast) {
      try {
        await confetti({ origin: { x: 0.5, y: 0.5 }, spread: 100, startVelocity: 30 })
      } catch (_) {}
      onFinish()
      onOpenChange(false)
    } else {
      setIndex((i) => i + 1)
    }
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/40",
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-label="온보딩"
    >
      <div
        className="w-full max-w-md h-[420px] rounded-2xl border border-border bg-card shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-h-0 p-6 pb-4 flex flex-col items-center justify-center text-center">
          {(useLogoOrb || slide?.icon) && (
            <div className="mb-4 shrink-0 flex items-center justify-center">
              {useLogoOrb ? (
                <div className="relative size-[84px]">
                  <SiriOrb size="84px" className="absolute inset-0" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Image
                      src={logoSrc}
                      alt=""
                      width={40}
                      height={40}
                      className="object-contain"
                    />
                  </span>
                </div>
              ) : (
                <div className="flex size-[84px] items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  {slide?.icon}
                </div>
              )}
            </div>
          )}
          <h2 className="text-lg font-bold text-foreground mb-2">
            {slide?.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {slide?.description}
          </p>
        </div>

        {slides.length > 1 && (
          <div className="flex justify-center gap-1.5 pb-4 shrink-0">
            {slides.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "inline-block h-1.5 rounded-full transition-all",
                  i === index
                    ? "w-5 bg-foreground"
                    : "w-1.5 bg-muted-foreground/40"
                )}
                aria-hidden
              />
            ))}
          </div>
        )}

        <div
          className={cn(
            "p-4 pt-0 flex items-center gap-3 shrink-0",
            isLast ? "justify-center" : "justify-end"
          )}
        >
          <Button
            type="button"
            onClick={handleNext}
            className="min-w-[120px]"
          >
            {isLast ? (
              finishLabel
            ) : (
              <>
                {nextLabel}
                <ChevronRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
