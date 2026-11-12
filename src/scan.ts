export const SCAN_PHASE = { blank: 'blank', entry: 'entry', hold: 'hold', clear: 'clear' } as const
export const ROLE_TEXTS = ['Anime Illustrator', 'Software Engineer'] as const
export const SCAN_TIMING = { blank: 800, entry: 1200, hold: 3600, clear: 1000, textDelay: 260, sweep: 340, whiteDelayRatio: 0.1734, diffusion: 180, squareBlack: 40 } as const
export const ROLE_CYCLE = SCAN_TIMING.blank + SCAN_TIMING.entry + SCAN_TIMING.hold + SCAN_TIMING.clear

export function scanLineDuration(width: number) {
  return Math.max(260, Math.min(380, width * 0.62))
}

export function sweepProgress(elapsed: number, duration: number) {
  const value = Math.max(0, Math.min(1, elapsed / duration))
  return value ** 3 * (value * (value * 6 - 15) + 10)
}

export function roleFrame(elapsed: number) {
  const cycle = Math.floor(Math.max(0, elapsed) / ROLE_CYCLE)
  const local = Math.max(0, elapsed) % ROLE_CYCLE
  const role = ROLE_TEXTS[cycle % ROLE_TEXTS.length]
  if (local < SCAN_TIMING.blank) return { role, cycle, phase: SCAN_PHASE.blank, elapsed: local, remaining: SCAN_TIMING.blank - local }
  if (local < SCAN_TIMING.blank + SCAN_TIMING.entry) return { role, cycle, phase: SCAN_PHASE.entry, elapsed: local - SCAN_TIMING.blank, remaining: SCAN_TIMING.blank + SCAN_TIMING.entry - local }
  if (local < SCAN_TIMING.blank + SCAN_TIMING.entry + SCAN_TIMING.hold) return { role, cycle, phase: SCAN_PHASE.hold, elapsed: local - SCAN_TIMING.blank - SCAN_TIMING.entry, remaining: ROLE_CYCLE - SCAN_TIMING.clear - local }
  return { role, cycle, phase: SCAN_PHASE.clear, elapsed: local - ROLE_CYCLE + SCAN_TIMING.clear, remaining: ROLE_CYCLE - local }
}

export function settledGlyphs(length: number, elapsed: number) {
  const duration = 900
  const transition = 300
  const time = Math.max(0, Math.min(duration, elapsed))
  const progress = Math.min(time, duration - time, transition) / transition
  const edgeDistance = transition * progress ** 4 * (2.5 - 3 * progress + progress ** 2)
  const distance = time < transition ? edgeDistance : time > duration - transition ? duration - transition - edgeDistance : time - transition / 2
  return Math.min(length, Math.floor(length * distance / (duration - transition)))
}

export function nearbyCharacters(character: string) {
  const code = character.codePointAt(0)!
  const result: string[] = []
  for (let next = Math.max(33, code - 64); next <= Math.min(255, code + 64); next++) {
    const candidate = String.fromCodePoint(next)
    if (next !== code && (next <= 126 || next >= 161) && /^[\p{L}\p{N}\p{P}\p{S}]$/u.test(candidate)) result.push(candidate)
  }
  return result
}
