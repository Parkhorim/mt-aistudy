import { ALGORITHMS } from '../data/algorithms';
import { supabase } from '../lib/supabase';
import { isReflectionComplete } from './writingCheck';
import {
  AlgorithmId,
  AlgorithmProgress,
  StudentInfo,
  StudentSubmissionRecord,
} from '../types/simulator';

const STUDENT_KEY = 'ml_sim_student_v1';
const PROGRESS_KEY = 'ml_sim_progress_v1';
const SUBMISSIONS_KEY = 'ml_sim_submissions_v1';
const ADMIN_PIN_KEY = 'ml_sim_admin_pin_v1';

/** Supabase submissions 테이블 한 행 */
interface SubmissionRow {
  id: string;
  student_id: string;
  name: string;
  school_class: string;
  submitted_at: string;
  mission_progress_percent: number;
  quiz_total_score: number;
  quiz_max_score: number;
  reflection_count: number;
  algorithm_details: Record<AlgorithmId, AlgorithmProgress>;
}

function toRow(r: StudentSubmissionRecord): Omit<SubmissionRow, 'id'> {
  return {
    student_id: r.studentId,
    name: r.name,
    school_class: r.schoolClass,
    submitted_at: r.submittedAt,
    mission_progress_percent: r.missionProgressPercent,
    quiz_total_score: r.quizTotalScore,
    quiz_max_score: r.quizMaxScore,
    reflection_count: r.reflectionCount,
    algorithm_details: r.algorithmDetails,
  };
}

function fromRow(row: SubmissionRow): StudentSubmissionRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    name: row.name,
    schoolClass: row.school_class,
    submittedAt: row.submitted_at,
    missionProgressPercent: row.mission_progress_percent,
    quizTotalScore: row.quiz_total_score,
    quizMaxScore: row.quiz_max_score,
    reflectionCount: row.reflection_count,
    algorithmDetails: row.algorithm_details,
  };
}

