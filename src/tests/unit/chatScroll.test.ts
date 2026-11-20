import { describe, it, expect } from 'vitest';
import { shouldFollow } from '../../features/chat/chatScroll';

describe('chatScroll - shouldFollow', () => {
  it('returns true when scrolled exactly to the bottom', () => {
    // scrollHeight = 1000, clientHeight = 400, scrollTop = 600 (distance = 0)
    expect(shouldFollow(600, 1000, 400)).toBe(true);
  });

  it('returns true when user is within 80px of the bottom', () => {
    // distance = 1000 - (550 + 400) = 50px <= 80px
    expect(shouldFollow(550, 1000, 400)).toBe(true);
    // distance = 1000 - (520 + 400) = 80px <= 80px (exact boundary)
    expect(shouldFollow(520, 1000, 400)).toBe(true);
  });

  it('returns false when user scrolled up more than 80px from bottom', () => {
    // distance = 1000 - (519 + 400) = 81px > 80px
    expect(shouldFollow(519, 1000, 400)).toBe(false);
    // distance = 1000 - (300 + 400) = 300px > 80px
    expect(shouldFollow(300, 1000, 400)).toBe(false);
  });

  it('handles negative scroll offset gracefully', () => {
    expect(shouldFollow(0, 1000, 400)).toBe(false);
  });
});
