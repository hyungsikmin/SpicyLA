'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function ShareButton() {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback for older browsers
      if (typeof window !== 'undefined') {
        window.prompt('링크를 복사하세요:', url)
      }
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleShare}
      title="링크 복사"
      className="shrink-0"
    >
      {copied ? (
        <span className="text-sm">복사됨</span>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      )}
    </Button>
  )
}
