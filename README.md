This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Database (Supabase)

리액션 기능을 쓰려면 `post_reactions` 테이블이 있어야 합니다. 한 번만 적용하면 됩니다.

**방법 1 – Supabase 대시보드**
1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 선택
2. **SQL Editor** → **New query**
3. `supabase/migrations/20250203100000_post_reactions.sql` 내용 전체 복사 후 실행

**방법 2 – Supabase CLI**
```bash
supabase db push
```

### 이미지 첨부 (post_media + Storage)

글쓰기 이미지 첨부를 쓰려면 **post_media 테이블**과 **Storage 버킷**이 있어야 합니다.

**1) 테이블·버킷·RLS 한 번에 적용**  
Supabase **SQL Editor**에서 아래 파일 내용 전체를 **순서대로** 실행하세요.

1. `supabase/migrations/20250203200000_post_media_and_storage.sql`  
   → post_media 테이블 생성, 버킷 생성, RLS 정책 생성

(이미 `post_media` 테이블이 있고 "new row violates row-level security policy"만 나온다면, `20250203300000_fix_rls_post_media_storage.sql`만 실행하면 됩니다.)

**2) 버킷이 없어 "Bucket not found"가 나온다면**  
아래처럼 Dashboard에서 버킷만 만드세요.

**Supabase Dashboard에서 버킷 만들기**
1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 선택
2. 왼쪽 **Storage** 클릭
3. **New bucket** 클릭
4. **Name**: `post-images` (정확히 이 이름)
5. **Public bucket** 켜기
6. (선택) **File size limit**: 5MB, **Allowed MIME types**: image/jpeg, image/png, image/gif, image/webp
7. **Create bucket** 클릭

버킷 생성 후 **RLS 정책**이 필요합니다. SQL Editor에서 `supabase/migrations/20250203300000_fix_rls_post_media_storage.sql` 내용을 실행하세요. (이미지 업로드 시 "new row violates row-level security policy"가 나오면 이 파일을 실행하면 됩니다.)

## Pre-launch checks

배포 전 점검은 [docs/PRE_LAUNCH_CHECKLIST.md](docs/PRE_LAUNCH_CHECKLIST.md)를 사용하세요. 자동 검증(`npm run lint`, `npm run typecheck`, `npm run build`)과 수동 체크리스트, E2E 스모크 테스트 안내가 있습니다. E2E는 최초 1회 `npx playwright install` 후 `npm run test:e2e`로 실행합니다.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
