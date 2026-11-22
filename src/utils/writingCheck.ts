import { AlgorithmProgress, NoteField, WritingStats } from '../types/simulator';

/** 칸마다 최소 글자 수 */
export const MIN_NOTE_CHARS = 10;

export const NOTE_FIELDS: {
  key: NoteField;
  label: string;
  csvLabel: string;
  question: string;
  placeholder: string;
}[] = [
  {
    key: 'practice',
    label: '① 실습해 본 내용',
    csvLabel: '실습한내용',
    question: '무엇을 바꿔 보았고, 화면에서 어떤 결과(숫자·모양)가 나왔나요?',
    placeholder: '', // 알고리즘별 안내(reflectionExampleHint)를 사용
  },
  {
    key: 'learned',
    label: '② 알게 된 내용',
    csvLabel: '알게된내용',
    question: '이 실습으로 새롭게 알게 된 점이나 궁금해진 점은 무엇인가요?',
    placeholder:
      '실험 결과가 왜 그렇게 나왔는지, 이 알고리즘의 특징이나 실생활에 쓸 수 있는 곳 등 내 생각을 적어보세요.',
  },
];

/** 이번 버전(두 칸) 기록인지 */
function hasSplitNotes(p?: AlgorithmProgress): boolean {
  return !!p && (p.practiceNote !== undefined || p.learnedNote !== undefined);
}

/** 서술형 기록 완료 여부: 두 칸 모두 10자 이상 (이전 기록은 한 칸 10자 이상) */
export function isReflectionComplete(p?: AlgorithmProgress): boolean {
  if (!p) return false;
  if (hasSplitNotes(p)) {
    return (
      (p.practiceNote || '').trim().length >= MIN_NOTE_CHARS &&
      (p.learnedNote || '').trim().length >= MIN_NOTE_CHARS
    );
  }
  return (p.reflection || '').trim().length >= MIN_NOTE_CHARS;
}

/** 두 칸을 하나의 전체 소감 문자열로 합침 (CSV·이전 화면 호환용) */
export function combineNotes(practice: string, learned: string): string {
  const parts: string[] = [];
  if (practice.trim()) parts.push(`[실습해 본 내용] ${practice.trim()}`);
  if (learned.trim()) parts.push(`[알게 된 내용] ${learned.trim()}`);
  return parts.join('\n');
}

export interface ReflectionPart {
  key: NoteField | 'legacy';
  label: string;
  text: string;
  assessment: WritingAssessment;
}

/** 교사 화면에 보여줄 칸별 내용과 작성 과정 평가 */
export function getReflectionParts(p?: AlgorithmProgress): ReflectionPart[] {
  if (!p) return [];
  if (!hasSplitNotes(p)) {
    return [
      {
        key: 'legacy',
        label: '탐구 소감',
        text: p.reflection || '',
        assessment: assessWriting(undefined, p.reflection || ''),
      },
    ];
  }
  return NOTE_FIELDS.map((f) => {
    const text = (f.key === 'practice' ? p.practiceNote : p.learnedNote) || '';
    return {
      key: f.key,
      label: f.label,
      text,
      // 손대지 않은 칸은 기록이 없으므로 빈 기록으로 보고 "작성 안 함"으로 표시
      assessment: assessWriting(p.writingStats?.[f.key] ?? EMPTY_WRITING_STATS, text),
    };
  });
}

/** 한 알고리즘의 서술형 기록에서 붙여넣기 횟수·글자 수 합계 */
export function getPasteTotals(p?: AlgorithmProgress): { count: number; chars: number } {
  let count = 0;
  let chars = 0;
  for (const f of NOTE_FIELDS) {
    const s = p?.writingStats?.[f.key];
    count += s?.pasteCount ?? 0;
    chars += s?.pastedChars ?? 0;
  }
  return { count, chars };
}

/** 확인 필요 신호가 하나라도 있는지 */
export function hasWritingFlags(p?: AlgorithmProgress): boolean {
  return getReflectionParts(p).some((part) => part.assessment.flags.length > 0);
}

export const EMPTY_WRITING_STATS: WritingStats = {
  typedChars: 0,
  deletedChars: 0,
  activeMs: 0,
  pasteCount: 0,
  pastedChars: 0,
  largeInsertions: 0,
};

/** 한 번의 입력 변화로 이만큼 이상 글자가 늘면 "한꺼번에 입력"으로 기록 */
export const LARGE_INSERT_CHARS = 15;
/** 입력 사이 간격은 최대 이 시간까지만 작성 시간으로 셈 (자리 비움 제외) */
export const MAX_GAP_MS = 30_000;

export interface WritingAssessment {
  hasData: boolean;
  summary: string; // 예: "직접 입력 182자 · 지움 23자 · 작성 4분 10초"
  flags: string[]; // 확인이 필요한 이유 (비어 있으면 특이사항 없음)
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

/**
 * 작성 기록을 교사가 읽기 쉬운 요약과 "확인 필요" 신호로 바꿉니다.
 * 신호는 AI 사용의 증거가 아니라, 학생에게 직접 물어볼 만한 지점입니다.
 */
export function assessWriting(stats: WritingStats | undefined, text: string): WritingAssessment {
  const len = (text || '').trim().length;
  if (!stats) {
    return { hasData: false, summary: '작성 과정 기록 없음', flags: [] };
  }
  const pasteCount = stats.pasteCount ?? 0;
  const pastedChars = stats.pastedChars ?? 0;
  if (len === 0 && pasteCount === 0) {
    return { hasData: true, summary: '작성 안 함', flags: [] };
  }

  const summary = `직접 입력 ${stats.typedChars}자 · 지움 ${stats.deletedChars}자 · 작성 ${formatDuration(
    stats.activeMs
  )}`;

  const flags: string[] = [];
  if (pasteCount > 0) {
    flags.push(`붙여넣기 ${pasteCount}회 (${pastedChars}자)`);
  }
  if (stats.largeInsertions > 0) {
    flags.push(`한 번에 ${LARGE_INSERT_CHARS}자 이상 입력 ${stats.largeInsertions}회`);
  }
  if (len >= 30) {
    const msPerChar = stats.activeMs / len;
    if (msPerChar < 120) {
      flags.push(`작성 속도가 매우 빠름 (글자당 ${Math.round(msPerChar)}ms)`);
    }
  }
  if (len >= 60 && stats.deletedChars === 0) {
    flags.push('긴 글을 한 번도 고치지 않고 작성');
  }
  return { hasData: true, summary, flags };
}
