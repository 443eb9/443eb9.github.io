export function stripeShift(intercept: number, pointer: { x: number; y: number }): number {
  const distance = (intercept - pointer.x - pointer.y) / Math.SQRT2
  const falloff = Math.max(0, 1 - Math.abs(distance) / 64)
  return (distance >= 0 ? 1 : -1) * 10 * falloff * falloff
}

export const GRAY_BLOCK_TIMING = { minimum: 5000, maximum: 15000, flash: 50 } as const

export function grayBlockFrames(duration: number, flashes: number): Keyframe[] {
  const frames: Keyframe[] = []
  const add = (time: number, opacity: number) => frames.push({ offset: time / duration, opacity, easing: 'steps(1, end)' })
  for (let i = 0; i <= flashes * 2; i++) add(i * GRAY_BLOCK_TIMING.flash, i % 2 ? 0 : 1)
  const exitStart = duration - flashes * 2 * GRAY_BLOCK_TIMING.flash
  add(exitStart, 1)
  for (let i = 1; i <= flashes * 2; i++) add(exitStart + i * GRAY_BLOCK_TIMING.flash, i % 2 ? 0 : 1)
  frames[frames.length - 1].opacity = 0
  return frames
}
