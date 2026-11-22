import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  HelpCircle,
  BookOpenCheck,
  PenLine,
  Award,
  Lock,
} from 'lucide-react';
import { AlgorithmMeta, AlgorithmProgress, NoteField, WritingStats } from '../types/simulator';
import { isQuizAnswerCorrect } from '../data/algorithms';
import {
  EMPTY_WRITING_STATS,
  isReflectionComplete,
  LARGE_INSERT_CHARS,
  MAX_GAP_MS,
  MIN_NOTE_CHARS,
  NOTE_FIELDS,
} from '../utils/writingCheck';

interface Props {
  algorithm: AlgorithmMeta;
  progress: AlgorithmProgress;
  onSelectQuizAnswer: (questionId: string, answer: number | string) => void;
  onSubmitQuiz: () => void;
  onChangeNote: (field: NoteField, text: string, writingStats: WritingStats) => void;
}

export const ChecklistQuizPanel: React.FC<Props> = ({
  algorithm,
  progress,
  onSelectQuizAnswer,
  onSubmitQuiz,
  onChangeNote,
}) => {
  const completedCount = progress.completedMissions.length;
  const totalMissions = algorithm.missions.length;
  const allQuizzesAnswered = algorithm.quizzes.every((q) => {
    const val = progress.quizAnswers[q.id];
    if (q.type === 'short') return typeof val === 'string' && val.trim().length > 0;
    return val !== undefined;
  });
  const reflectionReady = isReflectionComplete(progress);
  const practiceOnly = !!algorithm.practiceOnly;

  // ── 직접 작성 확인: 붙여넣기는 허용하되 칸마다 몰래 기록 (교사 감점 자료) ──
  const lastInputAt = useRef<Record<NoteField, number | null>>({ practice: null, learned: null });
  // 붙여넣기 직후 들어오는 변경은 "직접 입력"이 아니라 붙여넣기로 셈
  const pendingPaste = useRef<Record<NoteField, number | null>>({ practice: null, learned: null });

  const noteText = (field: NoteField) =>
    (field === 'practice' ? progress.practiceNote : progress.learnedNote) || '';
  const noteStats = (field: NoteField) => progress.writingStats?.[field] ?? EMPTY_WRITING_STATS;

  const handleNoteInput = (field: NoteField, text: string) => {
    const stats = noteStats(field);
    const delta = text.length - noteText(field).length;
    const now = Date.now();
    const last = lastInputAt.current[field];
    const gap = last === null ? 0 : Math.min(now - last, MAX_GAP_MS);
    lastInputAt.current[field] = now;

    const pasted = pendingPaste.current[field];
    if (pasted !== null) {
      pendingPaste.current[field] = null;
      onChangeNote(field, text, {
        ...stats,
        pasteCount: (stats.pasteCount ?? 0) + 1,
        pastedChars: (stats.pastedChars ?? 0) + pasted,
        deletedChars: stats.deletedChars + Math.max(-delta, 0),
        activeMs: stats.activeMs + gap,
      });
      return;
    }

    onChangeNote(field, text, {
      ...stats,
      typedChars: stats.typedChars + Math.max(delta, 0),
      deletedChars: stats.deletedChars + Math.max(-delta, 0),
      activeMs: stats.activeMs + gap,
      largeInsertions: stats.largeInsertions + (delta >= LARGE_INSERT_CHARS ? 1 : 0),
    });
  };

  // 붙여넣기/끌어놓기는 막지 않고, 들어온 글자 수만 표시해 둠 (다음 입력 변경에서 기록)
  const markPaste = (field: NoteField) => (e: React.ClipboardEvent | React.DragEvent) => {
    const data =
      'clipboardData' in e ? e.clipboardData : (e as React.DragEvent).dataTransfer;
    const len = data?.getData('text/plain')?.length ?? 0;
    // 빈 클립보드는 변경 이벤트가 없으므로 표시하지 않음
    pendingPaste.current[field] = len > 0 ? len : null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
      {/* 1. 단계별 실습 미션 체크리스트 (실습 수행 자동 인증 전용) */}
      <div
        className={`${
          practiceOnly ? 'lg:col-span-12' : 'lg:col-span-4'
        } bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between`}
      >
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
              <BookOpenCheck className="w-5 h-5 text-indigo-600" />
              {practiceOnly ? '체험 미션' : '수행 과정 1: 실습 미션 체크'}
            </h3>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                completedCount === totalMissions
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-indigo-50 text-indigo-700'
              }`}
            >
              {completedCount} / {totalMissions} 완료
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            위 시뮬레이터에서 미션을 직접 수행해야만 자동으로 체크됩니다.
          </p>
          {practiceOnly && (
            <p className="text-xs font-semibold text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-4">
              이 단원은 자유롭게 체험해 보는 활동이에요. 퀴즈와 서술형 기록이 없고, 점수에도 들어가지 않아요.
            </p>
          )}

          <div className="space-y-2.5">
            {algorithm.missions.map((m) => {
              const isDone = progress.completedMissions.includes(m.id);
              return (
                <div
                  key={m.id}
                  className={`p-3.5 rounded-xl border transition select-none flex items-start gap-3 ${
                    isDone
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-slate-50/70 border-slate-200 text-slate-800'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold">{m.title}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{m.description}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                        #{m.badgeText}
                      </span>
                      <span
                        className={`text-[11px] font-bold ${
                          isDone ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      >
                        {isDone ? '자동 인증 완료' : '미수행'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>최근 실습 기록</span>
          <span className="font-mono font-semibold text-slate-700">{progress.metricsSummary}</span>
        </div>
      </div>

      {!practiceOnly && (
        <>
      {/* 2. 핵심 개념 확인 미니 퀴즈 */}
      <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
              <HelpCircle className="w-5 h-5 text-amber-600" />
              수행 과정 2: 개념 확인 퀴즈
            </h3>
            {progress.quizSubmitted ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                <Award className="w-3.5 h-3.5" />
                {progress.quizScore} / {algorithm.quizzes.length}점
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-500">
                {algorithm.quizzes.length}문항
              </span>
            )}
          </div>

          <div className="space-y-4">
            {algorithm.quizzes.map((q, qIdx) => {
              const selected = progress.quizAnswers[q.id];
              const isCorrect = isQuizAnswerCorrect(q, selected);

              return (
                <div
                  key={q.id}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-bold text-slate-800 leading-snug">
                      Q{qIdx + 1}. {q.question}
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        q.type === 'short'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {q.type === 'short' ? '서답형' : '객관식'}
                    </span>
                  </div>

                  {q.type === 'multiple' && q.options ? (
                    <div className="space-y-1.5">
                      {q.options.map((opt, optIdx) => {
                        const isPicked = selected === optIdx;
                        let btnStyle =
                          'bg-white border-slate-200 text-slate-700 hover:bg-slate-100';
                        if (progress.quizSubmitted) {
                          if (optIdx === q.correctIndex) {
                            btnStyle =
                              'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold';
                          } else if (isPicked && !isCorrect) {
                            btnStyle = 'bg-rose-50 border-rose-300 text-rose-800 line-through';
                          }
                        } else if (isPicked) {
                          btnStyle =
                            'bg-indigo-600 border-indigo-600 text-white font-semibold';
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => onSelectQuizAnswer(q.id, optIdx)}
                            className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition cursor-pointer ${btnStyle}`}
                          >
                            {optIdx + 1}. {opt}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={typeof selected === 'string' ? selected : ''}
                        onChange={(e) => onSelectQuizAnswer(q.id, e.target.value)}
                        placeholder={q.placeholder || '핵심 용어를 직접 입력하세요'}
                        className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                          progress.quizSubmitted
                            ? isCorrect
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold'
                              : 'bg-rose-50 border-rose-300 text-rose-900'
                            : 'bg-white border-slate-300 text-slate-800'
                        }`}
                      />
                      {progress.quizSubmitted && !isCorrect && q.acceptedAnswers && (
                        <div className="text-[11px] font-semibold text-emerald-700">
                          인정 정답: {q.acceptedAnswers[0]}
                        </div>
                      )}
                    </div>
                  )}

                  {progress.quizSubmitted && (
                    <div
                      className={`mt-2 p-2.5 rounded-lg text-[11px] leading-relaxed ${
                        isCorrect
                          ? 'bg-emerald-100/70 text-emerald-900'
                          : 'bg-amber-100/70 text-amber-950'
                      }`}
                    >
                      <strong>{isCorrect ? '정답입니다! ' : '오답 해설: '}</strong>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onSubmitQuiz}
          disabled={!allQuizzesAnswered}
          className={`mt-4 w-full py-2.5 px-4 rounded-xl font-bold text-xs transition cursor-pointer ${
            allQuizzesAnswered
              ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {progress.quizSubmitted ? '퀴즈 다시 채점하기' : '정답 제출 및 채점하기'}
        </button>
      </div>

      {/* 3. 서술형 실험 분석 및 느낀 점 (관찰 상황 가이드 포함) */}
      <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
              <PenLine className="w-5 h-5 text-emerald-600" />
              수행 과정 3: 탐구 분석 및 소감
            </h3>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                reflectionReady
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {reflectionReady ? '작성 완료' : `두 칸 모두 ${MIN_NOTE_CHARS}자 이상`}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 mb-3 space-y-2">
            <div className="text-xs font-bold text-indigo-950">
              📝 이런 상황을 관찰하고 기록해보세요
            </div>
            <p className="text-[11px] text-indigo-900 leading-relaxed">
              {algorithm.reflectionPrompt}
            </p>
            <ul className="space-y-1 text-[11px] text-indigo-950 bg-white/80 rounded-lg p-2.5 border border-indigo-100/80">
              {algorithm.reflectionGuideSteps.map((step, i) => (
                <li key={i} className="leading-relaxed">
                  {step}
                </li>
              ))}
            </ul>
          </div>

          <div
            role="note"
            className="mb-3 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-700"
          >
            ⚠ 다른 곳의 글(AI 답변, 인터넷, 친구 글 등)을 복사해서 붙여넣지 마세요. 반드시 직접
            입력해야 합니다.
          </div>
          <div className="space-y-3">
            {NOTE_FIELDS.map((f) => {
              const text = noteText(f.key);
              const len = text.trim().length;
              const ok = len >= MIN_NOTE_CHARS;
              const inputId = `note-${algorithm.id}-${f.key}`;
              return (
                <div key={f.key}>
                  <div className="flex items-baseline justify-between mb-1">
                    <label htmlFor={inputId} className="text-xs font-bold text-slate-800">
                      {f.label}
                    </label>
                    <span
                      className={`text-[11px] font-semibold ${
                        ok ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {len}자
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-1.5">{f.question}</p>
                  <textarea
                    id={inputId}
                    rows={4}
                    value={text}
                    onChange={(e) => handleNoteInput(f.key, e.target.value)}
                    onPaste={markPaste(f.key)}
                    onDrop={markPaste(f.key)}
                    placeholder={f.placeholder || algorithm.reflectionExampleHint}
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-none"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          내 실험을 떠올리며 직접 적어주세요.
        </div>
      </div>
        </>
      )}
    </div>
  );
};
