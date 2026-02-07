'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const CHAR_LIMIT = 350

type SubmitComment = (
  postId: string,
  body: string,
  parentId?: string | null
) => Promise<{ ok?: boolean; error?: string }>

export default function CommentBox({
  postId,
  submitComment,
  parentId = null,
  parentAnonName,
  participants = [],
  onSuccess,
  onCancel,
}: {
  postId: string
  submitComment: SubmitComment
  parentId?: string | null
  parentAnonName?: string | null
  participants?: string[]
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionStart, setMentionStart] = useState(0)
  const [mentionFilter, setMentionFilter] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const totalLen = body.length

  const filteredParticipants = mentionFilter
    ? participants.filter((p) =>
        p.toLowerCase().includes(mentionFilter.toLowerCase())
      )
    : participants

  const insertMention = (anonName: string) => {
    const el = textareaRef.current
    if (!el) return
    const start = mentionStart
    const before = body.slice(0, start)
    const after = body.slice(el.selectionStart || body.length)
    setBody(before + `@${anonName} ` + after)
    setMentionOpen(false)
    setMentionFilter('')
    setTimeout(() => {
      el.focus()
      const pos = start + anonName.length + 3
      el.setSelectionRange(pos, pos)
    }, 0)
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    if (v.length > CHAR_LIMIT) return
    setBody(v)
    const cursor = e.target.selectionStart ?? 0
    const beforeCursor = v.slice(0, cursor)
    const atIdx = beforeCursor.lastIndexOf('@')
    if (atIdx !== -1 && !beforeCursor.slice(atIdx + 1).includes(' ')) {
      const afterAt = beforeCursor.slice(atIdx + 1)
      setMentionStart(atIdx)
      setMentionFilter(afterAt)
      setMentionOpen(true)
    } else {
      setMentionOpen(false)
    }
  }

  useEffect(() => {
    const el = textareaRef.current
    if (!el || !mentionOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMentionOpen(false)
      }
    }
    el.addEventListener('keydown', onKeyDown)
    return () => el.removeEventListener('keydown', onKeyDown)
  }, [mentionOpen])

  const submit = async () => {
    const content = body.trim()
    if (!parentId && !content) return
    setError(null)
    setLoading(true)
    const finalBody = content
    const result = await submitComment(postId, finalBody, parentId)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    setBody('')
    setMentionOpen(false)
    onSuccess?.()
    router.refresh()
  }

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(40, el.scrollHeight) + 'px'
  }, [body])

  const placeholder = '댓글을 입력하세요 (멘션: @입력)'

  return (
    <div className="space-y-2 relative">
      {parentAnonName && (
        <p className="text-xs text-muted-foreground">
          {parentAnonName}님에게 답글
        </p>
      )}
      <Textarea
        ref={textareaRef}
        value={body}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setMentionOpen(false), 150)}
        rows={parentAnonName ? 1 : 2}
        maxLength={CHAR_LIMIT}
        placeholder={placeholder}
        className="bg-background resize-none min-h-[2.5rem] leading-snug"
      />
      <p className="text-xs text-muted-foreground tabular-nums">
        {totalLen}/{CHAR_LIMIT}
      </p>
      {mentionOpen && filteredParticipants.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-10 mt-1 w-full max-w-md rounded-md border border-border bg-popover py-1 shadow-md max-h-40 overflow-auto"
        >
          {filteredParticipants.slice(0, 8).map((name) => (
            <li key={name}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => {
                  e.preventDefault()
                  insertMention(name)
                }}
              >
                @{name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="spicy" size="sm" onClick={submit} disabled={loading}>
          {loading ? '등록 중…' : parentId ? '답글 등록' : '댓글 등록'}
        </Button>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            취소
          </Button>
        )}
      </div>
    </div>
  )
}
