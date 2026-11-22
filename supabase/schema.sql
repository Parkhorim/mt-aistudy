-- =====================================================================
-- 고1 정보 기계학습 시뮬레이터 · Supabase 스키마
-- Supabase 대시보드 → SQL Editor → New query 에 전체를 붙여넣고 [Run]
-- =====================================================================

-- 1) 학생 제출 기록 테이블 (제출할 때마다 한 줄씩 쌓임, 교사 화면에서는 학번별 최신 1건 표시)
create table if not exists public.submissions (
  id                       uuid primary key default gen_random_uuid(),
  student_id               text        not null check (char_length(student_id) between 1 and 20),
  name                     text        not null check (char_length(name) between 1 and 30),
  school_class             text        not null default '' check (char_length(school_class) <= 30),
  submitted_at             timestamptz not null default now(),
  mission_progress_percent int         not null default 0 check (mission_progress_percent between 0 and 100),
  quiz_total_score         int         not null default 0 check (quiz_total_score >= 0),
  quiz_max_score           int         not null default 0 check (quiz_max_score >= 0),
  reflection_count         int         not null default 0 check (reflection_count between 0 and 6),
  algorithm_details        jsonb       not null default '{}'::jsonb
                                       check (pg_column_size(algorithm_details) < 200000)
);

create index if not exists submissions_student_id_idx on public.submissions (student_id, submitted_at desc);

-- 2) 교사 명단 테이블 (여기에 등록된 이메일 계정만 학생 데이터를 조회/삭제 가능)
create table if not exists public.teachers (
  email text primary key
);

-- 3) 현재 로그인한 사용자가 교사인지 확인하는 함수
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teachers
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- 4) 행 수준 보안(RLS) 켜기
alter table public.submissions enable row level security;
alter table public.teachers    enable row level security;  -- 정책 없음 = 앱에서 접근 불가 (SQL Editor에서만 관리)

-- 학생(로그인 없음, anon): 제출(INSERT)만 가능. 다른 학생 기록은 읽을 수 없음.
drop policy if exists "students can submit" on public.submissions;
create policy "students can submit"
  on public.submissions for insert
  to anon, authenticated
  with check (true);

-- 교사: 조회 / 삭제 가능
drop policy if exists "teachers can read" on public.submissions;
create policy "teachers can read"
  on public.submissions for select
  to authenticated
  using (public.is_teacher());

drop policy if exists "teachers can delete" on public.submissions;
create policy "teachers can delete"
  on public.submissions for delete
  to authenticated
  using (public.is_teacher());

-- 5) 교사 화면 실시간 갱신(Realtime)용
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'submissions'
  ) then
    alter publication supabase_realtime add table public.submissions;
  end if;
end $$;

-- 6) 교사 계정 등록 (아래 이메일을 실제 선생님 이메일로 바꿔서 실행)
--    계정 자체는 Authentication → Users → [Add user] 에서 같은 이메일로 만듭니다.
-- insert into public.teachers (email) values ('teacher@example.com');
