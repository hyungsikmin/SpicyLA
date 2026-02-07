export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import CommentsSection from './CommentsSection'
import AuthorMenu from './AuthorMenu'
import ReactionButtons, { type CountsByType, type ReactionType } from './ReactionButtons'
import ShareButton from './ShareButton'
import RelativeTime from '@/components/RelativeTime'
import Image from 'next/image'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { getPostImageUrl, getAvatarUrl } from '@/lib/storage'
import { getAvatarColorClass } from '@/lib/avatarColors'
import { userAvatarEmoji, userAvatarColor } from '@/lib/postAvatar'
import { Button } from '@/components/ui/button'

export async function submitComment(
  postId: string,
  body: string,
  parentId?: string | null
) {
  'use server'
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요해요.' }
  const trimmed = body.trim()
  if (!trimmed) return { error: '내용을 입력해 주세요.' }
  if (trimmed.length > 350) return { error: '댓글은 350자까지 입력할 수 있어요.' }
  const insert: { post_id: string; user_id: string; body: string; parent_id?: string } = {
    post_id: postId,
    user_id: user.id,
    body: trimmed,
  }
  if (parentId) {
    const { data: parent } = await supabase
      .from('comments')
      .select('id')
      .eq('id', parentId)
      .eq('post_id', postId)
      .maybeSingle()
    if (parent) insert.parent_id = parentId
  }
  const { error } = await supabase.from('comments').insert(insert)
  if (error) return { error: error.message }
  revalidatePath(`/p/${postId}`)
  return { ok: true }
}

export async function toggleCommentLike(formData: FormData) {
  'use server'
  const commentId = formData.get('commentId') as string | null
  const postId = formData.get('postId') as string | null
  if (!commentId || !postId) return
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data: comment } = await supabase
    .from('comments')
    .select('id')
    .eq('id', commentId)
    .eq('post_id', postId)
    .maybeSingle()
  if (!comment) return
  const { data: existing } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing) {
    await supabase.from('comment_likes').delete().eq('id', existing.id)
  } else {
    await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id })
  }
  revalidatePath(`/p/${postId}`)
}

type Post = {
  id: string
  title: string | null
  body: string
  user_id: string
  is_spicy: boolean
  created_at: string
}

type Comment = {
  id: string
  body: string
  created_at: string
  user_id: string
  parent_id: string | null
}

