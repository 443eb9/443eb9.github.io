import { buildPermutationTable } from 'simplex-noise'
import { randomSource } from './terrain'

const FIELD_WIDTH = 192
const FIELD_HEIGHT = 120

const VERTEX_SHADER = `#version 300 es
void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`

/*!
 * Simplex noise kernel adapted from simplex-noise.
 * Copyright (c) 2024 Jonas Wagner
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
const HEIGHT_SHADER = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform usampler2D permutation;
uniform vec2 fieldSize;
uniform float aspect;
uniform float scale;
uniform float variant;
uniform float time;
uniform vec4 pointer;
out vec4 color;

const vec3 gradients[12] = vec3[12](
  vec3(1,1,0), vec3(-1,1,0), vec3(1,-1,0), vec3(-1,-1,0),
  vec3(1,0,1), vec3(-1,0,1), vec3(1,0,-1), vec3(-1,0,-1),
  vec3(0,1,1), vec3(0,-1,1), vec3(0,1,-1), vec3(0,-1,-1)
);
int permute(int index) {
  return int(texelFetch(permutation, ivec2(index & 255, 0), 0).r);
}
float contribution(ivec3 cell, vec3 delta) {
  float weight = max(0.0, 0.6 - dot(delta, delta));
  weight *= weight;
  int gradient = permute(cell.x + permute(cell.y + permute(cell.z))) % 12;
  return weight * weight * dot(gradients[gradient], delta);
}
float noise3(vec3 position) {
  ivec3 cell = ivec3(floor(position + dot(position, vec3(1.0 / 3.0))));
  vec3 delta = position - vec3(cell) + float(cell.x + cell.y + cell.z) / 6.0;
  ivec3 first;
  ivec3 second;
  if (delta.x >= delta.y) {
    if (delta.y >= delta.z) { first = ivec3(1,0,0); second = ivec3(1,1,0); }
    else if (delta.x >= delta.z) { first = ivec3(1,0,0); second = ivec3(1,0,1); }
    else { first = ivec3(0,0,1); second = ivec3(1,0,1); }
  } else {
    if (delta.y < delta.z) { first = ivec3(0,0,1); second = ivec3(0,1,1); }
    else if (delta.x < delta.z) { first = ivec3(0,1,0); second = ivec3(0,1,1); }
    else { first = ivec3(0,1,0); second = ivec3(1,1,0); }
  }
  return 32.0 * (
    contribution(cell, delta) +
    contribution(cell + first, delta - vec3(first) + 1.0 / 6.0) +
    contribution(cell + second, delta - vec3(second) + 1.0 / 3.0) +
    contribution(cell + ivec3(1), delta - 0.5)
  );
}
void main() {
  vec2 uv = gl_FragCoord.xy / fieldSize;
  vec2 position = vec2(uv.x, 1.0 - uv.y);
  float height = noise3(vec3(position * vec2(aspect, 1.0) * scale + vec2(variant, 0.0), time));
  if (pointer.z > 0.0 && pointer.w > 0.0) {
    vec2 distance = (position - pointer.xy) / pointer.zw;
    float falloff = max(0.0, 1.0 - dot(distance, distance));
    height += 0.7 * falloff * falloff;
  }
  float encoded = floor(clamp((height + 1.0) / 3.0, 0.0, 1.0) * 65535.0 + 0.5);
  color = vec4(floor(encoded / 256.0), mod(encoded, 256.0), 0.0, 255.0) / 255.0;
}`

const LINE_SHADER = `#version 300 es
precision highp float;
uniform sampler2D heights;
uniform vec2 resolution;
uniform vec3 lineColor;
uniform float lineWidth;
out vec4 color;
void main() {
  vec2 packedHeight = texture(heights, gl_FragCoord.xy / resolution).rg;
  float height = dot(packedHeight, vec2(65280.0, 255.0)) / 65535.0 * 3.0 - 1.0;
  float threshold = clamp(floor(height / 0.2 + 0.5), -3.0, 3.0) * 0.2;
  float gradient = length(vec2(dFdx(height), dFdy(height)));
  float distance = abs(height - threshold) / max(gradient, 0.000001);
  float alpha = 1.0 - smoothstep(max(0.0, lineWidth * 0.5 - 0.5), lineWidth * 0.5 + 0.5, distance);
  color = vec4(lineColor * alpha, alpha);
}`

export function createContourRenderer(canvas: HTMLCanvasElement, variant: number, scale: number) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true })
  if (!gl) throw new Error('WebGL2 is required to render contours')

  function program(fragment: string) {
    const program = gl!.createProgram()!
    for (const [type, source] of [[gl!.VERTEX_SHADER, VERTEX_SHADER], [gl!.FRAGMENT_SHADER, fragment]] as const) {
      const shader = gl!.createShader(type)!
      gl!.shaderSource(shader, source)
      gl!.compileShader(shader)
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
        const message = gl!.getShaderInfoLog(shader)
        gl!.deleteShader(shader)
        throw new Error(`Contour shader compilation failed: ${message}`)
      }
      gl!.attachShader(program, shader)
      gl!.deleteShader(shader)
    }
    gl!.linkProgram(program)
    if (!gl!.getProgramParameter(program, gl!.LINK_STATUS)) throw new Error(`Contour shader linking failed: ${gl!.getProgramInfoLog(program)}`)
    return program
  }

  const heightProgram = program(HEIGHT_SHADER)
  const lineProgram = program(LINE_SHADER)
  const permutation = gl.createTexture()!
  const heights = gl.createTexture()!
  const framebuffer = gl.createFramebuffer()!
  const vertices = gl.createVertexArray()!
  gl.bindVertexArray(vertices)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, permutation)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, 256, 1, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, buildPermutationTable(randomSource(107 + variant)).subarray(0, 256))
  gl.useProgram(heightProgram)
  gl.uniform1i(gl.getUniformLocation(heightProgram, 'permutation'), 0)
  gl.uniform2f(gl.getUniformLocation(heightProgram, 'fieldSize'), FIELD_WIDTH, FIELD_HEIGHT)
  gl.uniform1f(gl.getUniformLocation(heightProgram, 'variant'), variant)
  gl.uniform1f(gl.getUniformLocation(heightProgram, 'scale'), scale)
  const aspectLocation = gl.getUniformLocation(heightProgram, 'aspect')
  const timeLocation = gl.getUniformLocation(heightProgram, 'time')
  const pointerLocation = gl.getUniformLocation(heightProgram, 'pointer')
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, heights)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, FIELD_WIDTH, FIELD_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, heights, 0)
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Contour height framebuffer is incomplete')
  gl.useProgram(lineProgram)
  gl.uniform1i(gl.getUniformLocation(lineProgram, 'heights'), 1)
  const resolutionLocation = gl.getUniformLocation(lineProgram, 'resolution')
  const colorLocation = gl.getUniformLocation(lineProgram, 'lineColor')
  const widthLocation = gl.getUniformLocation(lineProgram, 'lineWidth')

  return {
    resize(width: number, height: number, pixelRatio: number, color: number[], lineWidth: number) {
      canvas.width = Math.max(1, Math.ceil(width * pixelRatio))
      canvas.height = Math.max(1, Math.ceil(height * pixelRatio))
      gl.useProgram(heightProgram)
      gl.uniform1f(aspectLocation, width / Math.max(1, height))
      gl.useProgram(lineProgram)
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height)
      gl.uniform3f(colorLocation, color[0] / 255, color[1] / 255, color[2] / 255)
      gl.uniform1f(widthLocation, lineWidth * pixelRatio)
    },
    draw(time: number, pointer: { x: number; y: number; radiusX: number; radiusY: number } | null) {
      gl.useProgram(heightProgram)
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      gl.viewport(0, 0, FIELD_WIDTH, FIELD_HEIGHT)
      gl.uniform1f(timeLocation, time)
      gl.uniform4f(pointerLocation, pointer?.x ?? 0, pointer?.y ?? 0, pointer?.radiusX ?? 0, pointer?.radiusY ?? 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.useProgram(lineProgram)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    dispose() {
      gl.deleteFramebuffer(framebuffer)
      gl.deleteTexture(heights)
      gl.deleteTexture(permutation)
      gl.deleteVertexArray(vertices)
      gl.deleteProgram(heightProgram)
      gl.deleteProgram(lineProgram)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}
