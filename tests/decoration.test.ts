import assert from 'node:assert/strict'
import test from 'node:test'
import { stripeShift } from '../src/decoration.ts'

test('stripes move along their normal in opposite directions around the pointer', () => {
  const pointer = { x: 64, y: 64 }
  const upper = stripeShift(104, pointer)
  const lower = stripeShift(152, pointer)
  assert.ok(upper < 0)
  assert.ok(lower > 0)
  assert.equal(upper, -lower)
  assert.equal(stripeShift(104, { x: 32, y: 96 }), upper)
  assert.equal(stripeShift(104, { x: -1000, y: -1000 }), 0)

  for (let sum = 0; sum <= 256; sum += 8) {
    const intercepts = Array.from({ length: 15 }, (_, i) => i * 24 - 96)
    const shifted = intercepts.map(intercept => intercept + 2 * stripeShift(intercept, { x: sum / 2, y: sum / 2 }))
    assert.ok(shifted.every((value, index) => index === 0 || value > shifted[index - 1]))
  }
})
