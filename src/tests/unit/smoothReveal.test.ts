import { describe, it, expect } from 'vitest';
import { nextRevealIndex } from '../../features/chat/smoothReveal';

describe('nextRevealIndex (Smooth Reveal Helper)', () => {
  it('advances in whole-word steps at word boundaries', () => {
    const target = 'Hello wonderful world of data science';
    // dtMs = 100ms at base speed (18 wps) -> fractionalWords = 1.8 -> 2 words
    const idx = nextRevealIndex(0, target, 100, true);
    // Index should end right after "wonderful "
    expect(idx).toBe(16);
    expect(target.slice(0, idx)).toBe('Hello wonderful ');
  });

  it('drains large backlog within ~1 second', () => {
    // 40 words
    const words = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
    // dtMs = 1000ms (1s). Speed adapts to ~40 wps
    const idx = nextRevealIndex(0, words, 1000, true);
    expect(idx).toBe(words.length);
  });

  it('respects hard cap of ~60 words per second even with huge backlog', () => {
    // 120 words
    const words = Array.from({ length: 120 }, (_, i) => `word${i}`).join(' ');
    // dtMs = 1000ms. Speed should cap at 60 wps
    const idx = nextRevealIndex(0, words, 1000, true);
    // Should advance ~60 words, not all 120
    const revealedWords = words.slice(0, idx).trim().split(/\s+/).length;
    expect(revealedWords).toBe(60);
    expect(idx).toBeLessThan(words.length);
  });

  it('drains remaining words quickly (~400 ms) when stream is done (isStreaming = false)', () => {
    // 12 words remaining
    const words = 'one two three four five six seven eight nine ten eleven twelve';
    const idx = nextRevealIndex(0, words, 400, false);
    expect(idx).toBe(words.length);
  });

  it('immediately returns target.length when reducedMotion is true', () => {
    const target = 'No animations for reduced motion users.';
    const idx = nextRevealIndex(0, target, 16, true, true);
    expect(idx).toBe(target.length);
  });

  it('returns target.length when already at or past end', () => {
    const target = 'Completed';
    expect(nextRevealIndex(target.length, target, 100, true)).toBe(target.length);
  });
});
