'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import type { BannerSlotKey } from '@/lib/bannerSlots'

type BannerAdRow = {
  id: string
  image_url: string
  link_url: string
  alt_text: string | null
}

export default function BannerAd({
  slotKey,
  rotationIntervalSeconds = 0,
}: {
  slotKey: BannerSlotKey
  /** 로테이션 전환 간격(초). 0이면 마운트 시 한 번만 랜덤 선택. */
  rotationIntervalSeconds?: number
}) {
  const [list, setList] = useState<BannerAdRow[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const now = new Date().toISOString()
    supabase
      .from('banner_ads')
      .select('id, image_url, link_url, alt_text')
      .eq('slot_key', slotKey)
      .lte('starts_at', now)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        const rows = (data ?? []) as BannerAdRow[]
        setList(rows)
        setCurrentIndex(0)
      })
  }, [slotKey])

  useEffect(() => {
    if (list.length <= 1 || rotationIntervalSeconds <= 0) return
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % list.length)
    }, rotationIntervalSeconds * 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [list.length, rotationIntervalSeconds])

  const ad =
    list.length === 0
      ? null
      : list.length === 1 || rotationIntervalSeconds <= 0
        ? list[0]
        : list[currentIndex] ?? list[0]

  if (!ad) return null

  const isExternal = ad.link_url.startsWith('http://') || ad.link_url.startsWith('https://')

  return (
    <aside className="w-full overflow-hidden" aria-label="배너 광고">
      {isExternal ? (
        <a
          href={ad.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full"
        >
          <img
            src={ad.image_url}
            alt={ad.alt_text ?? '광고'}
            className="w-full max-w-[600px] mx-auto h-auto object-cover max-h-[120px]"
          />
        </a>
      ) : (
        <Link href={ad.link_url} className="block w-full">
          <img
            src={ad.image_url}
            alt={ad.alt_text ?? '광고'}
            className="w-full max-w-[600px] mx-auto h-auto object-cover max-h-[120px]"
          />
        </Link>
      )}
    </aside>
  )
}
