/**
 * 시드 계정 AI 에이전트: 시드로 로그인 → LLM으로 글/댓글 생성 → insert.
 * 서버 전용 (API route, cron). OPENAI_API_KEY, SEED_ACCOUNT_PASSWORD 필요.
 */
import { createClient, type User, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getPersonaTemplateForIndex, SEED_AGENT_WRITING_RULES } from '@/lib/seedPersonas'

const SEED_PASSWORD = process.env.SEED_ACCOUNT_PASSWORD ?? ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export type SeedWithPersona = {
  user_id: string
  email: string
  anon_name: string
  persona_prompt: string
  index: number
}

/** 시드 계정 목록 + 페르소나 (없으면 템플릿에서 할당). */
export async function getSeedsWithPersonas(limit = 200): Promise<SeedWithPersona[]> {
  const admin = getSupabaseAdmin()
  const { data: seeds, error } = await admin
    .from('seed_accounts')
    .select('user_id, email, persona_prompt')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !seeds?.length) return []

  const userIds = seeds.map((s: { user_id: string }) => s.user_id)
  const { data: profiles } = await admin
    .from('profiles')
    .select('user_id, anon_name')
    .in('user_id', userIds)
  const anonByUser = new Map((profiles ?? []).map((p: { user_id: string; anon_name: string | null }) => [p.user_id, p.anon_name?.trim() || '익명']))

  return seeds.map((s: { user_id: string; email: string; persona_prompt: string | null }, i: number) => ({
    user_id: s.user_id,
    email: s.email,
    anon_name: anonByUser.get(s.user_id) ?? '익명',
    persona_prompt: (s.persona_prompt ?? getPersonaTemplateForIndex(i)).trim(),
    index: i,
  }))
}

/** 시드로 로그인한 Supabase 클라이언트 반환 (RLS 통과용). */
async function supabaseAsSeed(email: string): Promise<{ supabase: SupabaseClient; user: User } | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: SEED_PASSWORD })
  if (error || !data.user) return null
  return { supabase: supabase as SupabaseClient, user: data.user }
}

const CATEGORIES = ['story', 'love', 'eat', 'work', 'money', 'home', 'travel', 'question'] as const

async function callOpenAI(system: string, user: string, maxTokens = 400): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.9,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const json = await res.json()
  const content = json.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') throw new Error('OpenAI empty content')
  return content.trim()
}

/** JSON 블록만 추출 (```json ... ``` 또는 { ... }) */
function extractJson(text: string): string {
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (block) return block[1].trim()
  const obj = text.match(/\{[\s\S]*\}/)
  return obj ? obj[0] : text
}

/** 주제 힌트: 카테고리별 구체적 주제로 다양화. */
const TOPIC_HINTS = [
  '연애/데이팅 썰 — 소개팅 현장, 썸 타다 어그러짐, 전 남친/여친한테 연락 옴, 만남앱 경험 등',
  '회사 불화·짜증 — 꼰대 상사, 동료 뒷담, 야근 강요, 월급 너무 적음, 이직 고민, 직장 내 황당한 일 등',
  '19금·막장 썰 — 수위 있는 연애 에피소드, 민망한 상황, 바람 목격, 이상한 경험 등 (너무 노골적이진 않게)',
  'LA 생활 고민·불만 — 집값·렌트비 터짐, 이웃 문제, 주차 지옥, 한인타운 생활, 미국 생활 힘든 점 등',
  '질문형 — "~해본 사람 있어?" "LA에서 ~하려면 어떻게 해?" "~이런 상황 나만 그럼?" 등',
  '일상 투덜·공감 — 오늘 짜증났던 것, 황당한 상황, "이거 나만 이상하게 느끼는 거임?" 등',
  '맛집·카페 후기 — 구체적인 장소 이름과 뭐가 맛있었는지. 제목은 "주말에 가기 좋은 ~" 포맷 쓰지 말 것',
] as const

