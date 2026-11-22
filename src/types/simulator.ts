export type AlgorithmId =
  | 'linear-regression'
  | 'logistic-regression'
  | 'knn'
  | 'decision-tree'
  | 'kmeans'
  | 'perceptron';

export type AlgorithmCategory =
  | '지도학습 · 회귀'
  | '지도학습 · 분류'
  | '비지도학습 · 군집화'
  | '인공신경망 · 딥러닝 기초';

export interface MissionItem {
  id: string;
  title: string;
  description: string;
  badgeText: string;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple' | 'short';
  question: string;
  options?: string[];
  correctIndex?: number;
  acceptedAnswers?: string[];
  placeholder?: string;
  explanation: string;
}

export interface AlgorithmMeta {
  id: AlgorithmId;
  name: string;
  englishName: string;
  category: AlgorithmCategory;
  color: string;
  shortDesc: string;
  conceptSummary: string;
  realLifeExample: string;
  keyFormulaOrRule: string;
  missions: MissionItem[];
  quizzes: QuizQuestion[];
  reflectionPrompt: string;
  reflectionGuideSteps: string[];
  reflectionExampleHint: string;
  /** true면 체험 미션만 하고 점수(미션률·퀴즈·서술형)에는 넣지 않음 */
  practiceOnly?: boolean;
}

/** 서술형 소감 작성 과정 기록 (직접 작성 여부 확인용) */
export interface WritingStats {
  typedChars: number; // 입력으로 늘어난 글자 수 누적
  deletedChars: number; // 지운 글자 수 누적
  activeMs: number; // 입력 사이 간격 누적(한 번에 최대 30초) = 대략적인 작성 시간
  pasteCount: number; // 붙여넣기/끌어놓기 횟수 (허용하되 기록)
  pastedChars: number; // 붙여넣기로 들어온 글자 수 누적
  largeInsertions: number; // 한 번에 15자 이상 들어온 횟수 (자동완성·우회 입력 의심)
}

/** 서술형 기록 칸: 실습해 본 내용 / 알게 된 내용 */
export type NoteField = 'practice' | 'learned';

export interface AlgorithmProgress {
  completedMissions: string[];
  quizAnswers: Record<string, number | string>;
  quizSubmitted: boolean;
  quizScore: number;
  /** 두 칸을 합친 전체 소감 (이전 버전 기록은 이 칸 하나만 있음) */
  reflection: string;
  metricsSummary: string;
  updatedAt: string;
  practiceNote?: string; // ① 실습해 본 내용
  learnedNote?: string; // ② 알게 된 내용
  writingStats?: Partial<Record<NoteField, WritingStats>>; // 칸별 작성 과정 기록
}

export interface StudentInfo {
  studentId: string; // 예: 10101 (1학년 1반 1번)
  name: string;
  schoolClass: string; // 예: 1학년 1반
}

export interface StudentSubmissionRecord {
  id: string;
  studentId: string;
  name: string;
  schoolClass: string;
  submittedAt: string;
  missionProgressPercent: number;
  quizTotalScore: number;
  quizMaxScore: number;
  reflectionCount: number;
  algorithmDetails: Record<AlgorithmId, AlgorithmProgress>;
}