/** 같은 학번이 여러 번 제출했으면 가장 최근 기록만 남기고 최신순 정렬 */
function latestPerStudent(list: StudentSubmissionRecord[]): StudentSubmissionRecord[] {
  const map = new Map<string, StudentSubmissionRecord>();
  for (const r of list) {
    const prev = map.get(r.studentId);
    if (!prev || new Date(r.submittedAt) >= new Date(prev.submittedAt)) {
      map.set(r.studentId, r);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

export function createInitialProgress(): Record<AlgorithmId, AlgorithmProgress> {
  const initial: Partial<Record<AlgorithmId, AlgorithmProgress>> = {};
  for (const alg of ALGORITHMS) {
    initial[alg.id] = {
      completedMissions: [],
      quizAnswers: {},
      quizSubmitted: false,
      quizScore: 0,
      reflection: '',
      metricsSummary: '실습 전',
      updatedAt: new Date().toISOString(),
      practiceNote: '',
      learnedNote: '',
      writingStats: {},
    };
  }
  return initial as Record<AlgorithmId, AlgorithmProgress>;
}

export function parseSchoolClassFromId(studentId: string): string {
  const cleaned = studentId.trim();
  // 5자리 학번 (예: 10315 -> 1학년 3반 15번) 또는 4자리 학번 (예: 1205 -> 1학년 2반 5번)
  if (/^\d{5}$/.test(cleaned)) {
    const grade = cleaned[0];
    const cls = parseInt(cleaned.slice(1, 3), 10);
    return `${grade}학년 ${cls}반`;
  }
  if (/^\d{4}$/.test(cleaned)) {
    const grade = cleaned[0];
    const cls = cleaned[1];
    return `${grade}학년 ${cls}반`;
  }
  return '1학년 공통반';
}

export function loadStudentInfo(): StudentInfo | null {
  // 공용 노트북 환경 보호: 접속/새로고침 시 이전 학생 정보가 남아있지 않도록 항상 초기화
  try {
    localStorage.removeItem(STUDENT_KEY);
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore storage errors
  }
  return null;
}

export function saveStudentInfo(_info: StudentInfo): void {
  // 공용 PC에서 브라우저에 학생 개인정보를 남기지 않음 (메모리 상태만 유지)
}

export function clearStudentSession(): void {
  try {
    localStorage.removeItem(STUDENT_KEY);
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore storage errors
  }
}

export function loadAllProgress(): Record<AlgorithmId, AlgorithmProgress> {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore storage errors
  }
  return createInitialProgress();
}

export function saveAllProgress(_progress: Record<AlgorithmId, AlgorithmProgress>): void {
  // 공용 PC에서 이전 학생의 실습 체크 내역이 다음 학생에게 남지 않도록 로컬스토리지 저장 안 함
}

// 아래 PIN은 Supabase를 연결하지 않은 "체험 모드"에서만 쓰입니다.
// Supabase 연결 시 교사 인증은 Supabase 로그인(이메일/비밀번호)으로 처리됩니다.
export function getAdminPin(): string {
  return localStorage.getItem(ADMIN_PIN_KEY) || '8688';
}

export function setAdminPin(pin: string): void {
  localStorage.setItem(ADMIN_PIN_KEY, pin.trim() || '8688');
}

export function buildSubmissionRecord(
  student: StudentInfo,
  progress: Record<AlgorithmId, AlgorithmProgress>
): StudentSubmissionRecord {
  let totalMissions = 0;
  let completedMissions = 0;
  let quizTotalScore = 0;
  let quizMaxScore = 0;
  let reflectionCount = 0;

  for (const alg of ALGORITHMS) {
    const p = progress[alg.id];
    totalMissions += alg.missions.length;
    completedMissions += p?.completedMissions?.length || 0;
    quizMaxScore += alg.quizzes.length;
    quizTotalScore += p?.quizScore || 0;
    if (isReflectionComplete(p)) {
      reflectionCount += 1;
    }
  }

  const missionProgressPercent =
    totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0;

  return {
    id: `${student.studentId}_${Date.now()}`,
    studentId: student.studentId,
    name: student.name,
    schoolClass: student.schoolClass || parseSchoolClassFromId(student.studentId),
    submittedAt: new Date().toISOString(),
    missionProgressPercent,
    quizTotalScore,
    quizMaxScore,
    reflectionCount,
    algorithmDetails: progress,
  };
}

export function loadLocalSubmissions(): StudentSubmissionRecord[] {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StudentSubmissionRecord[];
  } catch {
    return [];
  }
}

export function saveLocalSubmission(record: StudentSubmissionRecord): StudentSubmissionRecord[] {
  const existing = loadLocalSubmissions();
  // 동일 학번이 다시 제출하면 최신 기록으로 업데이트
  const filtered = existing.filter((item) => item.studentId !== record.studentId);
  const updated = [record, ...filtered];
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteLocalSubmission(studentId: string): StudentSubmissionRecord[] {
  const existing = loadLocalSubmissions();
  const updated = existing.filter((item) => item.studentId !== studentId);
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(updated));
  return updated;
}

/**
 * 학생 제출: Supabase가 연결돼 있으면 DB에 저장(INSERT),
 * 연결이 없거나 실패하면 이 브라우저에만 임시 저장합니다.
 */
export async function submitToCloudAndLocal(
  student: StudentInfo,
  progress: Record<AlgorithmId, AlgorithmProgress>
): Promise<{
  record: StudentSubmissionRecord;
  cloudSynced: boolean;
  cloudError?: string;
}> {
  const record = buildSubmissionRecord(student, progress);

  if (!supabase) {
    saveLocalSubmission(record);
    return { record, cloudSynced: false };
  }

  // 학생(anon)은 INSERT 권한만 있으므로 결과를 되돌려 받지 않습니다(.select() 없음).
  const { error } = await supabase.from('submissions').insert(toRow(record));
  if (error) {
    saveLocalSubmission(record); // 네트워크 문제 대비 백업
    return { record, cloudSynced: false, cloudError: error.message };
  }
  return { record, cloudSynced: true };
}

/** 교사용: 제출 기록 조회 (Supabase 연결 시 DB, 아니면 이 브라우저 기록) */
export async function fetchSubmissionsFromCloud(): Promise<{
  records: StudentSubmissionRecord[];
  fromCloud: boolean;
  error?: string;
}> {
  const localRecords = loadLocalSubmissions();
  if (!supabase) {
    return { records: localRecords, fromCloud: false };
  }

  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .order('submitted_at', { ascending: false })
    .limit(5000);

  if (error) {
    return { records: localRecords, fromCloud: false, error: error.message };
  }
  const cloudRecords = (data as SubmissionRow[]).map(fromRow);
  return { records: latestPerStudent(cloudRecords), fromCloud: true };
}

/** 교사용: 해당 학번의 제출 기록 전체 삭제 */
export async function deleteSubmission(
  studentId: string
): Promise<{ ok: boolean; error?: string }> {
  deleteLocalSubmission(studentId);
  if (!supabase) return { ok: true };
  // 보안 정책에 막히면 오류 없이 0건 삭제되므로, 지워진 행을 돌려받아 확인합니다.
  const { data, error } = await supabase
    .from('submissions')
    .delete()
    .eq('student_id', studentId)
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: '삭제된 기록이 없습니다. 교사 권한(teachers 명단)을 확인하세요.' };
  }
  return { ok: true };
}

