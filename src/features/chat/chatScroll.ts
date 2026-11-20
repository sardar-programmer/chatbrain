/**
 * Pure scrolling helper and scroll container resolver.
 */

export function shouldFollow(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): boolean {
  const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
  return distanceFromBottom <= 80;
}

export function getScrollContainer(node: HTMLElement | null): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return (
    document.getElementById('main-content') ||
    node?.closest('#main-content') ||
    node?.parentElement ||
    null
  );
}