type PostMedia = {
  id: string
  file_path: string
  position: number
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = await createSupabaseServer()
  const { data: post } = await supabase
    .from('posts')
    .select('id, title, body')
    .eq('id', id)
    .single()
  if (!post) {
    return { title: '글을 찾을 수 없어' }
  }
  const title = post.title?.trim() || '제목 없음'
  const bodyLine = post.body.replace(/\s+/g, ' ').trim().slice(0, 80)
  const description = bodyLine ? `${bodyLine}${bodyLine.length >= 80 ? '…' : ''}` : '아니근데'
  const { data: firstMedia } = await supabase
    .from('post_media')
    .select('file_path')
    .eq('post_id', id)
    .order('position')
    .limit(1)
    .maybeSingle()
  const ogImage = firstMedia
    ? { url: getPostImageUrl(firstMedia.file_path), width: 1200, height: 630 }
    : undefined
  return {
    title: `${title} | 아니근데`,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      ...(ogImage && { images: [ogImage] }),
    },
    ...(ogImage && {
      twitter: { card: 'summary_large_image', images: [ogImage.url] },
    }),
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createSupabaseServer()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()

  const { data: post, error } = await supabase
    .from('posts')
    .select('id, title, body, user_id, is_spicy, created_at')
    .eq('id', id)
    .single<Post>()

  if (error || !post) {
    return (
      <main className="min-h-screen max-w-[600px] mx-auto border-x border-border bg-background flex items-center justify-center p-8">
        <p className="text-muted-foreground">글을 찾을 수 없어.</p>
      </main>
    )
  }

  if (!user && post.is_spicy) {
    redirect(`/login?from=${encodeURIComponent('/p/' + id)}`)
  }

  let blockedIds = new Set<string>()
  if (user?.id) {
    const { data: blockedRows } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', user.id)
    blockedIds = new Set((blockedRows ?? []).map((r: { blocked_id: string }) => r.blocked_id))
  }
  if (blockedIds.has(post.user_id)) {
    return (
      <main className="min-h-screen max-w-[600px] mx-auto border-x border-border bg-background">
        <header className="sticky top-0 z-10 flex items-center gap-2 px-4 h-14 border-b border-border bg-background/95 backdrop-blur">
          <Button variant="ghost" size="icon" className="shrink-0 -ml-2" asChild>
            <Link href="/">←</Link>
          </Button>
          <h1 className="text-lg font-semibold truncate flex-1 min-w-0">글</h1>
        </header>
        <div className="p-8 text-center text-muted-foreground text-sm">
          차단한 사용자의 글이에요.
        </div>
      </main>
    )
  }

  const { data: comments } = await supabase
    .from('comments')
    .select('id, body, created_at, user_id, parent_id')
    .eq('post_id', id)
    .order('created_at')
    .returns<Comment[]>()
  const commentsFiltered = (comments ?? []).filter((c) => !blockedIds.has(c.user_id))
  const commentIds = commentsFiltered.map((c) => c.id)
  const likeCountByComment: Record<string, number> = {}
  const likedCommentIds = new Set<string>()
  if (commentIds.length > 0) {
    const { data: likes } = await supabase
      .from('comment_likes')
      .select('comment_id, user_id')
      .in('comment_id', commentIds)
    commentIds.forEach((cid) => { likeCountByComment[cid] = 0 })
    likes?.forEach((r: { comment_id: string; user_id: string }) => {
      likeCountByComment[r.comment_id] = (likeCountByComment[r.comment_id] ?? 0) + 1
      if (r.user_id === user?.id) likedCommentIds.add(r.comment_id)
    })
  }
  const { data: settingsRows } = await supabase.from('site_settings').select('key, value_json')
  const settingsMap = new Map<string, number>()
  ;(settingsRows ?? []).forEach((row: { key: string; value_json: unknown }) => {
    const v = row.value_json
    if (typeof v === 'number' && Number.isFinite(v)) settingsMap.set(row.key, v)
    else if (typeof v === 'string' && /^-?\d+$/.test(v)) settingsMap.set(row.key, parseInt(v, 10))
  })
  const bestCommentMinLikes = settingsMap.get('best_comment_min_likes') ?? 1

  const userIds = new Set<string>([post.user_id])
  commentsFiltered.forEach((c) => userIds.add(c.user_id))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, anon_name, avatar_path, profile_color_index')
    .in('user_id', Array.from(userIds))
  const anonMap: Record<string, string> = {}
  const avatarMap: Record<string, string> = {}
  const avatarColorMap: Record<string, string> = {}
  profiles?.forEach((p: { user_id: string; anon_name: string | null; avatar_path: string | null; profile_color_index: number | null }) => {
    anonMap[p.user_id] = p.anon_name?.trim() || '익명'
    const url = getAvatarUrl(p.avatar_path ?? null)
    if (url) avatarMap[p.user_id] = url
    avatarColorMap[p.user_id] = getAvatarColorClass(p.profile_color_index ?? null, p.user_id)
  })
  commentsFiltered.forEach((c) => {
    if (!anonMap[c.user_id]) anonMap[c.user_id] = '익명'
  })

  const { data: media } = await supabase
    .from('post_media')
    .select('id, file_path, position')
    .eq('post_id', id)
    .order('position')
    .returns<PostMedia[]>()

  const { data: reactionRows } = await supabase
    .from('post_reactions')
    .select('reaction_type, user_id')
    .eq('post_id', id)

  const reactionTypes: ReactionType[] = ['laugh', 'angry', 'mindblown', 'eyes', 'chili']
  const reactionCounts: CountsByType = {
    laugh: 0,
    angry: 0,
    mindblown: 0,
    eyes: 0,
    chili: 0,
  }
  for (const r of reactionRows ?? []) {
    const t = (r as { reaction_type?: string }).reaction_type ?? 'chili'
    if (reactionTypes.includes(t as ReactionType)) {
      reactionCounts[t as ReactionType] = (reactionCounts[t as ReactionType] ?? 0) + 1
    }
  }
  const userReactionTypes = (reactionRows ?? [])
    .filter((r) => (r as { user_id?: string }).user_id === user?.id)
    .map((r) => (r as { reaction_type?: string }).reaction_type ?? 'chili')
    .filter((t): t is ReactionType => reactionTypes.includes(t as ReactionType))

  const isOwner = !!(user && user.id === post.user_id)
  const commentCount = commentsFiltered.length

  return (
    <main className="min-h-screen max-w-[600px] mx-auto border-x border-border bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 px-4 h-14 border-b border-border bg-background/95 backdrop-blur">
        <Button variant="ghost" size="icon" className="shrink-0 -ml-2" asChild>
          <Link href="/">←</Link>
        </Button>
        <h1 className="text-lg font-semibold truncate flex-1 min-w-0">글</h1>
      </header>

      <article className="border-b border-border">
        <div className="flex gap-3 px-4 pt-4 pb-2 items-start">
          <div className="flex-1 min-w-0">
            <AuthorMenu
              targetUserId={post.user_id}
              targetAnonName={anonMap[post.user_id] ?? '익명'}
              currentUserId={user?.id}
            >
              <div className="flex gap-3 items-center min-w-0">
                <div className={`shrink-0 size-10 rounded-full flex items-center justify-center text-lg overflow-visible ${!avatarMap[post.user_id] ? avatarColorMap[post.user_id] ?? userAvatarColor(post.user_id) : 'relative'}`}>
                  {avatarMap[post.user_id] ? (
                    <>
                      <div className={`absolute inset-0 rounded-full ${avatarColorMap[post.user_id] ?? userAvatarColor(post.user_id)}`} aria-hidden />
                      <div className="relative size-8 rounded-full overflow-hidden bg-background ring-2 ring-background">
                        <Image src={avatarMap[post.user_id]} alt="" width={32} height={32} className="w-full h-full object-cover" />
                      </div>
                    </>
                  ) : (
                    userAvatarEmoji(post.user_id)
                  )}
                </div>
                <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
                  <span className="font-semibold text-sm">{anonMap[post.user_id] ?? '익명'}</span>
                  <span className="text-muted-foreground text-sm">·</span>
                  <RelativeTime date={post.created_at} />
                </div>
              </div>
            </AuthorMenu>
          </div>
          <ShareButton />
        </div>
        <div className="px-4 pb-4 -mt-1">
          {post.title && (
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <h1 className="font-semibold text-[17px] leading-tight">
                  {post.title}
                </h1>
                {post.is_spicy && (
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/40">
                    멤버만 공개🥵
                  </span>
                )}
              </div>
            )}
            {!post.title && post.is_spicy && (
              <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/40 mt-1 inline-block">
                멤버만 공개🥵
              </span>
            )}
            <p className="text-[15px] leading-snug text-foreground/95 mt-2 whitespace-pre-line">
              {post.body}
            </p>
            {media && media.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {media.map((m) => (
                  <a
                    key={m.id}
                    href={getPostImageUrl(m.file_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-2xl overflow-hidden bg-muted max-w-full relative h-80 w-full"
                  >
                    <Image
                      src={getPostImageUrl(m.file_path)}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 600px) 100vw, 600px"
                    />
                  </a>
                ))}
              </div>
            )}
            <div className="mt-4">
              <ReactionButtons
                postId={id}
                initialCounts={reactionCounts}
                initialUserTypes={userReactionTypes}
                hasUser={!!user}
              />
            </div>
          {isOwner && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/edit/${post.id}`}>수정</Link>
              </Button>
              <form action={async () => {
                'use server'
                const supabaseServer = await createSupabaseServer()
                await supabaseServer.from('posts').delete().eq('id', post.id)
                redirect('/')
              }}>
                <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                  삭제
                </Button>
              </form>
            </div>
          )}
        </div>
      </article>

      <div className="h-2 w-full bg-muted border-0 shrink-0" role="presentation" aria-hidden />

      <section className="border-b border-border">
        <div className="px-4 py-3 border-b border-border/50">
          <h2 className="text-sm font-semibold text-muted-foreground">
            댓글 {commentCount}
          </h2>
        </div>
        <div className="px-4 py-4">
          <CommentsSection
            postId={id}
            postAuthorId={post.user_id}
            comments={commentsFiltered}
            likeCountByComment={likeCountByComment}
            likedCommentIds={Array.from(likedCommentIds)}
            toggleCommentLike={toggleCommentLike}
            anonMap={anonMap}
            avatarMap={avatarMap}
            avatarColorMap={avatarColorMap}
            submitComment={submitComment}
            hasUser={!!user}
            currentUserId={user?.id}
            bestCommentMinLikes={bestCommentMinLikes}
          />
        </div>
      </section>
    </main>
  )
}
