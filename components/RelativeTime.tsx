'use client'

import { useState, useEffect } from 'react'
import { getRelativeTime } from '@/lib/relativeTime'

export default function RelativeTime({ date }: { date: string }) {
  const [label, setLabel] = useState(() => getRelativeTime(date))
  useEffect(() => {
    const t = setInterval(() => setLabel(getRelativeTime(date)), 60_000)
    return () => clearInterval(t)
  }, [date])
  return <span className="text-xs text-muted-foreground">{label}</span>
}
