/**
 * A pure timer: `elapsed` accumulates toward `duration`. Callers gate on its
 * presence (`world.countdowns.has(key)`) rather than reacting to expiry —
 * there is no stored callback/event here, so `timerSystem` never needs to
 * know what a countdown is "for".
 */
export type CountdownData = {
  elapsed: number;
  duration: number;
};

export const Countdown = (duration: number): CountdownData => ({
  elapsed: 0,
  duration,
});
