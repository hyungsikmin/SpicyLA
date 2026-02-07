import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const REPORT_EMAIL = process.env.REPORT_EMAIL || process.env.ADMIN_EMAIL
const REPORT_FROM = process.env.REPORT_FROM || '아니스비 신고 <onboarding@resend.dev>'

export async function POST(request: Request) {
  if (!resend || !REPORT_EMAIL) {
    return NextResponse.json({ ok: true })
  }
  try {
    const body = await request.json()
    const { targetUserId, targetAnonName, reason, detail } = body as {
      targetUserId?: string
      targetAnonName?: string
      reason?: string
      detail?: string
    }
    const subject = `[아니스비] 신고 접수: ${targetAnonName ?? targetUserId ?? 'unknown'}`
    const text = [
      `대상 사용자 ID: ${targetUserId ?? '-'}`,
      `표시 이름: ${targetAnonName ?? '-'}`,
      `신고 사유: ${reason ?? '-'}`,
      detail ? `추가 설명:\n${detail}` : '',
    ].filter(Boolean).join('\n\n')

    await resend.emails.send({
      from: REPORT_FROM,
      to: [REPORT_EMAIL],
      subject,
      text,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[report] email send error:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
