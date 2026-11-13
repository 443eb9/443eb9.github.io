import type { FieldPointer, NoiseSample } from './halftone'

const SEA_BLUE = [70, 100, 244] as const
const SEA_GRAY = [180, 181, 190] as const

function palette(color: readonly number[]) {
  const bytes = new Uint8Array([...color, 0])
  const word = new Uint32Array(bytes.buffer)
  return Uint32Array.from({ length: 256 }, (_, alpha) => { bytes[3] = alpha; return word[0] })
}

export function createSeaHalftone(image: ImageData, noise: NoiseSample, unit: number) {
  const { width, height, data } = image
  const pixels = new Uint32Array(data.buffer, data.byteOffset, data.byteLength / 4)
  const base = new Uint8ClampedArray(data.length)
  const basePixels = new Uint32Array(base.buffer)
  const blue = palette(SEA_BLUE)
  const gray = palette(SEA_GRAY)
  const spacing = 4 * unit
  const reach = 130 * unit
  const sampleStep = 12 * unit
  const columns = Math.ceil(width / sampleStep) + 2
  const rows = Math.ceil(height / sampleStep) + 2
  const values = new Float32Array(columns * rows)
  const offsets: number[] = []
  const distances: number[] = []
  const dots: { x: number; y: number; start: number; end: number; sample: number; tx: number; ty: number }[] = []

  function footprint(x: number, y: number, radius: number, visit: (index: number, distance: number) => void) {
    for (let py = Math.max(0, Math.floor(y - radius - 0.5)); py <= Math.min(height - 1, Math.ceil(y + radius + 0.5)); py++) {
      for (let px = Math.max(0, Math.floor(x - radius - 0.5)); px <= Math.min(width - 1, Math.ceil(x + radius + 0.5)); px++) {
        const distance = Math.hypot(px + 0.5 - x, py + 0.5 - y)
        if (distance < radius + 0.5) visit(py * width + px, distance)
      }
    }
  }

  let row = 0
  for (let y = spacing / 2; y < height; y += spacing, row++) {
    for (let x = spacing / 2 + row % 2 * spacing / 2; x < width; x += spacing) {
      const start = offsets.length
      footprint(x, y, 1.8 * unit, (index, distance) => { offsets.push(index); distances.push(distance) })
      const gx = x / sampleStep
      const gy = y / sampleStep
      dots.push({ x, y, start, end: offsets.length, sample: Math.floor(gy) * columns + Math.floor(gx), tx: gx % 1, ty: gy % 1 })
      footprint(x + spacing / 2, y + spacing / 2, 0.32 * unit, (index, distance) => {
        basePixels[index] = gray[Math.round(Math.min(1, 0.32 * unit + 0.5 - distance) * 255)]
      })
    }
  }
  const indices = Int32Array.from(offsets)
  const lengths = Float32Array.from(distances)
  const rgba = new Uint8Array(4)
  const color = new Uint32Array(rgba.buffer)

  return (time: number, pointer: FieldPointer) => {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) values[y * columns + x] = (noise(x * 0.05, y * 0.05, time) + 1) / 2
    }
    pixels.set(basePixels)
    for (const dot of dots) {
      const { sample, tx, ty } = dot
      const top = values[sample] * (1 - tx) + values[sample + 1] * tx
      const bottom = values[sample + columns] * (1 - tx) + values[sample + columns + 1] * tx
      const value = Math.max(0, Math.min(1, (top * (1 - ty) + bottom * ty - 0.25) * 2))
      const falloff = Math.max(0, 1 - Math.hypot(dot.x - pointer.x, dot.y - pointer.y) / reach) ** 2
      const radius = Math.min(1.8, 0.1 + value * 1.1 + falloff * 0.6) * unit
      for (let i = dot.start; i < dot.end; i++) {
        const alpha = Math.round(Math.max(0, Math.min(1, radius + 0.5 - lengths[i])) * 255)
        if (alpha === 0) continue
        const index = indices[i]
        const background = base[index * 4 + 3]
        if (background === 0) pixels[index] = blue[alpha]
        else {
          const a = alpha / 255
          const grayWeight = background / 255 * (1 - a)
          const combined = a + grayWeight
          for (let channel = 0; channel < 3; channel++) rgba[channel] = Math.round((SEA_BLUE[channel] * a + SEA_GRAY[channel] * grayWeight) / combined)
          rgba[3] = Math.round(combined * 255)
          pixels[index] = color[0]
        }
      }
    }
  }
}
