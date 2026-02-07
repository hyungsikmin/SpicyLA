'use client'

export default function CommentBody({ body }: { body: string }) {
  const parts: React.ReactNode[] = []
  const matches = [...body.matchAll(/@(익명\d+)/g)]
  let lastIndex = 0
  for (const m of matches) {
    const index = m.index ?? 0
    parts.push(body.slice(lastIndex, index))
    parts.push(
      <span
        key={index}
        className="font-medium text-[var(--spicy)]"
      >
        @{m[1]}
      </span>
    )
    lastIndex = index + m[0].length
  }
  parts.push(body.slice(lastIndex))
  return (
    <p className="text-[15px] leading-snug whitespace-pre-line text-foreground/95">
      {parts}
    </p>
  )
}
