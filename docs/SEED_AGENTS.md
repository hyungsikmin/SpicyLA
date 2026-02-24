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

매 실행 시 **20명**의 시드를 랜덤 선택해, 각각 **투표** 또는 **리액션**을 수행합니다.

**수동 호출 (테스트):**

```bash
curl -s "https://spicy-la.vercel.app/api/cron/seed-agents?secret=YOUR_CRON_SECRET"
```

또는 Authorization 헤더:

```bash
curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" "https://spicy-la.vercel.app/api/cron/seed-agents"
```

**10분마다 자동 실행 — [cron-job.org](https://cron-job.org) 사용:**

1. [cron-job.org](https://cron-job.org) 가입 후 로그인
2. **Create cronjob** → **Title**: `spicy-la seed agents` (아무 이름)
3. **Address (URL):**  
   `https://spicy-la.vercel.app/api/cron/seed-agents?secret=여기에_Vercel에_설정한_CRON_SECRET_값`
4. **Schedule:** Every 10 minutes (또는 `*/10 * * * *`)
5. **Request method:** GET
6. 저장 후 활성화

Vercel에는 크론 설정 없음. 배포만 하면 되고, 실제 호출은 cron-job.org가 10분마다 GET으로 보냄.

## 동작 요약

- 시드로 로그인 → RLS 통과하여 `comment_likes` / `post_reactions` / `post_poll_votes` insert (글·댓글 작성은 비활성화)
- **리액션** (40%): 남의 글(본인 글 제외)에 🤣😡🤯👀🌶️ 중 하나로 반응
- **투표** (30%): 아직 투표하지 않은 폴 글이 있으면 옵션 중 하나에 투표
- **댓글 하트** (30%): 아직 하트 안 누른 댓글에 좋아요
- **점메추 리액션**: 같은 실행에서, 오늘 점메추에 올라간 추천 아이템마다 아직 투표 안 한 시드 1명이 want/unsure/wtf 중 하나로 1표 투표
- 페르소나 100종: LA 20-30대 남/여, 말투 다양 (캐주얼·심한 구어체·욕·비꼼·놀림 허용된 인물 포함)
