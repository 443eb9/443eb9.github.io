export const ISLAND_DURATION = 0.32

export function labelBlink(enter: boolean) {
  const count = 2 + Math.floor(Math.random() * 2)
  const intervals = Array.from({ length: count * 2 }, () => 0.5 + Math.random())
  const total = intervals.reduce((sum, value) => sum + value, 0)
  const opacity = [enter ? 0 : 1]
  const times = [0]
  let elapsed = 0

  for (const interval of intervals.slice(0, -1)) {
    elapsed += interval
    const time = elapsed / total
    const previous = opacity[opacity.length - 1]
    opacity.push(previous, 1 - previous)
    times.push(time, time)
  }
  opacity.push(enter ? 1 : 0)
  times.push(1)
  return { opacity, times }
}
