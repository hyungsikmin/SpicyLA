'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'

const PING_INTERVAL_MS = 2 * 60 * 1000

function getDevice(): 'mobile' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(ua)) return 'mobile'
  return 'desktop'
}

export default function VisitorPing() {
  const sessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const sid = sessionIdRef.current ?? (sessionIdRef.current = crypto.randomUUID?.() ?? `s${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const device = getDevice()
    const ping = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('visitor_pings').insert({ session_id: sid, user_id: user?.id ?? null, device })
    }
    ping()
    const t = setInterval(ping, PING_INTERVAL_MS)
    return () => clearInterval(t)
  }, [])

  return null
}
