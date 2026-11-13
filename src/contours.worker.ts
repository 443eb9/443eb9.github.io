import { contours } from 'd3-contour'
import { createNoise3D } from 'simplex-noise'
import { randomSource } from './terrain'

export type ContourRequest = { aspect: number; time: number; settings?: { variant: number; scale: number } }
export type ContourResponse = { paths: string[] }

const generator = contours().size([64, 40]).thresholds([-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6])
let noise: ReturnType<typeof createNoise3D>
let variant = 0
let scale = 0.95

self.onmessage = ({ data }: MessageEvent<ContourRequest>) => {
  if (data.settings) {
    variant = data.settings.variant
    scale = data.settings.scale
    noise = createNoise3D(randomSource(107 + variant))
  }
  const values = Array.from({ length: 64 * 40 }, (_, index) => noise((index % 64) / 64 * data.aspect * scale + variant, Math.floor(index / 64) / 40 * scale, data.time))
  const paths = generator(values).map(contour => contour.coordinates.flatMap(polygon => polygon.map(ring => {
    const points = ring.slice(0, -1)
    const first = points[0]
    const end = points[points.length - 1]
    let path = `M${((first[0] + end[0]) / 2).toFixed(3)},${((first[1] + end[1]) / 2).toFixed(3)}`
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length]
      path += `Q${point[0].toFixed(3)},${point[1].toFixed(3)} ${((point[0] + next[0]) / 2).toFixed(3)},${((point[1] + next[1]) / 2).toFixed(3)}`
    })
    return `${path}Z`
  })).join(''))
  self.postMessage({ paths } satisfies ContourResponse)
}
