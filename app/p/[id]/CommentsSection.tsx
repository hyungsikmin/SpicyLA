'use client'

import { useState, Fragment } from 'react'
import Image from 'next/image'
import { Heart, Plus, Reply } from 'lucide-react'
import CommentBox from './CommentBox'
import CommentBody from './CommentBody'
import RelativeTime from '@/components/RelativeTime'
import AuthorMenu from './AuthorMenu'
import { userAvatarEmoji, userAvatarColor } from '@/lib/postAvatar'

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

type ToggleCommentLike = (formData: FormData) => Promise<void>

const COMMENTS_PAGE_SIZE = 5

function sortByCreated(comments: Comment[]) {
  return [...comments].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
}

export default function CommentsSection({
  postId,
  postAuthorId,
  comments,
  likeCountByComment = {},
  likedCommentIds = [],
  toggleCommentLike,
  anonMap,
  avatarMap = {},
  avatarColorMap = {},
  submitComment,
  hasUser,
  currentUserId,
  bestCommentMinLikes,
}: {
  postId: string
  postAuthorId: string
  comments: Comment[]
  likeCountByComment?: Record<string, number>
  likedCommentIds?: string[]
  toggleCommentLike?: ToggleCommentLike
  anonMap: Record<string, string>
  avatarMap?: Record<string, string>
  avatarColorMap?: Record<string, string>
  submitComment: SubmitComment
  hasUser: boolean
  currentUserId?: string | null
  bestCommentMinLikes?: number
}) {
  const minLikes = bestCommentMinLikes ?? 1
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [visibleRootCount, setVisibleRootCount] = useState(COMMENTS_PAGE_SIZE)
  const [visibleRepliesByRoot, setVisibleRepliesByRoot] = useState<Record<string, number>>({})

  const byParent = new Map<string, Comment[]>()
  comments.forEach((c) => {
    const pid = c.parent_id ?? 'root'
    if (!byParent.has(pid)) byParent.set(pid, [])
    byParent.get(pid)!.push(c)
  })
  const rootList = byParent.get('root') ?? []
  const roots = [...rootList].sort((a, b) => {
    const likesA = likeCountByComment[a.id] ?? 0
    const likesB = likeCountByComment[b.id] ?? 0
    if (likesB !== likesA) return likesB - likesA
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
  const participants = Array.from(
    new Set(comments.map((c) => anonMap[c.user_id]).filter(Boolean))
  ).sort()
  const postAuthorAnon = anonMap[postAuthorId]
  if (postAuthorAnon && !participants.includes(postAuthorAnon)) {
    participants.unshift(postAuthorAnon)
  }

  /** 루트 아래 모든 답글을 1레벨만 들여쓰기로 평면 목록 (트리 중첩 없음) */
  function getRepliesFlattened(parentId: string): Comment[] {
    const direct = sortByCreated(byParent.get(parentId) ?? [])
    return direct.flatMap((c) => [c, ...getRepliesFlattened(c.id)])
  }

  const renderComment = (node: Comment, isRoot: boolean, isBest: boolean, isLastInGroup: boolean) => {
    const anon = anonMap[node.user_id] ?? '익명'
    const isAuthor = node.user_id === postAuthorId
    const likeCount = likeCountByComment[node.id] ?? 0
    const isLiked = likedCommentIds.includes(node.id)
    const parentComment = node.parent_id ? comments.find((c) => c.id === node.parent_id) : null
    const parentAnon = parentComment ? anonMap[parentComment.user_id] ?? '익명' : null
    const parentSnippet = parentComment?.body
      ? (() => {
          const raw = parentComment.body.replace(/\s+/g, ' ').trim()
          return raw.slice(0, 28) + (raw.length > 28 ? '…' : '')
        })()
      : null
    const rowContent = (
      <>
        <div className="flex gap-3 py-3 items-start">
          <AuthorMenu
            targetUserId={node.user_id}
            targetAnonName={anon}
            currentUserId={currentUserId}
          >
            <div className={`shrink-0 size-8 rounded-full flex items-center justify-center text-sm overflow-visible ${!avatarMap[node.user_id] ? (avatarColorMap[node.user_id] ?? userAvatarColor(node.user_id)) : 'relative'}`}>
              {avatarMap[node.user_id] ? (
                <>
                  <div className={`absolute inset-0 rounded-full ${avatarColorMap[node.user_id] ?? userAvatarColor(node.user_id)}`} aria-hidden />
                  <div className="relative size-6 rounded-full overflow-hidden bg-background ring-2 ring-background">
                    <Image src={avatarMap[node.user_id]} alt="" width={24} height={24} className="w-full h-full object-cover" />
                  </div>
                </>
              ) : (
                userAvatarEmoji(node.user_id)
              )}
            </div>
          </AuthorMenu>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm">{anon}</span>
              {isAuthor && (
                <span className="rounded bg-[var(--spicy)]/20 text-[var(--spicy)] text-[10px] px-1.5 py-0.5">
                  작성자
                </span>
              )}
              <span className="text-muted-foreground text-sm">·</span>
              <RelativeTime date={node.created_at} />
            </div>
            <CommentBody body={node.body} />
            {hasUser && (
              <button
                type="button"
                className="text-muted-foreground text-xs mt-1 hover:underline"
                onClick={() => setReplyingTo(replyingTo === node.id ? null : node.id)}
              >
                답글
              </button>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-center gap-0.5 pt-0.5">
            {toggleCommentLike && hasUser ? (
              <form action={toggleCommentLike}>
                <input type="hidden" name="commentId" value={node.id} />
                <input type="hidden" name="postId" value={postId} />
                <button
                  type="submit"
                  className={`flex flex-col items-center gap-0.5 transition-colors p-0.5 rounded ${isLiked ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground hover:text-red-500 dark:hover:text-red-400'}`}
                  aria-label={isLiked ? '좋아요 취소' : '좋아요'}
                >
                  <Heart
                    className="size-4 shrink-0"
                    fill={isLiked ? 'currentColor' : 'none'}
                    strokeWidth={1.5}
                  />
                  <span className="text-[10px] tabular-nums leading-tight">
                    {likeCount > 0 ? likeCount : '0'}
                  </span>
                </button>
              </form>
            ) : likeCount > 0 ? (
              <div className="flex flex-col items-center gap-0.5">
                <Heart className="size-4 shrink-0 text-muted-foreground/50" fill="none" strokeWidth={1.5} />
                <span className="text-[10px] text-muted-foreground tabular-nums leading-tight">{likeCount}</span>
              </div>
            ) : null}
          </div>
        </div>
        {replyingTo === node.id && (
          <div className="pb-3">
            <CommentBox
              postId={postId}
              submitComment={submitComment}
              parentId={node.id}
              parentAnonName={anon}
              participants={participants}
              onSuccess={() => setReplyingTo(null)}
              onCancel={() => setReplyingTo(null)}
            />
          </div>
        )}
      </>
    )
    const wrapBorder = isLastInGroup ? 'border-b border-border' : ''
    const wrapBest = isBest ? 'rounded-lg bg-gradient-to-b from-red-500/10 to-transparent dark:from-red-500/8 dark:to-transparent -mx-1 px-3 pt-2 pb-1 mt-1' : ''
    if (isRoot) {
      return (
        <div key={node.id} className={`${wrapBorder} ${wrapBest}`}>
          {isBest && (
            <span className="inline-flex items-center rounded-md bg-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-semibold px-2 py-0.5 border border-red-500/30 dark:border-red-500/40 mb-2">
              배댓
            </span>
          )}
          {rowContent}
        </div>
      )
    }
    return (
      <div key={node.id} className={`ml-10 flex items-start gap-0 ${wrapBorder}`}>
        <div className="w-0.5 h-10 bg-border shrink-0 mt-2 rounded-full min-h-[2.5rem]" aria-hidden />
        <div className="pl-3 flex-1 min-w-0">
          {parentAnon != null && (
            <div className="text-muted-foreground text-xs pt-1 pb-0.5 min-w-0" aria-hidden>
              <div className="flex items-center gap-1.5">
                <Reply className="size-3 shrink-0" aria-hidden />
                <span>{parentAnon}님에게 답글</span>
              </div>
              {parentSnippet && (
                <p className="text-[11px] text-muted-foreground/90 mt-0.5 pl-4 truncate" title={parentComment?.body?.replace(/\s+/g, ' ').trim()}>
                  「{parentSnippet}」
                </p>
              )}
            </div>
          )}
          {rowContent}
        </div>
      </div>
    )
  }

  return (
    <div>
      {roots.length === 0 && !hasUser && (
        <p className="text-sm text-muted-foreground py-4">아직 댓글이 없어.</p>
      )}
      {roots.length === 0 && hasUser && (
        <p className="text-sm text-muted-foreground py-2">첫 댓글을 남겨보세요.</p>
      )}
      {roots.slice(0, visibleRootCount).map((root, index) => {
        const replies = getRepliesFlattened(root.id)
        const visibleReplyCount = visibleRepliesByRoot[root.id] ?? COMMENTS_PAGE_SIZE
        const visibleReplies = replies.slice(0, visibleReplyCount)
        const hasMoreReplies = replies.length > visibleReplyCount
        return (
          <Fragment key={root.id}>
            {renderComment(root, true, index === 0 && (likeCountByComment[root.id] ?? 0) >= minLikes, replies.length === 0)}
            {visibleReplies.map((reply, i) =>
              renderComment(reply, false, false, i === visibleReplies.length - 1 && !hasMoreReplies)
            )}
            {hasMoreReplies && (
              <div className="ml-10 flex items-start gap-0 border-b border-border py-2 bg-gradient-to-b from-muted/20 to-muted/70">
                <div className="w-0.5 h-6 bg-border shrink-0 mt-1 rounded-full" aria-hidden />
                <div className="pl-3 flex-1 flex justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleRepliesByRoot((prev) => ({
                        ...prev,
                        [root.id]: (prev[root.id] ?? COMMENTS_PAGE_SIZE) + COMMENTS_PAGE_SIZE,
                      }))
                    }
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-medium"
                  >
                    <Plus className="size-4 shrink-0" aria-hidden />
                    <span>답글 ({replies.length - visibleReplyCount}개 남음)</span>
                  </button>
                </div>
              </div>
            )}
          </Fragment>
        )
      })}
      {roots.length > visibleRootCount && (
        <div className="py-3 flex justify-center bg-gradient-to-b from-muted/20 to-muted/70">
          <button
            type="button"
            onClick={() => setVisibleRootCount((prev) => prev + COMMENTS_PAGE_SIZE)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-medium"
          >
            <Plus className="size-4 shrink-0" aria-hidden />
            <span>{roots.length - visibleRootCount}개 남음</span>
          </button>
        </div>
      )}
      {hasUser && (
        <div className="pt-4 border-t border-border/50">
          <CommentBox
            postId={postId}
            submitComment={submitComment}
            participants={participants}
          />
        </div>
      )}
      {!hasUser && (
        <p className="text-sm text-muted-foreground py-4">
          로그인하면 댓글을 달 수 있어.
        </p>
      )}
    </div>
  )
}