/** 새 글 생성 (제목+본문+카테고리). */
async function generatePostContent(
  personaPrompt: string,
  recentTitles: string[]
): Promise<{ title: string; body: string; category: string }> {
  const topicHint = TOPIC_HINTS[Math.floor(Math.random() * TOPIC_HINTS.length)]
  const system = `${personaPrompt}\n\n${SEED_AGENT_WRITING_RULES}\n\n글은 제목 한 줄 + 본문. 길이는 주제에 맞게 자유롭게 — 짧으면 2~3줄, 길면 5~6줄도 가능. 카테고리: story, love, eat, work, money, home, travel, question 중 하나. 제목은 "주말에 가기 좋은 OO 맛집/카페" 포맷 금지. 인터넷 구어체 반말로.`
  const user = recentTitles.length > 0
    ? `최근 글 제목 예시:\n${recentTitles.slice(0, 8).map((t) => `- ${t}`).join('\n')}\n\n이번 주제: ${topicHint}\n위 예시와 겹치지 않는 제목 스타일로 LA 20-30대 인터넷 구어체 글 하나. category는 story, love, eat, work, money, home, travel, question 중 하나. JSON만 출력:\n{"title":"제목","body":"본문","category":"story"}`
    : `주제: ${topicHint}\nLA 20-30대 인터넷 구어체 반말 글 하나. 제목 다양하게. category는 story, love, eat, work, money, home, travel, question 중 하나. JSON만 출력:\n{"title":"제목","body":"본문","category":"story"}`
  const raw = await callOpenAI(system, user, 600)
  const parsed = JSON.parse(extractJson(raw)) as { title?: string; body?: string; category?: string }
  const title = (parsed.title ?? '제목 없음').toString().trim().slice(0, 100)
  const body = (parsed.body ?? '').toString().trim().slice(0, 2000)
  const category = CATEGORIES.includes(parsed.category as (typeof CATEGORIES)[number]) ? (parsed.category as string) : 'story'
  return { title, body, category }
}

/** 댓글 생성. 글(및 투표가 있으면 질문·선택지)에 맞는 답변만 작성. */
async function generateCommentContent(
  personaPrompt: string,
  postTitle: string,
  postBody: string,
  existingComments: string[],
  poll?: { question: string; options: string[] }
): Promise<string> {
  const system = `${personaPrompt}\n\n${SEED_AGENT_WRITING_RULES}\n\n댓글은 1~3줄. 인터넷 커뮤니티 반응 스타일 — 짧고 임팩트 있게. 이 글의 제목·본문·(투표가 있으면) 투표 내용을 읽고 그 내용에 맞는 반응만. 뚱딴지 인사 금지.`
  const context = existingComments.length > 0
    ? `기존 댓글 예: ${existingComments.slice(0, 3).join(' / ')}`
    : ''
  const pollBlock = poll
    ? `\n[투표] 질문: ${poll.question}\n선택지: ${poll.options.join(', ')}`
    : ''
  const user = `글 제목: ${postTitle.slice(0, 80)}\n본문: ${postBody.slice(0, 400)}${pollBlock}${context ? `\n${context}` : ''}\n\n이 글에 달 자연스러운 댓글 하나. 반드시 위 글/투표 내용에 맞게 답변할 것. JSON만: {"body":"댓글 내용"}`.trim()
  const raw = await callOpenAI(system, user, 300)
  const parsed = JSON.parse(extractJson(raw)) as { body?: string }
  return (parsed.body ?? raw).toString().trim().slice(0, 350)
}

const REACTION_TYPES = ['laugh', 'angry', 'mindblown', 'eyes', 'chili'] as const

export type RunAgentResult =
  | { ok: true; action: 'post'; postId: string }
  | { ok: true; action: 'comment'; commentId: string; postId: string }
  | { ok: true; action: 'reaction'; postId: string; reactionType: string }
  | { ok: true; action: 'poll_vote'; postId: string; optionIndex: number }
  | { ok: true; action: 'procon_vote'; postId: string; side: 'pro' | 'con' }
  | { ok: true; action: 'comment_like'; commentId: string }
  | { ok: false; error: string }

