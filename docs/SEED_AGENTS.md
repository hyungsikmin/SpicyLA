# 시드 AI 에이전트

시드 계정(1~100 등)에 LA 20-30대 페르소나를 부여하고, 주기적으로 **글** 또는 **댓글**을 자동 생성합니다.

## 환경 변수

- `OPENAI_API_KEY` — OpenAI API 키 (gpt-4o-mini 사용)
- `SEED_ACCOUNT_PASSWORD` — 시드 계정 공통 비밀번호 (기존과 동일)
- `CRON_SECRET` — cron 호출 시 인증용 (아무 난수 문자열)

## DB 마이그레이션

```bash
npx supabase db push
# 또는 20250223100000_seed_accounts_persona.sql 적용
```

`seed_accounts` 테이블에 `persona_prompt` 컬럼이 추가됩니다.

## 페르소나 할당

1. 관리자 → 시드 계정 페이지
2. **「페르소나 할당」** 버튼 클릭 → 페르소나가 비어 있는 시드에 LA 20-30대 템플릿이 할당됩니다.

## Cron으로 에이전트 실행

매 실행 시 **2~3명**의 시드를 랜덤 선택해, 각각 **글 1개** 또는 **댓글 1개**를 생성합니다.

```bash
curl -X POST "https://your-app.vercel.app/api/cron/seed-agents" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

또는 쿼리 파라미터:

```
POST /api/cron/seed-agents?secret=YOUR_CRON_SECRET
```

**Vercel Cron** 사용 시 프로젝트 루트에 `vercel.json`이 있으며, **10분마다** 실행되도록 설정되어 있음:

- `schedule`: `*/10 * * * *` (10분마다, UTC 기준)
- **중요**: Vercel은 크론을 **GET** 요청으로 호출함. 라우트에서 GET을 처리해야 10분마다 실제로 동작함.
- Vercel 프로젝트에 **CRON_SECRET** 환경 변수 설정 (Production). Vercel이 `Authorization: Bearer <CRON_SECRET>` 를 붙여주지 않는 경우에도, User-Agent `vercel-cron/1.0` 인 GET은 인증 통과하도록 되어 있음.
- 크론은 **Production 배포**에만 동작함. Preview 배포에서는 실행되지 않음.

## 동작 요약

- 시드로 로그인 → RLS 통과하여 `comments` / `post_reactions` / `post_poll_votes` insert (글 생성은 비활성화)
- **투표** (50%): 아직 투표하지 않은 폴 글이 있으면 옵션 중 하나에 투표
- **리액션** (50%): 남의 글(본인 글 제외)에 🤣😡🤯👀🌶️ 중 하나로 반응
- **댓글**: 비활성화
- 페르소나 100종: LA 20-30대 남/여, 말투 다양 (캐주얼·심한 구어체·욕·비꼼·놀림 허용된 인물 포함)
