# 시드 AI 에이전트

시드 계정(1~100 등)에 LA 20-30대 페르소나를 부여하고, 주기적으로 **글** 또는 **댓글**을 자동 생성합니다.

## 환경 변수

- `OPENAI_API_KEY` — OpenAI API 키 (gpt-4o-mini 사용)
- `SEED_ACCOUNT_PASSWORD` — 시드 계정 공통 비밀번호 (기존과 동일)
- `CRON_SECRET` — API 호출 시 인증용 (아무 난수 문자열)

## DB 마이그레이션

```bash
npx supabase db push
# 또는 20250223100000_seed_accounts_persona.sql 적용
```

`seed_accounts` 테이블에 `persona_prompt` 컬럼이 추가됩니다.

## 페르소나 할당

1. 관리자 → 시드 계정 페이지
2. **「페르소나 할당」** 버튼 클릭 → 페르소나가 비어 있는 시드에 LA 20-30대 템플릿이 할당됩니다.

## 에이전트 실행 (로컬 CLI 전용)

매 실행 시 **20명**의 시드를 랜덤 선택해, 각각 **투표** 또는 **리액션**을 수행합니다.

**로컬에서만** 개발 서버(`npm run dev`)를 띄운 뒤, 터미널에서 호출하세요.

```bash
# 쿼리 파라미터
curl -s "http://localhost:3000/api/cron/seed-agents?secret=YOUR_CRON_SECRET"

# 또는 Authorization 헤더
curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" "http://localhost:3000/api/cron/seed-agents"
```

주기 실행이 필요하면 로컬에서 cron(맥/리눅스) 또는 스케줄러로 위 URL을 호출하면 됩니다. 배포(Vercel)에서는 크론을 사용하지 않습니다.

## 동작 요약

- 시드로 로그인 → RLS 통과하여 `comment_likes` / `post_reactions` / `post_poll_votes` insert (글·댓글 작성은 비활성화)
- **리액션** (40%): 남의 글(본인 글 제외)에 🤣😡🤯👀🌶️ 중 하나로 반응
- **투표** (30%): 아직 투표하지 않은 폴 글이 있으면 옵션 중 하나에 투표
- **댓글 하트** (30%): 아직 하트 안 누른 댓글에 좋아요
- **점메추 리액션**: 같은 실행에서, 오늘 점메추에 올라간 추천 아이템마다 아직 투표 안 한 시드 1명이 want/unsure/wtf 중 하나로 1표 투표
- 페르소나 100종: LA 20-30대 남/여, 말투 다양 (캐주얼·심한 구어체·욕·비꼼·놀림 허용된 인물 포함)
