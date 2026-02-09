'use client'

import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

const MAX_IMAGES = 3
const POLL_OPTION_MAX_LEN = 25
const CATEGORIES = [
  { value: 'work', label: '💼 일' },
  { value: 'eat', label: '🍴 먹' },
  { value: 'home', label: '🏠 집' },
  { value: 'story', label: '🔥 썰' },
] as const
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']

type ImagePreview = { file: File; preview: string }

function getExtension(type: string): string {
  if (type === 'image/jpeg' || type === 'image/jpg') return 'jpg'
  if (type === 'image/png') return 'png'
  if (type === 'image/gif') return 'gif'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

export default function WriteForm({
  user,
  onSuccess,
  onCancel,
}: {
  user: { id: string } | null
  onSuccess: () => void
  onCancel?: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<string>('story')
  const [isSpicy, setIsSpicy] = useState(false)
  const [images, setImages] = useState<ImagePreview[]>([])
  const [addModuleType, setAddModuleType] = useState<'none' | 'poll'>('none')
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOption1, setPollOption1] = useState('')
  const [pollOption2, setPollOption2] = useState('')
  const [pollOption3, setPollOption3] = useState('')
  const [pollOption4, setPollOption4] = useState('')
  const [pollOptionCount, setPollOptionCount] = useState<2 | 3 | 4>(2) // 2 = 찬/반, 3+ = 일반 투표
  const [pollEnds24h, setPollEnds24h] = useState(false)

  const addImages = (files: FileList | null) => {
    if (!files?.length) return
    setError(null)
    const toAdd: ImagePreview[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (images.length + toAdd.length >= MAX_IMAGES) break
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`지원하지 않는 형식이에요: ${file.name}. (jpeg, png, gif, webp만 가능)`)
        continue
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError(`파일 크기는 5MB 이하여야 해요: ${file.name}`)
        continue
      }
      toAdd.push({ file, preview: URL.createObjectURL(file) })
    }
    setImages((prev) => [...prev, ...toAdd].slice(0, MAX_IMAGES))
  }

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index)
      URL.revokeObjectURL(prev[index].preview)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!title.trim()) {
      setError('제목을 입력해 주세요.')
      return
    }
    if (!body.trim()) {
      setError('내용을 입력해 주세요.')
      return
    }
    if (addModuleType === 'poll') {
      if (!pollQuestion.trim()) {
        setError('투표 질문을 입력해 주세요.')
        return
      }
      if (!pollOption1.trim() || !pollOption2.trim()) {
        setError('투표 옵션은 최소 2개 필요해요.')
        return
      }
      const opts = [pollOption1, pollOption2, pollOption3, pollOption4].slice(0, pollOptionCount)
      if (opts.some((o) => o.length > POLL_OPTION_MAX_LEN)) {
        setError(`옵션은 ${POLL_OPTION_MAX_LEN}자까지 입력할 수 있어요.`)
        return
      }
      if (pollOptionCount > 2 && opts.some((o, i) => i >= 2 && !o.trim())) {
        setError('추가한 옵션을 모두 입력해 주세요.')
        return
      }
    }
    const cat = ['work', 'eat', 'home', 'story'].includes(category) ? category : 'story'
    setError(null)
    setSubmitting(true)

    const { data: post, error: insertError } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        title: title.trim(),
        body: body.trim(),
        is_spicy: isSpicy,
        category: cat,
      })
      .select('id')
      .single()

    if (insertError || !post) {
      setSubmitting(false)
      setError(insertError?.message ?? '글 저장에 실패했어요.')
      return
    }

    const postId = post.id
    if (images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const { file } = images[i]
        const ext = getExtension(file.type)
        const path = `${postId}/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(path, file, { contentType: file.type, upsert: false })
        if (uploadError) {
          setSubmitting(false)
          setError(`이미지 업로드 실패: ${uploadError.message}`)
          return
        }
        await supabase.from('post_media').insert({
          post_id: postId,
          file_path: path,
          position: i + 1,
        })
      }
    }

    if (addModuleType === 'poll') {
      const optCount = pollOptionCount
      // 옵션 2개 → 찬/반 (post_procon), 3개 이상 → 일반 투표 (post_polls)
      if (optCount === 2) {
        const { error: proconErr } = await supabase.from('post_procon').insert({
          post_id: postId,
        })
        if (proconErr) {
          setSubmitting(false)
          setError(`찬반 저장 실패: ${proconErr.message}`)
          return
        }
      } else {
        const endsAt = pollEnds24h ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null
        const { error: pollErr } = await supabase.from('post_polls').insert({
          post_id: postId,
          question: pollQuestion.trim(),
          option_1: pollOption1.trim(),
          option_2: pollOption2.trim(),
          option_3: pollOptionCount >= 3 ? (pollOption3.trim() || null) : null,
          option_4: pollOptionCount >= 4 ? (pollOption4.trim() || null) : null,
          ends_at: endsAt,
        })
        if (pollErr) {
          setSubmitting(false)
          setError(`투표 저장 실패: ${pollErr.message}`)
          return
        }
      }
    }

    setSubmitting(false)
    onSuccess()
  }

  if (!user) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-muted-foreground">글을 쓰려면 로그인해 주세요.</p>
        <Button asChild>
          <Link href="/login">로그인</Link>
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="write-title">제목 *</Label>
        <Input
          id="write-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          className="bg-background"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="write-category">카테고리 *</Label>
        <select
          id="write-category"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="write-body">내용 *</Label>
        <Textarea
          id="write-body"
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="내용을 입력하세요"
          className="resize-y bg-background"
        />
      </div>
      <div className="space-y-2">
        <Label>이미지 (최대 3장, 각 5MB · jpeg, png, gif, webp)</Label>
        <div className="flex flex-wrap gap-3 items-start">
          {images.map((img, index) => (
            <div
              key={img.preview}
              className="relative rounded-lg border border-border overflow-hidden bg-muted/50 group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- blob URL preview */}
              <img src={img.preview} alt="" className="w-24 h-24 object-cover" />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-1 right-1 size-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs font-medium opacity-90 hover:opacity-100"
                title="삭제"
              >
                ×
              </button>
              {index === images.length - 1 && images.length === MAX_IMAGES && (
                <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1 rounded">
                  썸네일
                </span>
              )}
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <label className="flex flex-col items-center justify-center w-24 h-24 rounded-lg border border-dashed border-border cursor-pointer hover:bg-muted/50">
              <span className="text-2xl text-muted-foreground">+</span>
              <span className="text-xs text-muted-foreground">추가</span>
              <input
                type="file"
                accept={ALLOWED_TYPES.join(',')}
                multiple
                className="sr-only"
                onChange={(e) => {
                  addImages(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
          )}
        </div>
      </div>
      <div className="space-y-3 border border-border rounded-lg p-3">
        <Label className="text-sm font-medium">추가 모듈 (선택)</Label>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="addModule"
              checked={addModuleType === 'none'}
              onChange={() => setAddModuleType('none')}
              className="rounded-full"
            />
            <span className="text-sm">없음</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="addModule"
              checked={addModuleType === 'poll'}
              onChange={() => setAddModuleType('poll')}
              className="rounded-full"
            />
            <span className="text-sm">투표 추가</span>
          </label>
        </div>
        {addModuleType === 'poll' && (
          <div className="space-y-2 mt-3 pt-3 border-t border-border">
            <Input
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="투표 질문"
              maxLength={80}
              className="bg-background text-sm"
            />
            <Input
              value={pollOption1}
              onChange={(e) => setPollOption1(e.target.value)}
              placeholder="찬"
              maxLength={POLL_OPTION_MAX_LEN}
              className="bg-background text-sm"
            />
            <Input
              value={pollOption2}
              onChange={(e) => setPollOption2(e.target.value)}
              placeholder="반"
              maxLength={POLL_OPTION_MAX_LEN}
              className="bg-background text-sm"
            />
            {pollOptionCount >= 3 && (
              <Input
                value={pollOption3}
                onChange={(e) => setPollOption3(e.target.value)}
                placeholder="옵션 3"
                maxLength={POLL_OPTION_MAX_LEN}
                className="bg-background text-sm"
              />
            )}
            {pollOptionCount >= 4 && (
              <Input
                value={pollOption4}
                onChange={(e) => setPollOption4(e.target.value)}
                placeholder="옵션 4"
                maxLength={POLL_OPTION_MAX_LEN}
                className="bg-background text-sm"
              />
            )}
            {pollOptionCount < 4 && (
              <button
                type="button"
                onClick={() => setPollOptionCount((c) => (c < 4 ? (c + 1) as 2 | 3 | 4 : c))}
                className="w-full py-2.5 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                옵션 추가
              </button>
            )}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={pollEnds24h}
                  onCheckedChange={(checked) => setPollEnds24h(checked === true)}
                />
                <span className="text-sm text-muted-foreground">24시간 후 마감</span>
              </label>
              <button
                type="button"
                onClick={() => setAddModuleType('none')}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                투표 제거
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="write-is_spicy"
          checked={isSpicy}
          onCheckedChange={(checked) => setIsSpicy(checked === true)}
        />
        <Label htmlFor="write-is_spicy" className="text-sm font-normal cursor-pointer flex items-center gap-1.5">
          🌶️ 스포 있음
        </Label>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="spicy" disabled={submitting}>
          {submitting ? '올리는 중...' : '올리기'}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            취소
          </Button>
        ) : (
          <Button type="button" variant="ghost" asChild>
            <Link href="/">취소</Link>
          </Button>
        )}
      </div>
    </form>
  )
}
