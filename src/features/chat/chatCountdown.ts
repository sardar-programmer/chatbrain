const countdownTimers = new Map<string, ReturnType<typeof setInterval>>();

export function clearCountdown(conversationId: string): void {
  const timer = countdownTimers.get(conversationId);
  if (timer) {
    clearInterval(timer);
    countdownTimers.delete(conversationId);
  }
}

export function startCountdown(
  conversationId: string,
  seconds: number,
  attempt: number,
  onTick: (secondsLeft: number) => void,
): void {
  clearCountdown(conversationId);
  let current = seconds;
  onTick(current);

  const interval = setInterval(() => {
    current = Math.max(0, current - 1);
    onTick(current);
    if (current <= 0) {
      clearCountdown(conversationId);
    }
  }, 1000);

  countdownTimers.set(conversationId, interval);
}
