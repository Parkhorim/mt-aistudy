import { WritingStats } from '../types/simulator';

export const EMPTY_WRITING_STATS: WritingStats = {
  typedChars: 0,
  deletedChars: 0,
  activeMs: 0,
  pasteBlocked: 0,
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
  if (len === 0 && stats.pasteBlocked === 0) {
    return { hasData: true, summary: '작성 안 함', flags: [] };
  }

  const summary = `직접 입력 ${stats.typedChars}자 · 지움 ${stats.deletedChars}자 · 작성 ${formatDuration(
    stats.activeMs
  )}`;

  const flags: string[] = [];
  if (stats.pasteBlocked > 0) {
    flags.push(`붙여넣기 시도 ${stats.pasteBlocked}회`);
  }
  if (stats.largeInsertions > 0) {
    flags.push(`한 번에 ${LARGE_INSERT_CHARS}자 이상 입력 ${stats.largeInsertions}회`);
  }
  if (len >= 40) {
    const msPerChar = stats.activeMs / len;
    if (msPerChar < 120) {
      flags.push(`작성 속도가 매우 빠름 (글자당 ${Math.round(msPerChar)}ms)`);
    }
  }
  if (len >= 80 && stats.deletedChars === 0) {
    flags.push('긴 글을 한 번도 고치지 않고 작성');
  }
  return { hasData: true, summary, flags };
}
