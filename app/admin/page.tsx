'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { Flag, FileText, MessageSquare, Users, AlertCircle, Sparkles, UserCheck } from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'

export type VisitorChartPoint = { label: string; fullLabel: string; desktop: number; mobile: number }

const visitorChartConfig = {
  desktop: { label: '데스크톱', color: '#2563eb' },
  mobile: { label: '모바일', color: '#60a5fa' },
} satisfies ChartConfig

function VisitorAreaChart({ data }: { data: VisitorChartPoint[] }) {
  return (
    <ChartContainer config={visitorChartConfig} className="min-h-[260px] w-full">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 2" vertical={false} className="stroke-muted" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length || !payload[0]?.payload) return null
              const p = payload[0].payload as VisitorChartPoint
              return (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">
                  <p className="font-medium text-foreground">{p.fullLabel}</p>
                  <p className="text-muted-foreground mt-1">
                    데스크톱 {p.desktop}명 · 모바일 {p.mobile}명
                  </p>
                </div>
              )
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => visitorChartConfig[value as keyof typeof visitorChartConfig]?.label ?? value} />
          <Line type="monotone" dataKey="desktop" stroke="var(--color-desktop)" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="mobile" stroke="var(--color-mobile)" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

type Report = {
  id: string
  target_type: string | null
  target_id: string | null
  reason: string | null
  created_at: string
  resolved_at: string | null
}

type TierCount = { tier_id: string; tier_name: string; member_count: number }

export default function AdminDashboardPage() {
  const [counts, setCounts] = useState<{
    reports: number
    unresolved: number
    posts: number
    comments: number
    users: number
    businessTotal: number
    businessPending: number
  } | null>(null)
  const [recentReports, setRecentReports] = useState<Report[]>([])
  const [tierCounts, setTierCounts] = useState<TierCount[]>([])
  const [currentOnline, setCurrentOnline] = useState<number | null>(null)
  const [visitorChartData, setVisitorChartData] = useState<VisitorChartPoint[]>([])
  const [visitorFilter, setVisitorFilter] = useState<'today' | 'week' | 'date'>('today')
  const [visitorDate, setVisitorDate] = useState<string>(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    Promise.all([
      supabase.from('reports').select('id', { count: 'exact', head: true }),
      supabase.from('reports').select('id', { count: 'exact', head: true }).is('resolved_at', null),
      supabase.from('reports').select('id, target_type, target_id, reason, created_at, resolved_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('posts').select('id', { count: 'exact', head: true }),
      supabase.from('comments').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('user_id', { count: 'exact', head: true }),
      supabase.from('business_spotlight').select('id', { count: 'exact', head: true }).eq('approved', true),
      supabase.from('business_spotlight').select('id', { count: 'exact', head: true }).eq('approved', false),
    ]).then(([allReports, unresolved, recent, p, c, u, bizOk, bizPending]) => {
      setCounts({
        reports: allReports.count ?? 0,
        unresolved: unresolved.count ?? 0,
        posts: p.count ?? 0,
        comments: c.count ?? 0,
        users: u.count ?? 0,
        businessTotal: bizOk.count ?? 0,
        businessPending: bizPending.count ?? 0,
      })
      setRecentReports((recent.data ?? []) as Report[])
    })
  }, [])

  useEffect(() => {
    supabase.rpc('get_tier_member_counts').then(({ data }) => {
      setTierCounts((data ?? []) as TierCount[])
    })
  }, [])

  useEffect(() => {
    const fetchOnline = () => {
      supabase.rpc('get_current_online_count').then(({ data }) => setCurrentOnline(data ?? 0))
    }
    fetchOnline()
    const interval = setInterval(fetchOnline, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let start: Date
    let end: Date
    const isWeek = visitorFilter === 'week'
    if (visitorFilter === 'today') {
      start = new Date()
      start.setHours(0, 0, 0, 0)
      end = new Date()
      end.setHours(23, 59, 59, 999)
    } else if (isWeek) {
      end = new Date()
      start = new Date()
      start.setDate(start.getDate() - 6)
      start.setHours(0, 0, 0, 0)
    } else {
      start = new Date(visitorDate + 'T00:00:00')
      end = new Date(visitorDate + 'T23:59:59.999')
    }
    supabase
      .from('visitor_pings')
      .select('created_at, device')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .then(({ data }) => {
        const raw = (data ?? []) as { created_at: string; device: string | null }[]
        const isMobile = (r: { device: string | null }) => r.device === 'mobile'
        const localDateKey = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const localHourKey = (d: Date) =>
          `${localDateKey(d)}-${String(d.getHours()).padStart(2, '0')}`
        if (isWeek) {
          const byDay: Record<string, { desktop: number; mobile: number }> = {}
          const d = new Date(start)
          while (d <= end) {
            byDay[localDateKey(d)] = { desktop: 0, mobile: 0 }
            d.setDate(d.getDate() + 1)
          }
          raw.forEach((r) => {
            const key = localDateKey(new Date(r.created_at))
            if (byDay[key]) {
              if (isMobile(r)) byDay[key].mobile++
              else byDay[key].desktop++
            }
          })
          const sorted = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b))
          setVisitorChartData(
            sorted.map(([dateStr, counts]) => {
              const [y, m, day] = dateStr.split('-').map(Number)
              const d = new Date(y, m - 1, day)
              const label = `${m}/${day}`
              const fullLabel = d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
              return { label, fullLabel, desktop: counts.desktop, mobile: counts.mobile }
            })
          )
        } else {
          const byHour: Record<string, { desktop: number; mobile: number }> = {}
          const d = new Date(start)
          d.setMinutes(0, 0, 0)
          while (d <= end) {
            byHour[localHourKey(d)] = { desktop: 0, mobile: 0 }
            d.setHours(d.getHours() + 1)
          }
          raw.forEach((r) => {
            const key = localHourKey(new Date(r.created_at))
            if (byHour[key]) {
              if (isMobile(r)) byHour[key].mobile++
              else byHour[key].desktop++
            }
          })
          const sorted = Object.entries(byHour).sort(([a], [b]) => a.localeCompare(b))
          setVisitorChartData(
            sorted.map(([key, counts]) => {
              const [y, m, day, h] = key.split('-').map(Number)
              const d = new Date(y, m - 1, day, h)
              const label = `${h}시`
              const fullLabel = d.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
              return { label, fullLabel, desktop: counts.desktop, mobile: counts.mobile }
            })
          )
        }
      })
  }, [visitorFilter, visitorDate])

  if (counts === null) {
    return <p className="text-muted-foreground">불러오는 중…</p>
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">대시보드</h1>

      {counts.unresolved > 0 && (
        <Link href="/admin/reports" className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
          <AlertCircle className="size-8 text-red-500 dark:text-red-400 shrink-0" />
          <div>
            <p className="font-medium text-foreground">미처리 신고 {counts.unresolved}건</p>
            <p className="text-sm text-muted-foreground">신고 목록에서 확인하고 처리해 주세요.</p>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Link href="/admin/reports" className="rounded-xl border border-border bg-card p-4 hover:bg-muted/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">신고</span>
            <Flag className="size-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-semibold mt-2">{counts.reports}</p>
          {counts.unresolved > 0 && <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">미처리 {counts.unresolved}건</p>}
        </Link>
        <Link href="/admin/posts" className="rounded-xl border border-border bg-card p-4 hover:bg-muted/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">게시글</span>
            <FileText className="size-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-semibold mt-2">{counts.posts}</p>
        </Link>
        <Link href="/admin/comments" className="rounded-xl border border-border bg-card p-4 hover:bg-muted/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">댓글</span>
            <MessageSquare className="size-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-semibold mt-2">{counts.comments}</p>
        </Link>
        <Link href="/admin/users" className="rounded-xl border border-border bg-card p-4 hover:bg-muted/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">유저</span>
            <Users className="size-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-semibold mt-2">{counts.users}</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Link href="/admin/business" className="rounded-xl border border-border bg-card p-4 hover:bg-muted/30 transition-colors flex items-center gap-3">
          <Sparkles className="size-8 text-amber-500 dark:text-amber-400 shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">등록된 비즈니스</p>
            <p className="text-2xl font-semibold">{counts.businessTotal}개</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm text-muted-foreground">승인 대기</p>
            <p className="text-xl font-semibold">{counts.businessPending}건</p>
          </div>
        </Link>
      </div>

      {tierCounts.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">등급별 회원 수</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {tierCounts.map((t) => (
              <div key={t.tier_id} className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground truncate">{t.tier_name}</p>
                <p className="text-xl font-semibold mt-1">{Number(t.member_count)}명</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">방문자 수</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {visitorFilter === 'today' && '오늘 24시간'}
            {visitorFilter === 'week' && '지난 7일'}
            {visitorFilter === 'date' && `${visitorDate} 기준`}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2 mt-4 mb-4">
            <p className="text-sm mr-auto">
              <span className="text-muted-foreground">현재 접속 (5분 이내): </span>
              <span className="font-semibold">{currentOnline ?? '…'}명</span>
            </p>
            <button
              type="button"
              onClick={() => setVisitorFilter('today')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${visitorFilter === 'today' ? 'bg-foreground text-background border-foreground' : 'bg-background border-border hover:bg-muted/60'}`}
            >
              오늘
            </button>
            <button
              type="button"
              onClick={() => setVisitorFilter('week')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${visitorFilter === 'week' ? 'bg-foreground text-background border-foreground' : 'bg-background border-border hover:bg-muted/60'}`}
            >
              지난 7일
            </button>
            <button
              type="button"
              onClick={() => setVisitorFilter('date')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${visitorFilter === 'date' ? 'bg-foreground text-background border-foreground' : 'bg-background border-border hover:bg-muted/60'}`}
            >
              날짜 지정
            </button>
            {visitorFilter === 'date' && (
              <input
                type="date"
                value={visitorDate}
                onChange={(e) => setVisitorDate(e.target.value)}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
            )}
          </div>
          {visitorChartData.length > 0 ? (
            <div className="w-full overflow-x-auto min-h-[240px]">
              <VisitorAreaChart data={visitorChartData} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8">해당 기간 접속 기록이 없습니다.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">최근 신고</h2>
        {recentReports.length === 0 ? (
          <p className="text-sm text-muted-foreground">최근 신고가 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {recentReports.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString('ko-KR')}</span>
                <span>{r.target_type} · {r.reason?.slice(0, 30) ?? '-'}{r.reason && r.reason.length > 30 ? '…' : ''}</span>
                <Link href="/admin/reports" className="shrink-0 text-red-500 dark:text-red-400 hover:underline text-xs font-medium">
                  보기
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
