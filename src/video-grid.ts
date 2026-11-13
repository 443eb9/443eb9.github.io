const VERTEX_SHADER = `#version 300 es
void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D videoFrame;
uniform vec2 resolution;
uniform vec2 gridOrigin;
uniform vec2 pan;
uniform float cellSize;
uniform float gap;
uniform float videoAspect;
uniform vec3 fillColor;
uniform vec3 gapColor;
out vec4 color;
void main() {
  vec2 pixel = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y);
  vec2 world = pixel - gridOrigin - pan;
  vec2 offset = mod(world, cellSize);
  vec2 edge = min(offset, cellSize - offset);
  if (any(lessThan(edge, vec2(gap * 0.5)))) {
    color = vec4(gapColor, 1.0);
    return;
  }

  vec2 cell = floor(world / cellSize);
  vec2 samplePosition = (cell + 0.5) * cellSize + gridOrigin + pan;
  vec2 videoSize = vec2(min(resolution.x, resolution.y * videoAspect), min(resolution.y, resolution.x / videoAspect));
  vec2 uv = (samplePosition - (resolution - videoSize) * 0.5) / videoSize;
  color = vec4(0.0);
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThanEqual(uv, vec2(1.0)))) return;
  if (texture(videoFrame, uv).r <= 0.5) return;

  color = vec4(fillColor, 1.0);
}`

export function createVideoGridRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true })
  if (!gl) throw new Error('WebGL2 is required to render video island cells.')

  function compile(type: number, source: string) {
    const shader = gl!.createShader(type)!
    gl!.shaderSource(shader, source)
    gl!.compileShader(shader)
    if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) throw new Error(`Video grid shader compilation failed: ${gl!.getShaderInfoLog(shader)}`)
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
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Video grid shader linking failed: ${gl.getProgramInfoLog(program)}`)

  const texture = gl.createTexture()!
  const vertices = gl.createVertexArray()!
  gl.bindVertexArray(vertices)
  gl.useProgram(program)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.uniform1i(gl.getUniformLocation(program, 'videoFrame'), 0)
  const resolution = gl.getUniformLocation(program, 'resolution')
  const origin = gl.getUniformLocation(program, 'gridOrigin')
  const cellSize = gl.getUniformLocation(program, 'cellSize')
  const gap = gl.getUniformLocation(program, 'gap')
  const pan = gl.getUniformLocation(program, 'pan')
  const aspect = gl.getUniformLocation(program, 'videoAspect')
  const fill = gl.getUniformLocation(program, 'fillColor')
  const paper = gl.getUniformLocation(program, 'gapColor')

  return {
    resize(width: number, height: number, grid: { size: number; x: number; y: number }, unit: number, gapWidth: number, foreground: number[], background: number[]) {
      canvas.width = Math.max(1, Math.ceil(width))
      canvas.height = Math.max(1, Math.ceil(height))
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(resolution, canvas.width, canvas.height)
      gl.uniform2f(origin, grid.x * unit, grid.y * unit)
      gl.uniform1f(cellSize, grid.size * unit)
      gl.uniform1f(gap, gapWidth * unit)
      gl.uniform3f(fill, foreground[0] / 255, foreground[1] / 255, foreground[2] / 255)
      gl.uniform3f(paper, background[0] / 255, background[1] / 255, background[2] / 255)
    },
    draw(video: HTMLVideoElement, offset: { x: number; y: number }) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
      gl.uniform1f(aspect, video.videoWidth / video.videoHeight)
      gl.uniform2f(pan, offset.x, offset.y)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    dispose() {
      gl.deleteTexture(texture)
      gl.deleteVertexArray(vertices)
      gl.deleteProgram(program)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}
