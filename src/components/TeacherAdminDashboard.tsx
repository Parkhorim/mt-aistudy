import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Download,
  Search,
  Database,
  Eye,
  Trash2,
  X,
  Users,
  Award,
  CheckCircle2,
  FileSpreadsheet,
  Lock,
  LogOut,
} from 'lucide-react';
import { ALGORITHMS } from '../data/algorithms';
import { StudentSubmissionRecord } from '../types/simulator';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { assessWriting } from '../utils/writingCheck';

/** 한 학생의 알고리즘별 소감 중 "확인 필요" 신호가 있는 개수 */
function countFlaggedReflections(rec: StudentSubmissionRecord): number {
  return ALGORITHMS.filter((a) => {
    const d = rec.algorithmDetails?.[a.id];
    return assessWriting(d?.writingStats, d?.reflection || '').flags.length > 0;
  }).length;
}
import {
  deleteSubmission,
  fetchSubmissionsFromCloud,
  getAdminPin,
  SAMPLE_SUBMISSIONS,
} from '../utils/storage';

export const TeacherAdminDashboard: React.FC = () => {
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [teacherEmail, setTeacherEmail] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [loggingIn, setLoggingIn] = useState<boolean>(false);

  const [records, setRecords] = useState<StudentSubmissionRecord[]>([]);
  const [includeSampleData, setIncludeSampleData] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [cloudStatus, setCloudStatus] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'time' | 'studentId' | 'score'>('time');

  const [selectedStudent, setSelectedStudent] =
    useState<StudentSubmissionRecord | null>(null);

  const refreshData = async () => {
    setLoading(true);
    const res = await fetchSubmissionsFromCloud();
    setRecords(res.records);
    if (res.fromCloud) {
      setCloudStatus(
        `Supabase 실시간 연결됨 · 마지막 갱신 ${new Date().toLocaleTimeString('ko-KR')}`
      );
    } else if (res.error) {
      setCloudStatus(`이 브라우저 데이터 표시 중 (Supabase 오류: ${res.error})`);
    } else {
      setCloudStatus(
        '체험 모드: 이 브라우저에 제출된 데이터만 표시 중 (Supabase 연결 시 전 학급 실시간 취합)'
      );
    }
    setLoading(false);
  };

  // Supabase 교사 로그인 확인 (등록된 교사 이메일인지 DB 함수로 검사)
  const verifyTeacher = async (email: string): Promise<boolean> => {
    if (!supabase) return false;
    const { data, error } = await supabase.rpc('is_teacher');
    if (error || data !== true) {
      await supabase.auth.signOut();
      setPinError(
        error
          ? `교사 확인 실패: ${error.message}`
          : '교사 명단(teachers 테이블)에 등록되지 않은 계정입니다.'
      );
      return false;
    }
    setTeacherEmail(email);
    setAuthenticated(true);
    setPinError('');
    return true;
  };

  // 새로고침해도 같은 탭에서는 로그인 유지
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user.email;
      if (email) verifyTeacher(email);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    refreshData();
    if (!supabase) return;
    // 학생이 제출하면 교사 화면 자동 갱신
    const client = supabase;
    const channel = client
      .channel('submissions-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions' },
        () => refreshData()
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      // 체험 모드: 기존 PIN 방식
      if (pinInput.trim() === getAdminPin()) {
        setAuthenticated(true);
        setPinError('');
      } else {
        setPinError('비밀번호가 일치하지 않습니다.');
      }
      return;
    }
    setLoggingIn(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailInput.trim(),
      password: pinInput,
    });
    if (error || !data.user?.email) {
      setPinError('이메일 또는 비밀번호가 올바르지 않습니다.');
    } else {
      await verifyTeacher(data.user.email);
    }
    setLoggingIn(false);
  };

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    setAuthenticated(false);
    setTeacherEmail('');
    setRecords([]);
    setPinInput('');
  };

  // 브라우저 확인창(window.confirm)이 막힌 환경도 있어 화면 안에서 한 번 더 누르는 방식으로 확인
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string>('');

  const handleDelete = async (rec: StudentSubmissionRecord) => {
    if (pendingDeleteId !== rec.studentId) {
      setPendingDeleteId(rec.studentId);
      setDeleteError('');
      return;
    }
    setPendingDeleteId(null);
    const res = await deleteSubmission(rec.studentId);
    if (!res.ok) {
      setDeleteError(`${rec.studentId} ${rec.name} 삭제 실패: ${res.error}`);
    } else {
      setDeleteError('');
    }
    refreshData();
  };

  const combinedRecords = React.useMemo(() => {
    const map = new Map<string, StudentSubmissionRecord>();
    if (includeSampleData) {
      for (const s of SAMPLE_SUBMISSIONS) {
        map.set(s.studentId, s);
      }
    }
    for (const r of records) {
      map.set(r.studentId, r);
    }
    let list = Array.from(map.values());

    if (selectedClass !== 'ALL') {
      list = list.filter((item) => item.schoolClass === selectedClass);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.studentId.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'studentId') return a.studentId.localeCompare(b.studentId);
      if (sortBy === 'score') {
        return (
          b.missionProgressPercent +
          b.quizTotalScore * 5 -
          (a.missionProgressPercent + a.quizTotalScore * 5)
        );
      }
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });

    return list;
  }, [records, includeSampleData, selectedClass, searchQuery, sortBy]);

  const classOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of [...records, ...(includeSampleData ? SAMPLE_SUBMISSIONS : [])]) {
      if (r.schoolClass) set.add(r.schoolClass);
    }
    return Array.from(set).sort();
  }, [records, includeSampleData]);

  const handleDownloadCsv = () => {
    const headers = [
      '학번',
      '이름',
      '학반',
      '제출일시',
      '전체미션달성률(%)',
      '퀴즈총점',
      '서술형작성수(6개중)',
      '작성과정_확인필요_소감수',
      ...ALGORITHMS.flatMap((a) => [
        `${a.name}_미션수`,
        `${a.name}_퀴즈점수`,
        `${a.name}_탐구소감`,
        `${a.name}_작성과정`,
      ]),
    ];

    const escapeCsv = (val: string | number) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = combinedRecords.map((r) => {
      const algCols = ALGORITHMS.flatMap((a) => {
        const d = r.algorithmDetails?.[a.id];
        const w = assessWriting(d?.writingStats, d?.reflection || '');
        return [
          `${d?.completedMissions?.length || 0}/${a.missions.length}`,
          `${d?.quizScore || 0}/${a.quizzes.length}`,
          d?.reflection || '',
          w.flags.length > 0 ? `${w.summary} [확인필요: ${w.flags.join(', ')}]` : w.summary,
        ];
      });

      return [
        r.studentId,
        r.name,
        r.schoolClass,
        new Date(r.submittedAt).toLocaleString('ko-KR'),
        `${r.missionProgressPercent}%`,
        `${r.quizTotalScore}/${r.quizMaxScore}`,
        `${r.reflectionCount}/6`,
        countFlaggedReflections(r),
        ...algCols,
      ]
        .map(escapeCsv)
        .join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `고1정보_기계학습시뮬레이터_제출현황_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white rounded-2xl border border-slate-200 p-7 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">교사용 실시간 관리 페이지</h2>
        <p className="text-xs text-slate-500 mt-1 mb-5">
          학생들의 학번별 기계학습 실습 미션 달성률, 퀴즈 점수, 서술형 탐구 소감을 실시간으로 조회하고 엑셀(CSV)로 다운로드합니다.
        </p>

        <div
          className={`mb-4 text-[11px] font-semibold px-3 py-2 rounded-lg border ${
            isSupabaseConfigured
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          {isSupabaseConfigured
            ? 'Supabase 연결됨 · 교사 계정(이메일)으로 로그인하세요.'
            : '체험 모드 (Supabase 미연결) · 이 브라우저에 저장된 제출만 볼 수 있습니다.'}
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {isSupabaseConfigured && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">교사 이메일</label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="teacher@school.kr"
                autoComplete="username"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isSupabaseConfigured ? '비밀번호' : '교사 인증 비밀번호 입력'}
            </label>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              autoComplete="current-password"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus={!isSupabaseConfigured}
            />
            {pinError && <p className="text-xs text-rose-600 mt-1.5 font-medium">{pinError}</p>}
          </div>
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm transition cursor-pointer"
          >
            {loggingIn ? '확인 중...' : '관리자 대시보드 입장하기'}
          </button>
        </form>
      </div>
    );
  }

  const avgMission =
    combinedRecords.length > 0
      ? Math.round(
          combinedRecords.reduce((s, r) => s + r.missionProgressPercent, 0) /
            combinedRecords.length
        )
      : 0;

  const avgQuiz =
    combinedRecords.length > 0
      ? (
          combinedRecords.reduce((s, r) => s + r.quizTotalScore, 0) /
          combinedRecords.length
        ).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      {/* 상단 요약 배너 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" />
              교사용 수행평가 · 실시간 학습 모니터링
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-2">
              학생 수행 과정 및 제출 결과 현황판
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{cloudStatus}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border ${
                isSupabaseConfigured
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
              title={teacherEmail || undefined}
            >
              <Database className="w-4 h-4" />
              {isSupabaseConfigured ? 'Supabase 연결됨' : '체험 모드 (브라우저 저장)'}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              로그아웃
            </button>
            <button
              type="button"
              onClick={refreshData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              엑셀(CSV) 채점표 다운로드
            </button>
          </div>
        </div>

        {/* 요약 통계 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-medium">조회된 제출 학생 수</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {combinedRecords.length}명
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-medium">학급 평균 실습 미션 달성률</div>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">{avgMission}%</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-medium">학급 평균 개념 퀴즈 점수</div>
              <div className="text-2xl font-extrabold text-amber-600 mt-1">
                {avgQuiz} <span className="text-xs font-normal text-slate-500">/ 18점 만점</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 필터 & 검색 바 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="학번 또는 이름 검색..."
              className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
          >
            <option value="ALL">전체 학급 보기</option>
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'time' | 'studentId' | 'score')}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
          >
            <option value="time">최신 제출순</option>
            <option value="studentId">학번 오름차순</option>
            <option value="score">성취도 높은순</option>
          </select>
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeSampleData}
            onChange={(e) => setIncludeSampleData(e.target.checked)}
            className="rounded accent-indigo-600"
          />
          예시 학생 데이터(3명) 함께 표시
        </label>
      </div>

      {deleteError && (
        <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
          {deleteError}
        </div>
      )}

      {/* 제출 목록 테이블 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3.5 px-4">학번 / 이름</th>
                <th className="py-3.5 px-3">학반</th>
                <th className="py-3.5 px-3">미션 달성률</th>
                <th className="py-3.5 px-3">퀴즈 점수</th>
                <th className="py-3.5 px-3">탐구 소감</th>
                <th className="py-3.5 px-4">6대 알고리즘별 수행 요약</th>
                <th className="py-3.5 px-3">제출 시각</th>
                <th className="py-3.5 px-4 text-right">상세 보기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {combinedRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    아직 제출된 학생 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                combinedRecords.map((rec) => {
                  const isSample = rec.id.startsWith('sample_');
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 text-sm">
                          {rec.studentId} {rec.name}
                        </div>
                        {isSample && (
                          <span className="inline-block text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded mt-0.5">
                            예시 데이터
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-medium text-slate-600">
                        {rec.schoolClass}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${rec.missionProgressPercent}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-800">
                            {rec.missionProgressPercent}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                          {rec.quizTotalScore} / {rec.quizMaxScore}점
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-700">
                        {rec.reflectionCount} / 6개 작성
                        {(() => {
                          const n = countFlaggedReflections(rec);
                          return n > 0 ? (
                            <span
                              className="block mt-1 w-fit text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded"
                              title="상세/소감에서 이유를 확인하세요. AI 사용의 증거는 아닙니다."
                            >
                              ⚠ 작성 과정 확인 {n}
                            </span>
                          ) : null;
                        })()}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {ALGORITHMS.map((alg) => {
                            const d = rec.algorithmDetails?.[alg.id];
                            const mDone = (d?.completedMissions?.length || 0) === alg.missions.length;
                            const hasRef = (d?.reflection || '').trim().length >= 10;
                            return (
                              <span
                                key={alg.id}
                                title={`${alg.name}: 미션 ${d?.completedMissions?.length || 0}/${
                                  alg.missions.length
                                }, 퀴즈 ${d?.quizScore || 0}점`}
                                className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                                  mDone && hasRef
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                    : (d?.completedMissions?.length || 0) > 0
                                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                                    : 'bg-slate-50 border-slate-200 text-slate-400'
                                }`}
                              >
                                {alg.name}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-500">
                        {new Date(rec.submittedAt).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1">
                        <button
                          type="button"
                          onClick={() => setSelectedStudent(rec)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          상세/소감
                        </button>
                        {!isSample && (
                          <button
                            type="button"
                            onClick={() => handleDelete(rec)}
                            className={
                              pendingDeleteId === rec.studentId
                                ? 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition cursor-pointer'
                                : 'p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer'
                            }
                            title="기록 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                            {pendingDeleteId === rec.studentId && '한 번 더 눌러 삭제'}
                          </button>
                        )}
                        {!isSample && pendingDeleteId === rec.studentId && (
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(null)}
                            className="px-2 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 font-semibold transition cursor-pointer"
                          >
                            취소
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 학생 개별 상세 보기 모달 */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-xl overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-indigo-300">
                  {selectedStudent.schoolClass} · 제출시각:{' '}
                  {new Date(selectedStudent.submittedAt).toLocaleString('ko-KR')}
                </span>
                <h3 className="text-lg font-extrabold mt-0.5">
                  {selectedStudent.studentId} {selectedStudent.name} 학생 수행 결과 상세 리포트
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {ALGORITHMS.map((alg) => {
                const detail = selectedStudent.algorithmDetails?.[alg.id];
                const mCount = detail?.completedMissions?.length || 0;
                return (
                  <div
                    key={alg.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-slate-900 text-sm">
                        [{alg.category}] {alg.name} ({alg.englishName})
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                          실습 미션: {mCount} / {alg.missions.length}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                          퀴즈: {detail?.quizScore || 0} / {alg.quizzes.length}점
                        </span>
                        {detail?.metricsSummary && (
                          <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-mono">
                            {detail.metricsSummary}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-800">
                      <div className="font-bold text-slate-500 mb-1">학생 작성 탐구 소감:</div>
                      {detail?.reflection ? (
                        <p className="leading-relaxed whitespace-pre-wrap">{detail.reflection}</p>
                      ) : (
                        <p className="text-slate-400 italic">작성된 서술형 소감이 없습니다.</p>
                      )}
                      {(() => {
                        const w = assessWriting(detail?.writingStats, detail?.reflection || '');
                        return (
                          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px]">
                            <span className="font-bold text-slate-500">작성 과정: </span>
                            <span className="text-slate-600">{w.summary}</span>
                            {w.flags.length > 0 && (
                              <div className="mt-1 px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
                                ⚠ 확인 필요: {w.flags.join(' · ')}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
