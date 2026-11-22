import { createClient, SupabaseClient } from '@supabase/supabase-js';

const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};

const SUPABASE_URL = env.VITE_SUPABASE_URL || '';
// 새 Publishable key(sb_publishable_...) 또는 기존 anon key(eyJ...) 둘 다 허용
const SUPABASE_ANON_KEY =
  env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';

/** 환경변수가 설정되지 않았으면 null → 앱은 브라우저 저장(체험 모드)으로 동작 */
export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          // 공용 PC에서 교사 로그인이 오래 남지 않도록 탭 단위 세션 사용
          storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
        },
      })
    : null;

export const isSupabaseConfigured = supabase !== null;
