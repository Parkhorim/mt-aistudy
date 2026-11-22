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
}

/** 서술형 소감 작성 과정 기록 (직접 작성 여부 확인용) */
export interface WritingStats {
  typedChars: number; // 입력으로 늘어난 글자 수 누적
  deletedChars: number; // 지운 글자 수 누적
  activeMs: number; // 입력 사이 간격 누적(한 번에 최대 30초) = 대략적인 작성 시간
  pasteBlocked: number; // 막힌 붙여넣기/끌어놓기 시도 횟수
  largeInsertions: number; // 한 번에 15자 이상 들어온 횟수 (자동완성·우회 입력 의심)
}

export interface AlgorithmProgress {
  completedMissions: string[];
  quizAnswers: Record<string, number | string>;
  quizSubmitted: boolean;
  quizScore: number;
  reflection: string;
  metricsSummary: string;
  updatedAt: string;
  writingStats?: WritingStats; // 이전 버전 제출 기록에는 없음
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
