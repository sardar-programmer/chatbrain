import { useEffect, useRef, useState } from 'react';

/**
 * Throttles text updates for heavy Markdown AST rendering during active streaming.
 * Immediately updates when streaming completes or text is reset.
 */
export function useThrottledText(
  text: string,
  isStreaming: boolean,
  intervalMs = 80,
): string {
  const [throttledText, setThrottledText] = useState(text);
  const lastUpdateTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isStreaming || !text) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setThrottledText(text);
      lastUpdateTimeRef.current = Date.now();
      return;
    }

    const now = Date.now();
    const elapsed = now - lastUpdateTimeRef.current;

    if (elapsed >= intervalMs) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setThrottledText(text);
      lastUpdateTimeRef.current = now;
    } else if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setThrottledText(text);
        lastUpdateTimeRef.current = Date.now();
      }, intervalMs - elapsed);
    }
  }, [text, isStreaming, intervalMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return isStreaming ? throttledText : text;
}
