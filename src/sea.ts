import type { FieldPointer, NoiseSample } from './halftone'

const VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D noiseField;
uniform vec2 resolution;
uniform vec2 pointer;
uniform float unit;
uniform int dotColumns;
uniform ivec2 dotOrigin;
uniform ivec2 noiseOrigin;
uniform vec2 pan;
flat out vec2 center;
flat out float radius;

float sampleNoise(vec2 center) {
  vec2 samplePosition = center / (12.0 * unit);
  ivec2 cell = ivec2(floor(samplePosition)) - noiseOrigin;
  vec2 fraction = fract(samplePosition);
  float top = mix(texelFetch(noiseField, cell, 0).r, texelFetch(noiseField, cell + ivec2(1, 0), 0).r, fraction.x);
  float bottom = mix(texelFetch(noiseField, cell + ivec2(0, 1), 0).r, texelFetch(noiseField, cell + ivec2(1, 1), 0).r, fraction.x);
  return clamp((mix(top, bottom, fraction.y) - 0.25) * 2.0, 0.0, 1.0);
}

void main() {
  int row = gl_VertexID / dotColumns + dotOrigin.y;
  int column = gl_VertexID % dotColumns + dotOrigin.x;
  float spacing = 4.0 * unit;
  vec2 worldCenter = vec2((float(column) + 0.5 + float(row & 1) * 0.5) * spacing, (float(row) + 0.5) * spacing);
  center = worldCenter + pan;
  if (center.x >= resolution.x || center.y >= resolution.y) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    gl_PointSize = 1.0;
    radius = 0.0;
    return;
  }
  float falloff = pow(max(0.0, 1.0 - length(center - pointer) / (130.0 * unit)), 2.0);
  radius = min(1.8, 0.1 + sampleNoise(worldCenter) * 1.1 + falloff * 0.6) * unit;
  gl_Position = vec4(center.x / resolution.x * 2.0 - 1.0, 1.0 - center.y / resolution.y * 2.0, 0.0, 1.0);
  gl_PointSize = ceil(radius * 2.0 + 2.0);
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec2 resolution;
flat in vec2 center;
flat in float radius;
out vec4 color;
void main() {
  vec2 point = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y);
  float alpha = clamp(radius + 0.5 - length(point - center), 0.0, 1.0);
  color = vec4(vec3(70.0, 100.0, 244.0) / 255.0 * alpha, alpha);
}`

export function createSeaRenderer(canvas: HTMLCanvasElement, noise: NoiseSample) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true })
  if (!gl) throw new Error('WebGL2 is required to render sea dots')

  function compile(type: number, source: string) {
    const shader = gl!.createShader(type)!
    gl!.shaderSource(shader, source)
    gl!.compileShader(shader)
    if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
      const message = gl!.getShaderInfoLog(shader)
      gl!.deleteShader(shader)
      throw new Error(`Sea shader compilation failed: ${message}`)
    }
    return shader
  }

  const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  const program = gl.createProgram()!
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Sea shader linking failed: ${message}`)
  }

  const texture = gl.createTexture()!
  const vertices = gl.createVertexArray()!
  const resolution = gl.getUniformLocation(program, 'resolution')
  const pointerLocation = gl.getUniformLocation(program, 'pointer')
  const unitLocation = gl.getUniformLocation(program, 'unit')
  const dotColumnsLocation = gl.getUniformLocation(program, 'dotColumns')
  const dotOriginLocation = gl.getUniformLocation(program, 'dotOrigin')
  const noiseOriginLocation = gl.getUniformLocation(program, 'noiseOrigin')
  const panLocation = gl.getUniformLocation(program, 'pan')
  gl.useProgram(program)
  gl.bindVertexArray(vertices)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  gl.clearColor(0, 0, 0, 0)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.uniform1i(gl.getUniformLocation(program, 'noiseField'), 0)
  let columns = 0
  let rows = 0
  let dotCount = 0
  let fieldUnit = 1
  let values = new Float32Array(0)

  return {
    resize(width: number, height: number, unit: number) {
      canvas.width = Math.ceil(width)
      canvas.height = Math.ceil(height)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(resolution, canvas.width, canvas.height)
      gl.uniform1f(unitLocation, unit)
      fieldUnit = unit
      const dotColumns = Math.ceil(canvas.width / (4 * unit)) + 2
      dotCount = dotColumns * (Math.ceil(canvas.height / (4 * unit)) + 2)
      gl.uniform1i(dotColumnsLocation, dotColumns)
      columns = Math.ceil(canvas.width / (12 * unit)) + 3
      rows = Math.ceil(canvas.height / (12 * unit)) + 3
      values = new Float32Array(columns * rows)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, columns, rows, 0, gl.RED, gl.FLOAT, values)
    },
    draw(time: number, pointer: FieldPointer, pan: FieldPointer) {
      const noiseX = Math.floor(-pan.x / (12 * fieldUnit)) - 1
      const noiseY = Math.floor(-pan.y / (12 * fieldUnit)) - 1
      gl.uniform2i(noiseOriginLocation, noiseX, noiseY)
      gl.uniform2i(dotOriginLocation, Math.floor(-pan.x / (4 * fieldUnit)) - 1, Math.floor(-pan.y / (4 * fieldUnit)) - 1)
      gl.uniform2f(panLocation, pan.x, pan.y)
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) values[y * columns + x] = (noise((x + noiseX) * 0.05, (y + noiseY) * 0.05, time) + 1) / 2
      }
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, columns, rows, gl.RED, gl.FLOAT, values)
      gl.uniform2f(pointerLocation, pointer.x, pointer.y)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.POINTS, 0, dotCount)
    },
    dispose() {
      gl.deleteTexture(texture)
      gl.deleteVertexArray(vertices)
      gl.deleteProgram(program)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}
