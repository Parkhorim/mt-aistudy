# 고등학교 1학년 정보 - 기계학습 알고리즘 인터랙티브 시뮬레이터 (Supabase 버전)

[twhorim/aistudy01](https://github.com/twhorim/aistudy01)의 시뮬레이터를 바탕으로, 학생 제출 데이터를 **구글 시트 대신 Supabase(PostgreSQL DB)** 에 저장하도록 바꾼 버전입니다.

## 1. 무엇이 달라졌나요?

| 항목 | 기존 (구글 시트) | 이 버전 (Supabase) |
|---|---|---|
| 학생 제출 저장 | Apps Script 웹앱 → 시트에 한 줄 추가 | Supabase `submissions` 테이블에 저장 |
| 교사 인증 | 브라우저에 저장된 4자리 PIN | Supabase 계정(이메일+비밀번호) 로그인 + 교사 명단 확인 |
| 데이터 보호 | 웹앱 URL을 아는 사람은 누구나 전체 조회 가능 | 학생은 **제출만** 가능, **조회·삭제는 등록된 교사만** (DB 행 수준 보안 RLS) |
| 실시간 갱신 | 새로고침 버튼 | 학생이 제출하면 교사 화면이 자동 갱신 (Realtime) |
| 다시 제출 | 시트에 줄 추가 | 모든 제출 이력이 남고, 화면에는 학번별 최신 1건 표시 |

Supabase를 연결하지 않으면 **체험 모드**로 동작합니다(기존처럼 이 브라우저에만 저장, 교사 PIN `8688`).

## 2. Supabase 설정 (처음 한 번, 약 10분)

### 1단계: 프로젝트 만들기
1. <https://supabase.com> 에 가입 후 **New project** 를 만듭니다. (무료 플랜으로 충분합니다. 지역은 `Northeast Asia (Seoul)` 권장)

### 2단계: 테이블과 보안 정책 만들기
1. 왼쪽 메뉴 **SQL Editor → New query** 를 엽니다.
2. 이 저장소의 [`supabase/schema.sql`](supabase/schema.sql) 내용을 **전부 복사해 붙여넣고 [Run]** 을 누릅니다.

### 3단계: 교사 계정 만들기
1. 왼쪽 메뉴 **Authentication → Users → Add user → Create new user** 에서 선생님 이메일과 비밀번호로 계정을 만듭니다. (*Auto Confirm User* 체크)
2. 다시 **SQL Editor** 에서 아래를 실행해 그 이메일을 교사 명단에 등록합니다.
   ```sql
   insert into public.teachers (email) values ('선생님이메일@school.kr');
   ```
3. (권장) **Authentication → Sign In / Providers** 에서 *Allow new users to sign up* 을 끕니다. 교사 명단에 없는 계정은 어차피 데이터를 볼 수 없지만, 불필요한 가입을 막아 줍니다.

### 4단계: 앱에 연결 정보 넣기
1. **Project Settings → API** 에서 `Project URL` 과 `anon public` 키를 복사합니다.
   - ⚠️ `service_role` 키는 절대 사용하지 마세요. 이 키가 노출되면 모든 보안 정책이 무시됩니다.
2. 로컬 실행: `.env.example` 을 복사해 `.env` 파일을 만들고 값을 채웁니다.
   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
3. Vercel 배포: **Settings → Environment Variables** 에 같은 두 값을 등록하고 **Redeploy** 합니다.

## 3. 실행 방법

[Node.js LTS](https://nodejs.org/) 를 설치한 뒤 프로젝트 폴더에서:

```bash
npm install
npm run dev
```

- 학생: 학번·이름 입력 → 실습 → **[수행 결과 제출하기]** → "선생님 서버(Supabase)에 제출 완료" 가 뜨면 성공
- 교사: 우측 상단 **[교사용 관리]** → 교사 이메일/비밀번호 로그인 → 제출 현황 조회, 상세 보기, CSV 다운로드, 삭제

## 4. 데이터 확인·백업

- Supabase **Table Editor → submissions** 에서 원본 데이터를 바로 볼 수 있고, 우측 상단 **Export → CSV** 로 내려받을 수 있습니다.
- `algorithm_details` 열(JSON)에 알고리즘별 미션·퀴즈 답·탐구 소감 전체가 들어 있습니다.

## 5. 주요 파일

| 파일 | 역할 |
|---|---|
| `supabase/schema.sql` | 테이블, 교사 명단, RLS 보안 정책, Realtime 설정 |
| `src/lib/supabase.ts` | Supabase 클라이언트 (환경변수 없으면 체험 모드) |
| `src/utils/storage.ts` | 제출(`submitToCloudAndLocal`), 조회(`fetchSubmissionsFromCloud`), 삭제(`deleteSubmission`) |
| `src/components/TeacherAdminDashboard.tsx` | 교사 로그인·현황판·실시간 갱신 |

## 6. 개인정보 관련 참고

학번·이름·서술형 답안은 학생 개인정보입니다. 학기가 끝나면 아래처럼 지우는 것을 권장합니다.

```sql
delete from public.submissions where submitted_at < '2027-03-01';
```
