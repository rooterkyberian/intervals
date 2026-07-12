// Timer engine: schedule builder + drift-free interval timer.
// All state is computed from timestamps (performance.now()), never by
// chaining timeouts, so throttled/hidden tabs recover correctly.

export const PHASES = {
  countdown: { label: 'GET READY' },
  work: { label: 'WORK' },
  rest: { label: 'REST' },
  setrest: { label: 'SET REST' },
};

/**
 * Flatten a config into an ordered list of phases.
 * cfg: { countdown, work, rest, rounds, sets, setRest } — all seconds/counts.
 */
export function buildSchedule(cfg) {
  const phases = [];
  if (cfg.countdown > 0) {
    phases.push({ type: 'countdown', duration: cfg.countdown * 1000, set: 1, round: 1 });
  }
  for (let s = 1; s <= cfg.sets; s++) {
    for (let r = 1; r <= cfg.rounds; r++) {
      phases.push({ type: 'work', duration: cfg.work * 1000, set: s, round: r });
      if (r < cfg.rounds && cfg.rest > 0) {
        phases.push({ type: 'rest', duration: cfg.rest * 1000, set: s, round: r });
      }
    }
    if (s < cfg.sets && cfg.setRest > 0) {
      phases.push({ type: 'setrest', duration: cfg.setRest * 1000, set: s, round: cfg.rounds });
    }
  }
  return phases;
}

/** Total workout length in seconds for a config. */
export function totalDuration(cfg) {
  return buildSchedule(cfg).reduce((ms, p) => ms + p.duration, 0) / 1000;
}

export class IntervalTimer {
  /**
   * @param {Array} schedule from buildSchedule()
   * @param {Object} handlers { onPhase(phase, index), onTick(state), onFinish() }
   */
  constructor(schedule, handlers) {
    this.schedule = schedule;
    this.handlers = handlers;
    this.index = 0;
    this.phaseStart = 0; // timestamp when current phase began
    this.pausedElapsed = 0; // elapsed ms within phase at pause time
    this.state = 'idle'; // idle | running | paused | finished
    this._intervalId = null;
  }

  get phase() {
    return this.schedule[this.index];
  }

  start() {
    if (this.state !== 'idle') return;
    this.state = 'running';
    this.index = 0;
    this.phaseStart = performance.now();
    this.handlers.onPhase?.(this.phase, this.index);
    this._startTicking();
  }

  pause() {
    if (this.state !== 'running') return;
    this.pausedElapsed = performance.now() - this.phaseStart;
    this.state = 'paused';
    this._stopTicking();
    this._emitTick(performance.now());
  }

  resume() {
    if (this.state !== 'paused') return;
    this.phaseStart = performance.now() - this.pausedElapsed;
    this.state = 'running';
    this._startTicking();
  }

  /** Back to the beginning of the workout, ready to start again. */
  reset() {
    this._stopTicking();
    this.state = 'idle';
    this.index = 0;
    this.pausedElapsed = 0;
  }

  stop() {
    this._stopTicking();
    this.state = 'finished';
  }

  /** Recompute state from the clock; safe to call at any frequency. */
  tick(now = performance.now()) {
    if (this.state !== 'running') return;
    // Advance through as many phases as the elapsed time covers (handles
    // long throttled gaps in one call, carrying the overshoot forward).
    while (now - this.phaseStart >= this.phase.duration) {
      this.phaseStart += this.phase.duration;
      this.index += 1;
      if (this.index >= this.schedule.length) {
        this.state = 'finished';
        this._stopTicking();
        this.handlers.onFinish?.();
        return;
      }
      this.handlers.onPhase?.(this.phase, this.index);
    }
    this._emitTick(now);
  }

  _emitTick(now) {
    const elapsed = this.state === 'paused' ? this.pausedElapsed : now - this.phaseStart;
    const phase = this.phase;
    this.handlers.onTick?.({
      phase,
      index: this.index,
      remainingMs: Math.max(0, phase.duration - elapsed),
      progress: Math.min(1, elapsed / phase.duration),
    });
  }

  _startTicking() {
    this._stopTicking();
    this._intervalId = setInterval(() => this.tick(), 100);
    this.tick();
  }

  _stopTicking() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }
}
