import { ImageResponse } from 'next/og'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const alt = '아니근데'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseServer()
  const { data: post } = await supabase
    .from('posts')
    .select('title, body')
    .eq('id', id)
    .single()

  const title = post?.title?.trim() || '제목 없음'
  const bodyLine = post?.body?.replace(/\s+/g, ' ').trim().slice(0, 60) || ''
  const body = bodyLine + (bodyLine.length >= 60 ? '…' : '')

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
          color: '#e4e4e7',
          fontFamily: 'system-ui, sans-serif',
          padding: 48,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            maxWidth: 1000,
            width: '100%',
          }}
        >
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </div>
          {body ? (
            <div
              style={{
                fontSize: 28,
                color: '#a1a1aa',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {body}
            </div>
          ) : null}
          <div style={{ fontSize: 22, color: '#71717a', marginTop: 8 }}>
            아니근데
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
