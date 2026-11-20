import { useEffect, useRef, useState } from 'react';

/**
 * Pure helper calculating the next word-boundary reveal index.
 * - Base speed ~18 wps
 * - Backlog speedup to drain within ~1s
 * - Hard cap ~60 wps
 * - Stream finish (not streaming) drains in ~400ms
 * - reducedMotion immediately returns target.length
 */
export function nextRevealIndex(
  shown: number,
  target: string,
  dtMs: number,
  isStreaming: boolean,
  reducedMotion = false,
): number {
  if (reducedMotion || shown >= target.length || dtMs <= 0) {
    return target.length;
  }

  const remainingText = target.slice(shown);
  const wordEndRegex = /\S+\s*/g;
  const wordMatches: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = wordEndRegex.exec(remainingText)) !== null) {
    wordMatches.push(shown + match.index + match[0].length);
  }

  if (wordMatches.length === 0) {
    return target.length;
  }

  const totalRemainingWords = wordMatches.length;

  let speedWps: number;
  if (!isStreaming) {
    speedWps = Math.max(18, totalRemainingWords / 0.4);
  } else {
    const backlogSpeed = totalRemainingWords / 1.0;
    speedWps = Math.min(60, Math.max(18, backlogSpeed));
  }

  const fractionalWords = (speedWps * dtMs) / 1000;
  const wordsToAdvance = Math.max(1, Math.round(fractionalWords));
  const targetIndex = Math.min(wordsToAdvance, totalRemainingWords) - 1;

  return wordMatches[targetIndex] ?? target.length;
}

/**
 * Hook for smooth word-by-word reveal during streaming.
 * Cancels cleanly on unmount (no leaked rAF).
 */
export function useSmoothText(
  targetText: string,
  isStreaming: boolean,
  terminalStatus?: 'done' | 'stopped' | 'error' | null,
): string {
  const [shownLength, setShownLength] = useState(0);
  const shownLengthRef = useRef(0);
  shownLengthRef.current = shownLength;

  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const isReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    // Show immediately if stopped/error, tab hidden, or reduced motion
    if (
      terminalStatus === 'stopped' ||
      terminalStatus === 'error' ||
      isReducedMotion ||
      (typeof document !== 'undefined' && document.hidden)
    ) {
      setShownLength(targetText.length);
      return;
    }

    if (!isStreaming && shownLengthRef.current === 0) {
      setShownLength(targetText.length);
      return;
    }

    const step = (time: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time;
      }
      const dtMs = Math.min(100, Math.max(1, time - lastTimeRef.current));
      lastTimeRef.current = time;

      const currentShown = shownLengthRef.current;
      if (currentShown < targetText.length) {
        const nextIdx = nextRevealIndex(
          currentShown,
          targetText,
          dtMs,
          isStreaming,
          Boolean(isReducedMotion),
        );
        shownLengthRef.current = nextIdx;
        setShownLength(nextIdx);

        if (nextIdx < targetText.length) {
          rafRef.current = requestAnimationFrame(step);
          return;
        }
      }
      rafRef.current = null;
    };

    if (shownLengthRef.current < targetText.length && rafRef.current === null) {
      lastTimeRef.current = null;
      rafRef.current = requestAnimationFrame(step);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [targetText, isStreaming, terminalStatus, isReducedMotion]);

  if (!isStreaming && shownLength >= targetText.length) {
    return targetText;
  }

  return targetText.slice(0, shownLength);
}
