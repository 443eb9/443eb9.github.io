export type FieldPointer = { x: number; y: number }
export type NoiseSample = (x: number, y: number, z: number) => number

type Brush = { offsets: Int32Array; colors: Uint32Array; radius: number }

export function createHalftone(image: ImageData, noise: NoiseSample, unit: number): (time: number, pointer: FieldPointer) => void {
  const { width, height, data } = image
  const pixels = new Uint32Array(data.buffer, data.byteOffset, data.byteLength / 4)
  const spacing = 6 * unit
  const reach = 130 * unit
  const reachSquared = reach * reach
  const colors = [[161, 169, 208]]
  const brushes = colors.map(([red, green, blue]) => Array.from({ length: Math.ceil(spacing * 0.5 * 8) + 1 }, (_, step): Brush => {
    const radius = step / 8
    const extent = Math.ceil(radius + 0.5)
    const offsets: number[] = []
    const rgba: number[] = []
    const bytes = new Uint8Array([red, green, blue, 0])
    const word = new Uint32Array(bytes.buffer)
    for (let y = -extent; y <= extent; y++) {
      for (let x = -extent; x <= extent; x++) {
        const coverage = Math.min(1, radius + 0.5 - Math.hypot(x, y))
        if (coverage <= 0) continue
        offsets.push(y * width + x)
        bytes[3] = Math.round(coverage * 255)
        rgba.push(word[0])
      }
    }
    return { offsets: Int32Array.from(offsets), colors: Uint32Array.from(rgba), radius: extent }
  }))

  function dot(x: number, y: number, radius: number, color: number) {
    const cx = Math.floor(x)
    const cy = Math.floor(y)
    const brush = brushes[color][Math.min(brushes[color].length - 1, Math.round(radius * 8))]
    const center = cy * width + cx
    if (cx >= brush.radius && cx < width - brush.radius && cy >= brush.radius && cy < height - brush.radius) {
      for (let i = 0; i < brush.offsets.length; i++) pixels[center + brush.offsets[i]] = brush.colors[i]
    } else {
      for (let i = 0; i < brush.offsets.length; i++) {
        const offset = center + brush.offsets[i]
        const px = offset % width
        if (offset >= 0 && offset < pixels.length && Math.abs(px - cx) <= brush.radius) pixels[offset] = brush.colors[i]
      }
    }
  }

  return (time: number, pointer: FieldPointer) => {
    pixels.fill(0)
    let row = 0
    for (let y = spacing / 2; y < height; y += spacing, row++) {
      for (let x = spacing / 2 + (row % 2) * spacing / 2; x < width; x += spacing) {
        const value = (noise(x / (240 * unit), y / (240 * unit), time) + 1) / 2
        const dx = x - pointer.x
        const dy = y - pointer.y
        const distanceSquared = dx * dx + dy * dy
        const falloff = distanceSquared < reachSquared ? (1 - Math.sqrt(distanceSquared) / reach) ** 2 : 0
        dot(x, y, Math.min(spacing * 0.47, (0.3 + value * 2.3 + falloff * 1.1) * unit), 0)
      }
    }
  }
}
