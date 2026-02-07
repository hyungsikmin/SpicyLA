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
