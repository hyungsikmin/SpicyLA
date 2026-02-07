'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type Comment = {
  id: string
  body: string
  created_at: string
  user_id: string
  parent_id: string | null
}

type SubmitComment = (
  postId: string,
  body: string,
  parentId?: string | null
) => Promise<{ ok?: boolean; error?: string }>

function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@익명\d+)/g)
  return (
    <>
      {parts.map((part, i) =>
        /^@익명\d+$/.test(part) ? (
          <span key={i} className="text-primary font-medium">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  )
}

export default function CommentSection({
  postId,
  postUserId,
  comments,
  profileMap,
  submitComment,
  mentionableAnonNames,
}: {
  postId: string
  postUserId: string
  comments: Comment[]
  profileMap: Record<string, string>
  submitComment: SubmitComment
  mentionableAnonNames: string[]
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [replyParentId, setReplyParentId] = useState<string | null>(null)
  const [replyToAnonName, setReplyToAnonName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionStart, setMentionStart] = useState(0)

  const topLevel = comments.filter((c) => !c.parent_id)
  const byParent = new Map<string, Comment[]>()
  comments.forEach((c) => {
    if (c.parent_id) {
      if (!byParent.has(c.parent_id)) byParent.set(c.parent_id, [])
      byParent.get(c.parent_id)!.push(c)
    }
  })

  const getAnonName = (userId: string) => profileMap[userId] ?? '익명'
  const isAuthor = (userId: string) => userId === postUserId

  const handleSubmit = async (parentId?: string | null) => {
    const toSend = parentId ?? replyParentId
    if (!body.trim()) return
    setError(null)
    setLoading(true)
    const result = await submitComment(postId, body.trim(), toSend)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    setBody('')
    setReplyParentId(null)
    setReplyToAnonName(null)
    router.refresh()
  }

  const startReply = (parentId: string, anonName: string) => {
    setReplyParentId(parentId)
    setReplyToAnonName(anonName)
  }

  const onBodyChange = (value: string) => {
    setBody(value)
    const at = value.lastIndexOf('@')
    if (at >= 0 && (at === 0 || /[\s(]/.test(value[at - 1]))) {
      setShowMentions(true)
      setMentionStart(at)
    } else {
      setShowMentions(false)
    }
  }

  const insertMention = (anonName: string) => {
    const before = body.slice(0, mentionStart)
    const after = body.slice(mentionStart).replace(/@\S*$/, '')
    setBody(`${before}@${anonName} ${after}`)
    setShowMentions(false)
  }

  return (
    <div className="space-y-4">
      {topLevel.length === 0 && (
        <p className="text-sm text-muted-foreground">아직 댓글이 없어.</p>
      )}
      {topLevel.map((comment) => (
        <div key={comment.id} className="space-y-2">
          <div className="rounded-lg border border-border/50 p-3 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">
                {getAnonName(comment.user_id)}
              </span>
              {isAuthor(comment.user_id) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  작성자
                </span>
              )}
            </div>
            <p className="text-sm whitespace-pre-line">
              <MentionText text={comment.body} />
            </p>
            <Button
              variant="ghost"
              size="xs"
              className="h-6 text-xs text-muted-foreground"
              onClick={() => startReply(comment.id, getAnonName(comment.user_id))}
            >
              답글
            </Button>
          </div>
          {(byParent.get(comment.id) ?? []).map((reply) => (
            <div
              key={reply.id}
              className="ml-4 sm:ml-6 rounded-lg border border-border/50 p-3 space-y-1"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {getAnonName(reply.user_id)}
                </span>
                {isAuthor(reply.user_id) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    작성자
                  </span>
                )}
              </div>
              <p className="text-sm whitespace-pre-line">
                <MentionText text={reply.body} />
              </p>
            </div>
          ))}
        </div>
      ))}

      <div className="space-y-2 relative">
        {replyToAnonName && (
          <p className="text-xs text-muted-foreground">
            답글 to @{replyToAnonName}
            <button
              type="button"
              className="ml-1 underline"
              onClick={() => {
                setReplyParentId(null)
                setReplyToAnonName(null)
              }}
            >
              취소
            </button>
          </p>
        )}
        <Textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          rows={3}
          placeholder="댓글을 입력하세요. @로 멘션할 수 있어요."
          className="bg-background resize-y"
        />
        {showMentions && mentionableAnonNames.length > 0 && (
          <ul className="absolute z-10 top-full left-0 right-0 mt-1 rounded-md border border-border bg-card py-1 shadow-md max-h-32 overflow-auto">
            {mentionableAnonNames.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => insertMention(name)}
                >
                  @{name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          variant="spicy"
          size="sm"
          onClick={() => handleSubmit()}
          disabled={loading}
        >
          {loading ? '등록 중…' : replyParentId ? '답글 등록' : '댓글 등록'}
        </Button>
      </div>
    </div>
  )
}
