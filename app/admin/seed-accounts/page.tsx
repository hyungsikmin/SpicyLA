import { getSeedAccountsList } from './actions'
import SeedAccountsClient from './SeedAccountsClient'

export default async function SeedAccountsPage() {
  const seedPassword = process.env.SEED_ACCOUNT_PASSWORD ?? null
  const listRes = await getSeedAccountsList()
  const initialList = listRes.ok ? listRes.list : []

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">시드 계정</h1>
      <p className="text-muted-foreground text-sm mb-6">
        UGC 런칭용 계정을 이메일 인증 없이 생성하고, 여기서 바로 해당 계정으로 로그인할 수 있어요. Supabase
        Dashboard에서 Authentication → Email 사용 설정이 필요하고, 서버에 SUPABASE_SERVICE_ROLE_KEY,
        SEED_ACCOUNT_PASSWORD 환경 변수를 설정해야 해요.
      </p>
      <SeedAccountsClient seedPassword={seedPassword} initialList={initialList} />
    </div>
  )
}