export const SAMPLE_SUBMISSIONS: StudentSubmissionRecord[] = [
  {
    id: 'sample_10101',
    studentId: '10101',
    name: '김민준',
    schoolClass: '1학년 1반',
    submittedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    missionProgressPercent: 100,
    quizTotalScore: 18,
    quizMaxScore: 18,
    reflectionCount: 6,
    algorithmDetails: {
      'linear-regression': {
        completedMissions: ['lr-adjust', 'lr-add-point', 'lr-optimal'],
        quizAnswers: { 'lr-q1': 1, 'lr-q2': 0 },
        quizSubmitted: true,
        quizScore: 2,
        reflection:
          '기울기와 절편을 조절하여 MSE를 18.4까지 줄였습니다. 이상치 점을 멀리 찍으면 직선이 그 점으로 끌려가 오차가 커진다는 점을 확인했습니다.',
        metricsSummary: 'MSE: 18.4 (w=8.2, b=24.5)',
        updatedAt: new Date().toISOString(),
      },
      'logistic-regression': {
        completedMissions: ['log-slider', 'log-threshold', 'log-accuracy'],
        quizAnswers: { 'log-q1': 1, 'log-q2': 1 },
        quizSubmitted: true,
        quizScore: 2,
        reflection:
          '시그모이드 함수를 쓰면 결과가 0~100% 확률로 나와서 합격/불합격 기준을 정하기 좋았습니다. 임계값을 0.7로 올리니 합격 판정이 더 엄격해졌습니다.',
        metricsSummary: '정확도: 92% (임계값 0.5)',
        updatedAt: new Date().toISOString(),
      },
      knn: {
        completedMissions: ['knn-place', 'knn-change-k', 'knn-boundary'],
        quizAnswers: { 'knn-q1': 1, 'knn-q2': 0 },
        quizSubmitted: true,
        quizScore: 2,
        reflection:
          'K=1일 때는 주변의 튀는 점 하나 때문에 분류가 바뀌었는데 K=5로 설정하니 경계가 매끄러워지고 안정적으로 다수결 분류가 되었습니다.',
        metricsSummary: 'K=5 (유클리드 거리)',
        updatedAt: new Date().toISOString(),
      },
      'decision-tree': {
        completedMissions: ['dt-split', 'dt-depth', 'dt-test'],
        quizAnswers: { 'dt-q1': 0, 'dt-q2': 1 },
        quizSubmitted: true,
        quizScore: 2,
        reflection:
          '스무고개처럼 당도와 크기를 차례대로 물어보며 영역을 직사각형으로 나누는 과정이 직관적이었습니다. 깊이 2에서 정확도가 94%가 되었습니다.',
        metricsSummary: '깊이 2 / 정확도 94%',
        updatedAt: new Date().toISOString(),
      },
      kmeans: {
        completedMissions: ['km-init', 'km-step', 'km-add'],
        quizAnswers: { 'km-q1': 0, 'km-q2': 0 },
        quizSubmitted: true,
        quizScore: 2,
        reflection:
          '정답 레이블이 없는 회색 점들이 중심점 이동을 4번 반복하자 3개의 뚜렷한 그룹으로 스스로 묶이는 것이 신기했습니다.',
        metricsSummary: 'K=3 (4단계 수렴 완료)',
        updatedAt: new Date().toISOString(),
      },
      perceptron: {
        completedMissions: ['pc-weights', 'pc-gate', 'pc-xor'],
        quizAnswers: { 'pc-q1': 0, 'pc-q2': 0 },
        quizSubmitted: true,
        quizScore: 2,
        reflection:
          'AND와 OR 게이트는 직선 하나로 쉽게 나뉘었지만 XOR은 직선 하나로 나눌 수 없어 은닉층을 가진 다층 퍼셉트론이 필요하다는 것을 이해했습니다.',
        metricsSummary: 'AND/OR/XOR 실습 완료',
        updatedAt: new Date().toISOString(),
      },
    },
  },
  {
    id: 'sample_10102',
    studentId: '10102',
    name: '이서연',
    schoolClass: '1학년 1반',
    submittedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    missionProgressPercent: 83,
    quizTotalScore: 15,
    quizMaxScore: 18,
    reflectionCount: 5,
    algorithmDetails: {
      'linear-regression': {
        completedMissions: ['lr-adjust', 'lr-add-point', 'lr-optimal'],
        quizAnswers: { 'lr-q1': 1, 'lr-q2': 0 },
        quizSubmitted: true,
        quizScore: 2,
        reflection: '최소제곱법으로 찾은 추세선이 내가 손으로 맞춘 것보다 MSE가 더 낮게 나왔습니다.',
        metricsSummary: 'MSE: 21.0',
        updatedAt: new Date().toISOString(),
      },
      'logistic-regression': {
        completedMissions: ['log-slider', 'log-threshold', 'log-accuracy'],
        quizAnswers: { 'log-q1': 1, 'log-q2': 1 },
        quizSubmitted: true,
        quizScore: 2,
        reflection: '합격 확률이 50%가 되는 지점이 결정 경계가 된다는 것을 그래프를 통해 확인했습니다.',
        metricsSummary: '정확도: 88%',
        updatedAt: new Date().toISOString(),
      },
      knn: {
        completedMissions: ['knn-place', 'knn-change-k', 'knn-boundary'],
        quizAnswers: { 'knn-q1': 1, 'knn-q2': 0 },
        quizSubmitted: true,
        quizScore: 2,
        reflection: 'K를 홀수로 해야 동점이 안 나온다는 점이 인상 깊었습니다.',
        metricsSummary: 'K=3',
        updatedAt: new Date().toISOString(),
      },
      'decision-tree': {
        completedMissions: ['dt-split', 'dt-depth'],
        quizAnswers: { 'dt-q1': 0, 'dt-q2': 1 },
        quizSubmitted: true,
        quizScore: 2,
        reflection: '조건 기준선을 움직일 때마다 리프 노드의 불순도가 바뀌는 것을 보았습니다.',
        metricsSummary: '깊이 2 / 정확도 90%',
        updatedAt: new Date().toISOString(),
      },
      kmeans: {
        completedMissions: ['km-init', 'km-step'],
        quizAnswers: { 'km-q1': 0, 'km-q2': 0 },
        quizSubmitted: true,
        quizScore: 2,
        reflection: '비지도학습은 정답을 알려주지 않아도 거리 계산만으로 군집을 나눈다는 차이가 있습니다.',
        metricsSummary: 'K=3 수렴 완료',
        updatedAt: new Date().toISOString(),
      },
      perceptron: {
        completedMissions: ['pc-weights'],
        quizAnswers: {},
        quizSubmitted: false,
        quizScore: 0,
        reflection: '',
        metricsSummary: '가중치 실험 중',
        updatedAt: new Date().toISOString(),
      },
    },
  },
  {
    id: 'sample_10207',
    studentId: '10207',
    name: '박지훈',
    schoolClass: '1학년 2반',
    submittedAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    missionProgressPercent: 94,
    quizTotalScore: 16,
    quizMaxScore: 18,
    reflectionCount: 6,
    algorithmDetails: {
      'linear-regression': {
        completedMissions: ['lr-adjust', 'lr-add-point', 'lr-optimal'],
        quizAnswers: { 'lr-q1': 1, 'lr-q2': 0 },
        quizSubmitted: true,
        quizScore: 2,
        reflection: '공부 시간이 늘어날수록 예상 점수가 선형적으로 증가하는 추세선을 직접 그려보았습니다.',
        metricsSummary: 'MSE: 19.2',
        updatedAt: new Date().toISOString(),
      },
      'logistic-regression': {
        completedMissions: ['log-slider', 'log-threshold', 'log-accuracy'],
        quizAnswers: { 'log-q1': 1, 'log-q2': 1 },
        quizSubmitted: true,
        quizScore: 2,
        reflection: '임계값을 조절하면 민감하게 합격/불합격 경계가 이동하는 원리를 배웠습니다.',
        metricsSummary: '정확도: 92%',
        updatedAt: new Date().toISOString(),
      },
      knn: {
        completedMissions: ['knn-place', 'knn-change-k', 'knn-boundary'],
        quizAnswers: { 'knn-q1': 1, 'knn-q2': 0 },
        quizSubmitted: true,
        quizScore: 2,
        reflection: '맨해튼 거리와 유클리드 거리에 따라 결정 경계 모양이 조금씩 달라지는 점이 흥미로웠습니다.',
        metricsSummary: 'K=5 (맨해튼 거리)',
        updatedAt: new Date().toISOString(),
      },
      'decision-tree': {
        completedMissions: ['dt-split', 'dt-depth', 'dt-test'],
        quizAnswers: { 'dt-q1': 0, 'dt-q2': 0 },
        quizSubmitted: true,
        quizScore: 1,
        reflection: '트리 구조가 눈에 보여서 컴퓨터가 어떤 기준으로 분류했는지 설명하기 쉬웠습니다.',
        metricsSummary: '깊이 2 / 정확도 94%',
        updatedAt: new Date().toISOString(),
      },
      kmeans: {
        completedMissions: ['km-init', 'km-step', 'km-add'],
        quizAnswers: { 'km-q1': 0, 'km-q2': 0 },
        quizSubmitted: true,
        quizScore: 2,
        reflection: '군집 개수 K를 2개에서 4개로 바꾸니 데이터가 더 세밀한 그룹으로 나뉘었습니다.',
        metricsSummary: 'K=4 수렴 완료',
        updatedAt: new Date().toISOString(),
      },
      perceptron: {
        completedMissions: ['pc-weights', 'pc-gate'],
        quizAnswers: { 'pc-q1': 0, 'pc-q2': 0 },
        quizSubmitted: true,
        quizScore: 2,
        reflection: '입력에 가중치를 곱하고 편향을 더한 값이 0보다 크면 뉴런이 활성화되는 원리를 확인했습니다.',
        metricsSummary: 'AND/OR 게이트 통과',
        updatedAt: new Date().toISOString(),
      },
    },
  },
];
