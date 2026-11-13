import assert from 'node:assert/strict'
import test from 'node:test'
import { nearbyCharacters, roleFrame, ROLE_CYCLE, ROLE_TEXTS, SCAN_PHASE, SCAN_TIMING, settledGlyphs, sweepProgress } from '../src/scan.ts'
import { createHalftone } from '../src/halftone.ts'
import { grayBlockFrames } from '../src/decoration.ts'

test('role cycle passes through blank, entry, hold and clear before switching text', () => {
  assert.equal(roleFrame(0).phase, SCAN_PHASE.blank)
  assert.equal(roleFrame(SCAN_TIMING.blank).phase, SCAN_PHASE.entry)
  assert.equal(roleFrame(SCAN_TIMING.blank + SCAN_TIMING.entry).phase, SCAN_PHASE.hold)
  assert.equal(roleFrame(ROLE_CYCLE - SCAN_TIMING.clear).phase, SCAN_PHASE.clear)
  assert.equal(roleFrame(ROLE_CYCLE).phase, SCAN_PHASE.blank)
  assert.equal(roleFrame(ROLE_CYCLE).role, ROLE_TEXTS[1])
  assert.equal(roleFrame(ROLE_CYCLE * 2).role, ROLE_TEXTS[0])
})

test('scan edges remain ordered and glyphs settle monotonically', () => {
  let previous = 0
  for (let time = 0; time <= 1200; time += 10) {
    const front = sweepProgress(time, SCAN_TIMING.sweep)
    const rear = sweepProgress(time - SCAN_TIMING.sweep * SCAN_TIMING.whiteDelayRatio, SCAN_TIMING.sweep)
    assert.ok(rear <= front)
    const count = settledGlyphs(17, time)
    assert.ok(count >= previous && count <= 17)
    previous = count
  }
  assert.equal(settledGlyphs(17, 0), 0)
  assert.equal(settledGlyphs(17, 900), 17)
  for (const character of ROLE_TEXTS.join('')) {
    const choices = nearbyCharacters(character)
    assert.ok(choices.length > 10)
    assert.ok(choices.every(choice => choice !== character && Math.abs(choice.codePointAt(0)! - character.codePointAt(0)!) <= 64))
  }
})

test('gray block keyframes have local stepped segments and a stable middle', () => {
  for (const duration of [5000, 15000]) {
    const frames = grayBlockFrames(duration, 3)
    assert.deepEqual(frames.slice(0, 7).map(frame => frame.opacity), [1, 0, 1, 0, 1, 0, 1])
    assert.deepEqual(frames.slice(-7).map(frame => frame.opacity), [1, 0, 1, 0, 1, 0, 0])
    assert.equal(frames[1].offset, 50 / duration)
    assert.equal(frames.at(-1)!.offset, 1)
    assert.ok(frames.every(frame => frame.easing === 'steps(1, end)'))
  }
})

test('halftone responds to the pointer and changes with the noise time coordinate', () => {
  const image = { width: 80, height: 60, data: new Uint8ClampedArray(80 * 60 * 4) } as ImageData
  const render = createHalftone(image, (_x, _y, time) => Math.sin(time), 'canine', 1)
  const alpha = () => image.data.reduce((sum, value, index) => sum + (index % 4 === 3 ? value : 0), 0)
  render(0, { x: -10000, y: -10000 })
  const initial = alpha()
  render(0, { x: 40, y: 30 })
  assert.ok(alpha() > initial)
  render(Math.PI / 2, { x: -10000, y: -10000 })
  assert.ok(alpha() > initial)
})