/** 시드 한 명에 대해 로그인 → 리액션 40% / 투표 30% / 댓글 하트 30% 중 하나 수행. */
export async function runOneSeedAgent(seed: SeedWithPersona): Promise<RunAgentResult> {
  if (!SEED_PASSWORD || !OPENAI_API_KEY) {
    return { ok: false, error: 'SEED_ACCOUNT_PASSWORD or OPENAI_API_KEY missing' }
  }
  const auth = await supabaseAsSeed(seed.email)
  if (!auth) return { ok: false, error: 'seed login failed' }
  const { supabase, user } = auth

  const admin = getSupabaseAdmin()
  const r = Math.random()
  const doPost = false
  const doVote = r >= 0.4 && r < 0.7       // 30%
  const doCommentLike = r >= 0.7           // 30% — 댓글 하트
  const doComment = false                 // 댓글 작성 비활성화 (하트만 사용)
  // r < 0.4 → 리액션 40%

  if (doPost) {
    const { data: recent } = await admin
      .from('posts')
      .select('title')
      .eq('status', 'visible')
      .order('created_at', { ascending: false })
      .limit(10)
    const recentTitles = (recent ?? []).map((r: { title: string | null }) => (r.title ?? '').trim()).filter(Boolean)
    const { title, body, category } = await generatePostContent(seed.persona_prompt, recentTitles)
    const { data: post, error } = await supabase
      .from('posts')
      .insert({ user_id: user.id, title, body, is_spicy: false, status: 'visible', category })
      .select('id')
      .single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, action: 'post', postId: post.id }
  }

  if (doVote) {
    const now = new Date().toISOString()
    const { data: visiblePosts } = await admin.from('posts').select('id').eq('status', 'visible').limit(500)
    const visiblePostIds = (visiblePosts ?? []).map((p: { id: string }) => p.id)
    if (visiblePostIds.length === 0) {
      // no visible posts → skip vote block, fall through to reaction
    } else {
      const [pollRes, proconRes] = await Promise.all([
        admin.from('post_polls').select('post_id, option_1, option_2, option_3, option_4, ends_at').in('post_id', visiblePostIds).or(`ends_at.is.null,ends_at.gte.${now}`),
        admin.from('post_procon').select('post_id').in('post_id', visiblePostIds),
      ])
      const pollRows = (pollRes.data ?? []) as { post_id: string; option_1: string; option_2: string; option_3?: string | null; option_4?: string | null }[]
      const proconRows = (proconRes.data ?? []) as { post_id: string }[]
    const pollPostIds = pollRows.map((r) => r.post_id)
    const proconPostIds = proconRows.map((r) => r.post_id)
    const [myPollVotes, myProconVotes] = await Promise.all([
      pollPostIds.length > 0 ? admin.from('post_poll_votes').select('post_id').eq('user_id', user.id).in('post_id', pollPostIds) : { data: [] },
      proconPostIds.length > 0 ? admin.from('post_procon_votes').select('post_id').eq('user_id', user.id).in('post_id', proconPostIds) : { data: [] },
    ])
    const votedPollSet = new Set((myPollVotes.data ?? []).map((v: { post_id: string }) => v.post_id))
    const votedProconSet = new Set((myProconVotes.data ?? []).map((v: { post_id: string }) => v.post_id))
    const availablePolls = pollRows.filter((row) => !votedPollSet.has(row.post_id))
    const availableProcons = proconRows.filter((row) => !votedProconSet.has(row.post_id))
    type PollChoice = { type: 'poll'; row: (typeof availablePolls)[number] }
    type ProconChoice = { type: 'procon'; post_id: string }
    const choices: PollChoice[] = availablePolls.map((row) => ({ type: 'poll', row }))
    const proconChoices: ProconChoice[] = availableProcons.map((row) => ({ type: 'procon', post_id: row.post_id }))
    const allChoices: (PollChoice | ProconChoice)[] = [...choices, ...proconChoices]
    if (allChoices.length > 0) {
      const picked = allChoices[Math.floor(Math.random() * allChoices.length)]!
      if (picked.type === 'poll') {
        const row = picked.row
        const optionCount = [row.option_1, row.option_2, row.option_3, row.option_4].filter(Boolean).length
        const optionIndex = Math.floor(Math.random() * optionCount)
        const { error: voteErr } = await supabase
          .from('post_poll_votes')
          .insert({ post_id: row.post_id, user_id: user.id, option_index: optionIndex })
        if (!voteErr) return { ok: true, action: 'poll_vote', postId: row.post_id, optionIndex }
        if (voteErr.code !== '23505') return { ok: false, error: voteErr.message }
      } else {
        const side = Math.random() < 0.5 ? 'pro' : 'con'
        const { error: proconErr } = await supabase
          .from('post_procon_votes')
          .insert({ post_id: picked.post_id, user_id: user.id, side })
        if (!proconErr) return { ok: true, action: 'procon_vote', postId: picked.post_id, side }
        if (proconErr.code !== '23505') return { ok: false, error: proconErr.message }
      }
    }
    }
  }

  if (doCommentLike) {
    const { data: posts } = await admin.from('posts').select('id').eq('status', 'visible').limit(200)
    const postIds = (posts ?? []).map((p: { id: string }) => p.id)
    if (postIds.length > 0) {
      const { data: comments } = await admin
        .from('comments')
        .select('id')
        .in('post_id', postIds)
      const commentIds = (comments ?? []).map((c: { id: string }) => c.id)
      if (commentIds.length > 0) {
        const { data: myLikes } = await admin
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', user.id)
          .in('comment_id', commentIds)
        const likedSet = new Set((myLikes ?? []).map((l: { comment_id: string }) => l.comment_id))
        const available = commentIds.filter((id: string) => !likedSet.has(id))
        if (available.length > 0) {
          const commentId = available[Math.floor(Math.random() * available.length)]!
          const { error: likeErr } = await supabase
            .from('comment_likes')
            .insert({ comment_id: commentId, user_id: user.id })
          if (!likeErr) return { ok: true, action: 'comment_like', commentId }
        }
      }
    }
    // 하트 누를 댓글 없으면 리액션으로 넘어가지 않고 여기서 종료 (30%가 reaction으로 잡아먹히지 않도록)
    return { ok: false, error: 'no comments to like' }
  }

  if (doComment) {
    const { data: posts } = await admin
      .from('posts')
      .select('id, title, body')
      .eq('status', 'visible')
      .order('created_at', { ascending: false })
      .limit(50)
    const list = (posts ?? []) as { id: string; title: string | null; body: string }[]
    if (list.length === 0) return { ok: false, error: 'no posts to comment' }
    const postIds = list.map((p) => p.id)
    const { data: pollRows } = await admin
      .from('post_polls')
      .select('post_id, question, option_1, option_2, option_3, option_4')
      .in('post_id', postIds)
    const pollByPostId = new Map<string, { question: string; options: string[] }>()
    for (const row of pollRows ?? []) {
      const r = row as { post_id: string; question: string; option_1: string; option_2: string; option_3?: string | null; option_4?: string | null }
      const options = [r.option_1, r.option_2, r.option_3, r.option_4].filter(Boolean) as string[]
      pollByPostId.set(r.post_id, { question: r.question, options })
    }
    const post = list[Math.floor(Math.random() * list.length)]!
    const poll = pollByPostId.get(post.id)
    const { data: comments } = await admin
      .from('comments')
      .select('body')
      .eq('post_id', post.id)
      .order('created_at', { ascending: false })
      .limit(5)
    const existingBodies = (comments ?? []).map((c: { body: string }) => c.body?.trim()).filter(Boolean)
    const bodyText = await generateCommentContent(
      seed.persona_prompt,
      post.title ?? '',
      post.body ?? '',
      existingBodies,
      poll
    )
    const { data: comment, error } = await supabase
      .from('comments')
      .insert({ post_id: post.id, user_id: user.id, body: bodyText })
      .select('id')
      .single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, action: 'comment', commentId: comment.id, postId: post.id }
  }

  // 리액션: 남의 글에 이모지 반응 (본인 글 제외)
  const { data: postsForReaction } = await admin
    .from('posts')
    .select('id, user_id')
    .eq('status', 'visible')
    .neq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(80)
  const otherPosts = (postsForReaction ?? []) as { id: string; user_id: string }[]
  if (otherPosts.length === 0) return { ok: false, error: 'no other posts to react' }
  const shuffled = [...otherPosts].sort(() => Math.random() - 0.5)
  const reactionType = REACTION_TYPES[Math.floor(Math.random() * REACTION_TYPES.length)]!
  for (const post of shuffled) {
    const { error } = await supabase
      .from('post_reactions')
      .insert({ post_id: post.id, user_id: user.id, reaction_type: reactionType })
    if (!error) return { ok: true, action: 'reaction', postId: post.id, reactionType }
    if (error.code === '23505') continue
    return { ok: false, error: error.message }
  }
  return { ok: false, error: 'could not add reaction (all already reacted?)' }
}

const LUNCH_VOTE_TYPES = ['want', 'unsure', 'wtf'] as const

/** 시드 한 명으로 점메추 추천 1건에 리액션(투표) 1개 넣기. 이미 투표한 시드는 호출하지 말 것. */
export async function runOneLunchVote(
  seed: SeedWithPersona,
  recommendationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!SEED_PASSWORD) return { ok: false, error: 'SEED_ACCOUNT_PASSWORD missing' }
  const auth = await supabaseAsSeed(seed.email)
  if (!auth) return { ok: false, error: 'seed login failed' }
  const { supabase, user } = auth
  const voteType = LUNCH_VOTE_TYPES[Math.floor(Math.random() * LUNCH_VOTE_TYPES.length)]!
  const { error } = await supabase.from('lunch_votes').insert({
    recommendation_id: recommendationId,
    user_id: user.id,
    vote_type: voteType,
  })
  if (!error) return { ok: true }
  if (error.code === '23505') return { ok: false, error: 'already voted' }
  return { ok: false, error: error.message }
}
