'use client'

import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Sparkles, ExternalLink } from 'lucide-react'
import { getBusinessSpotlightMediaUrl } from '@/lib/storage'

const IMAGE_MAX_BYTES = 3 * 1024 * 1024   // 3MB
const VIDEO_MAX_BYTES = 10 * 1024 * 1024 // 10MB

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  )
}

function normalizeWebsite(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  if (/^https?:\/\//i.test(s)) return s
  return 'https://' + s.replace(/^\/+/, '')
}

function normalizeInstagram(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  if (/^https?:\/\//i.test(s)) return s
  const handle = s.replace(/^@/, '').replace(/\/$/, '').split('/').pop() ?? s
  return `https://instagram.com/${handle}`
}

type Business = {
  id: string
  business_name: string
  one_liner: string | null
  link_url: string | null
  instagram_url: string | null
  media_path: string | null
  media_type: string | null
  created_at: string
}

export default function SupportPage() {
  const [user, setUser] = useState<User | null>(null)
  const [list, setList] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formName, setFormName] = useState('')
  const [formOneLiner, setFormOneLiner] = useState('')
  const [formContact, setFormContact] = useState('')
  const [formContactPrivate, setFormContactPrivate] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formEmailPrivate, setFormEmailPrivate] = useState(false)
  const [formWebsite, setFormWebsite] = useState('')
  const [formInstagram, setFormInstagram] = useState('')
  const [formFile, setFormFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const load = () => {
    setLoading(true)
    supabase
      .from('business_spotlight')
      .select('id, business_name, one_liner, link_url, instagram_url, media_path, media_type, created_at')
      .eq('approved', true)
      .eq('is_hidden', false)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setList((data ?? []) as Business[])
        setLoading(false)
      })
  }

  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  useEffect(() => {
    load()
  }, [])
  useEffect(() => {
    if (!user) {
      setAlreadyRegistered(false)
      return
    }
    supabase.from('business_spotlight').select('id').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      setAlreadyRegistered(!!data)
    })
  }, [user?.id])

  const validateFile = (file: File): string | null => {
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) return '이미지 또는 동영상만 첨부할 수 있어요.'
    if (isImage && file.size > IMAGE_MAX_BYTES) return '이미지는 3MB 이하로 올려 주세요.'
    if (isVideo && file.size > VIDEO_MAX_BYTES) return '동영상은 10MB 이하로 올려 주세요.'
    return null
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null)
    const f = e.target.files?.[0]
    if (!f) {
      setFormFile(null)
      return
    }
    const err = validateFile(f)
    if (err) {
      setFileError(err)
      setFormFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setFormFile(f)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!user || !formName.trim() || !formOneLiner.trim() || !formContact.trim() || !formEmail.trim()) return
    if (alreadyRegistered) {
      setFormError('한 계정당 비즈니스 1개만 등록할 수 있어요.')
      return
    }
    if (formFile) {
      const err = validateFile(formFile)
      if (err) {
        setFileError(err)
        return
      }
    }
    const linkUrl = normalizeWebsite(formWebsite)
    const instagramUrl = normalizeInstagram(formInstagram)

    const { data: existing } = await supabase.from('business_spotlight').select('id').eq('user_id', user.id).limit(1)
    if (existing?.length) {
      setFormError('한 계정당 비즈니스 1개만 등록할 수 있어요.')
      return
    }
    if (linkUrl) {
      const { data: dupLink } = await supabase.from('business_spotlight').select('id').eq('link_url', linkUrl).limit(1)
      if (dupLink?.length) {
        setFormError('이미 등록된 웹사이트 주소예요.')
        return
      }
    }
    if (instagramUrl) {
      const { data: dupInsta } = await supabase.from('business_spotlight').select('id').eq('instagram_url', instagramUrl).limit(1)
      if (dupInsta?.length) {
        setFormError('이미 등록된 인스타 주소예요.')
        return
      }
    }

    setSubmitting(true)
    setFileError(null)

    let mediaPath: string | null = null
    let mediaType: string | null = null
    if (formFile && user) {
      const ext = formFile.name.split('.').pop()?.toLowerCase() || (formFile.type.startsWith('video/') ? 'mp4' : 'jpg')
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('business-spotlight').upload(path, formFile, { upsert: false })
      if (uploadErr) {
        setFileError('업로드에 실패했어요. 다시 시도해 주세요.')
        setSubmitting(false)
        return
      }
      mediaPath = path
      mediaType = formFile.type.startsWith('video/') ? 'video' : 'image'
    }

    const { error } = await supabase.from('business_spotlight').insert({
      user_id: user.id,
      business_name: formName.trim(),
      one_liner: formOneLiner.trim(),
      contact: formContact.trim(),
      contact_private: formContactPrivate,
      email: formEmail.trim(),
      email_private: formEmailPrivate,
      link_url: linkUrl,
      instagram_url: instagramUrl,
      media_path: mediaPath,
      media_type: mediaType,
      approved: false,
    })
    setSubmitting(false)
    if (error) {
      setFormError('등록에 실패했어요. 다시 시도해 주세요.')
      return
    }
    setFormName('')
    setFormOneLiner('')
    setFormContact('')
    setFormContactPrivate(false)
    setFormEmail('')
    setFormEmailPrivate(false)
    setFormWebsite('')
    setFormInstagram('')
    setFormFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setSubmitSuccess(true)
    load()
    setTimeout(() => setSubmitSuccess(false), 3000)
  }

  return (
    <main className="min-h-screen max-w-[600px] mx-auto border-x border-border bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 px-4 h-14 border-b border-border bg-background/80 backdrop-blur-md">
        <Link href="/" className="shrink-0 size-9 rounded-full flex items-center justify-center text-foreground hover:bg-muted" aria-label="홈으로">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold truncate">자영업·스타트업</h1>
      </header>

      <section className="px-4 py-6 border-b border-border bg-gradient-to-b from-red-500/10 to-transparent dark:from-red-500/8 dark:to-transparent">
        <div className="flex items-start gap-3">
          <span className="shrink-0 size-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 dark:text-red-400" aria-hidden>
            <Sparkles className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground leading-tight">
              LA 20·30 자영업·스타트업 응원해요
            </h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              여기서 청춘들의 비즈니스를 소개하고, 함께 응원해요. 내 일도 알리고 싶다면 로그인 후 소개를 등록해 주세요.
            </p>
          </div>
        </div>
      </section>

      {user ? (
        <section className="px-4 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground mb-3">내 비즈니스 소개하기</h3>
          {alreadyRegistered ? (
            <p className="text-sm text-muted-foreground py-2">이미 비즈니스를 등록하셨습니다.</p>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="bs-name" className="block text-xs text-muted-foreground mb-1">비즈니스 이름 *</label>
              <input
                id="bs-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="예: 청춘카페"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label htmlFor="bs-oneliner" className="block text-xs text-muted-foreground mb-1">한 줄 소개 *</label>
              <input
                id="bs-oneliner"
                type="text"
                value={formOneLiner}
                onChange={(e) => setFormOneLiner(e.target.value)}
                placeholder="예: LA에서 한인 청년들이 운영하는 카페"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label htmlFor="bs-contact" className="block text-xs text-muted-foreground mb-1">연락처 *</label>
              <input
                id="bs-contact"
                type="text"
                value={formContact}
                onChange={(e) => setFormContact(e.target.value)}
                placeholder="비공개 선택시 운영자에게만 공개됩니다"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
              <label className="inline-flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <input type="checkbox" checked={formContactPrivate} onChange={(e) => setFormContactPrivate(e.target.checked)} className="rounded border-border" />
                연락처 비공개 (운영자에게만 공개)
              </label>
            </div>
            <div>
              <label htmlFor="bs-email" className="block text-xs text-muted-foreground mb-1">이메일 *</label>
              <input
                id="bs-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="비공개 선택시 운영자에게만 공개됩니다"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
              <label className="inline-flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <input type="checkbox" checked={formEmailPrivate} onChange={(e) => setFormEmailPrivate(e.target.checked)} className="rounded border-border" />
                이메일 비공개 (운영자에게만 공개)
              </label>
            </div>
            <div>
              <label htmlFor="bs-website" className="block text-xs text-muted-foreground mb-1">웹사이트 주소 (선택)</label>
              <input
                id="bs-website"
                type="text"
                value={formWebsite}
                onChange={(e) => setFormWebsite(e.target.value)}
                placeholder="www.예시.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="bs-instagram" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <InstagramIcon className="size-3.5" />
                인스타 주소 (선택)
              </label>
              <input
                id="bs-instagram"
                type="text"
                value={formInstagram}
                onChange={(e) => setFormInstagram(e.target.value)}
                placeholder="instagram.com/계정 또는 @계정"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">동영상 또는 이미지 1개 (선택)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={onFileChange}
                className="w-full text-sm file:mr-2 file:rounded-full file:border-0 file:bg-muted file:px-4 file:py-2 file:text-sm file:font-medium"
              />
              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">
                이미지 3MB 이하, 동영상 10MB 이하. 1개만 첨부 가능합니다.
              </p>
              {fileError && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{fileError}</p>}
              {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}
              {formFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  선택됨: {formFile.name} ({(formFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
            <Button type="submit" disabled={submitting} className="w-full rounded-full">
              {submitting ? '등록 중…' : submitSuccess ? '등록됐어요 ✓' : '소개 등록하기'}
            </Button>
          </form>
          )}
        </section>
      ) : (
        <section className="px-4 py-4 border-b border-border">
          <p className="text-sm text-muted-foreground mb-3">비즈니스를 소개하려면 로그인해 주세요.</p>
          <Button asChild className="rounded-full">
            <Link href="/login?from=/support">로그인</Link>
          </Button>
        </section>
      )}

      <section className="px-4 py-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">소개된 비즈니스</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 소개된 비즈니스가 없어요. 첫 소개를 등록해 보세요!</p>
        ) : (
          <ul className="space-y-3">
            {list.map((b) => {
              const websiteUrl = b.link_url?.trim() ? (b.link_url.startsWith('http') ? b.link_url : `https://${b.link_url}`) : null
              const instaUrl = b.instagram_url?.trim() ? (b.instagram_url.startsWith('http') ? b.instagram_url : `https://${b.instagram_url}`) : null
              const mediaUrl = getBusinessSpotlightMediaUrl(b.media_path)
              const cardClass = 'block rounded-xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors'
              return (
                <li key={b.id}>
                  <div className={cardClass}>
                    {mediaUrl && (
                      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted mb-3">
                        {b.media_type === 'video' ? (
                          <video src={mediaUrl} controls className="w-full h-full object-contain" />
                        ) : (
                          <Image src={mediaUrl} alt="" fill className="object-cover" sizes="(max-width: 600px) 100vw, 600px" />
                        )}
                      </div>
                    )}
                    <p className="text-sm font-medium text-foreground">{b.business_name}</p>
                    {b.one_liner && (
                      <p className="text-xs text-muted-foreground mt-1">{b.one_liner}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      {websiteUrl && (
                        <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-red-500 dark:text-red-400 hover:underline">
                          <ExternalLink className="size-3" /> 웹사이트
                        </a>
                      )}
                      {instaUrl && (
                        <a href={instaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-red-500 dark:text-red-400 hover:underline">
                          <InstagramIcon className="size-3.5" /> 인스타
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
