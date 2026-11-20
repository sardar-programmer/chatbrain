import { useState, useRef, useEffect, useCallback } from 'react';
import { shouldFollow, getScrollContainer } from './chatScroll';

export function useChatScroll() {
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const shouldFollowRef = useRef(true);
  const rafScrollRef = useRef<number | null>(null);

  const setContainerRef = useCallback((node: HTMLElement | null) => {
    if (node) setScrollContainer(getScrollContainer(node));
  }, []);

  useEffect(() => {
    if (!scrollContainer) return;
    const onScroll = () => {
      const follow = shouldFollow(
        scrollContainer.scrollTop,
        scrollContainer.scrollHeight,
        scrollContainer.clientHeight,
      );
      shouldFollowRef.current = follow;
      setShowJumpToLatest(!follow);
    };
    scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', onScroll);
  }, [scrollContainer]);

  const jumpToLatest = useCallback(() => {
    shouldFollowRef.current = true;
    setShowJumpToLatest(false);
    if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }, [scrollContainer]);

  const scheduleStickToBottom = useCallback(() => {
    if (!scrollContainer || !shouldFollowRef.current) return;
    if (rafScrollRef.current === null) {
      rafScrollRef.current = requestAnimationFrame(() => {
        rafScrollRef.current = null;
        if (shouldFollowRef.current && scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      });
    }
  }, [scrollContainer]);

  return {
    scrollContainer,
    showJumpToLatest,
    setContainerRef,
    jumpToLatest,
    scheduleStickToBottom,
  };
}
