import assert from 'node:assert/strict'
import test from 'node:test'
import { createDecipheriv, randomBytes, webcrypto } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ENCRYPTION_HEADER, IV_BYTES, TAG_BYTES, encryptContent, encryptionKey } from '../scripts/encryption.mjs'
import { encryptedSections } from '../src/island-content.ts'

const key = randomBytes(32)
const script = fileURLToPath(new URL('../scripts/content.mjs', import.meta.url))

function decrypt(content: Buffer, context: string, secret = key) {
  assert.deepEqual(content.subarray(0, ENCRYPTION_HEADER.length), ENCRYPTION_HEADER)
  const offset = ENCRYPTION_HEADER.length
  const decipher = createDecipheriv('aes-256-gcm', secret, content.subarray(offset, offset + IV_BYTES))
  decipher.setAAD(Buffer.from(context))
  decipher.setAuthTag(content.subarray(-TAG_BYTES))
  return Buffer.concat([decipher.update(content.subarray(offset + IV_BYTES, -TAG_BYTES)), decipher.final()])
}

async function fixture(files: Record<string, string>, run: (directory: string, content: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'island-encryption-'))
  const content = join(directory, 'content')
  try {
    for (const [name, value] of Object.entries(files)) {
      const target = join(content, name)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, value)
    }
    await run(directory, content)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function build(directory: string, content: string, secret = key.toString('base64')) {
  return spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8', env: { ...process.env, ISLANDS_DIR: content, ISLAND_ENCRYPTION_KEY: secret } })
}

test('AES-GCM uses fresh IVs and authenticates the key, content and context', async () => {
  const plain = Buffer.from('Private Markdown 中文')
  const encrypted = encryptContent(plain, key, 'island:test.md')
  assert.deepEqual(decrypt(encrypted, 'island:test.md'), plain)
  assert.notDeepEqual(encrypted, encryptContent(plain, key, 'island:test.md'))
  assert.throws(() => decrypt(encrypted, 'island:test.md', randomBytes(32)))
  assert.throws(() => decrypt(encrypted, 'island:other.md'))
  const changed = Buffer.from(encrypted)
  changed[ENCRYPTION_HEADER.length + IV_BYTES] ^= 1
  assert.throws(() => decrypt(changed, 'island:test.md'))
  assert.deepEqual(encryptionKey(key.toString('base64')), key)
  for (const value of ['', undefined, 'password', Buffer.alloc(16).toString('base64')]) assert.throws(() => encryptionKey(value), /32-byte key/)

  const browserKey = await webcrypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt'])
  const result = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: encrypted.subarray(ENCRYPTION_HEADER.length, ENCRYPTION_HEADER.length + IV_BYTES), additionalData: Buffer.from('island:test.md'), tagLength: TAG_BYTES * 8 }, browserKey, encrypted.subarray(ENCRYPTION_HEADER.length + IV_BYTES))
  assert.deepEqual(Buffer.from(result), plain)
})

test('publication encrypts whole islands, marked sections and private attachments', async () => {
  const fullBody = '# FullPrivateBody\n\n![private](./full.svg)'
  const sectionBody = '\n# SectionPrivateBody\n\n<img src="./private.svg">\n'
  await fixture({
    '1/full.md': `---\ntitle = "Public title"\nencrypted = true\n---\n${fullBody}`,
    '1/full.svg': '<svg>FullPrivateImage</svg>',
    '1/unused.svg': '<svg>UnusedPrivateImage</svg>',
    '2/partial.md': `---\ntitle: Partial\n---\n# Public before\n\n![public](./public.svg)\n\n<!-- BEGIN ENCRYPT -->${sectionBody}<!-- END ENCRYPT -->\n\nPublic after`,
    '2/private.svg': '<svg>SectionPrivateImage</svg>',
    '2/public.svg': '<svg>PublicImage</svg>',
  }, async (directory, content) => {
    const result = build(directory, content)
    assert.equal(result.status, 0, result.stderr)
    const json = await readFile(join(directory, 'src/generated/islands.json'), 'utf8')
    const islands = JSON.parse(json)
    const full = islands.find((island: { id: string }) => island.id === '1/full.md')
    const partial = islands.find((island: { id: string }) => island.id === '2/partial.md')
    assert.equal(full.encrypted, true)
    assert.equal(full.title, 'Public title')
    assert.equal(decrypt(Buffer.from(full.body, 'base64'), 'island:1/full.md').toString(), fullBody)
    assert.equal(partial.encrypted, false)
    assert.match(partial.body, /<!-- BEGIN ENCRYPT -->/)
    assert.match(partial.body, /<!-- END ENCRYPT -->/)
    assert.match(partial.body, /Public before/)
    assert.match(partial.body, /Public after/)
    const sections = encryptedSections(partial.body)
    assert.equal(decrypt(Buffer.from(sections[1].body.trim(), 'base64'), 'island:2/partial.md:section:0').toString(), sectionBody)
    for (const text of ['FullPrivateBody', 'SectionPrivateBody', 'FullPrivateImage', 'SectionPrivateImage', key.toString('base64')]) assert.equal(json.includes(text), false)
    for (const [name, expected] of [['1/full.svg', '<svg>FullPrivateImage</svg>'], ['1/unused.svg', '<svg>UnusedPrivateImage</svg>'], ['2/private.svg', '<svg>SectionPrivateImage</svg>']]) {
      const encrypted = await readFile(join(directory, `public/island-assets/${name}.enc`))
      assert.equal(decrypt(encrypted, `asset:${name}`).toString(), expected)
      await assert.rejects(access(join(directory, `public/island-assets/${name}`)))
    }
    assert.equal(await readFile(join(directory, 'public/island-assets/2/public.svg'), 'utf8'), '<svg>PublicImage</svg>')
    await assert.rejects(access(join(directory, 'public/island-assets/1/full.md')))
  })
})

test('missing keys clear previous generated and published plaintext outputs', async () => {
  await fixture({ '1/private.md': '---\ntitle: Private\nencrypted: true\n---\nPrivate body' }, async (directory, content) => {
    for (const name of ['src/generated/islands.json', 'public/island-assets/plain.svg', 'dist/assets/old.js']) {
      await mkdir(dirname(join(directory, name)), { recursive: true })
      await writeFile(join(directory, name), 'Old plaintext')
    }
    const result = build(directory, content, '')
    assert.equal(result.status, 1)
    assert.match(result.stderr, /ISLAND_ENCRYPTION_KEY/)
    for (const name of ['src/generated/islands.json', 'public/island-assets', 'dist']) await assert.rejects(access(join(directory, name)))
  })
})

test('publication rejects missing images, broken markers and shared protected attachments', async () => {
  for (const [body, expected] of [
    ['![missing](./missing.svg)', /attachment 1\/missing.svg is missing/],
    ['<video controls><source src="./missing.mp4" type="video/mp4"></video>', /attachment 1\/missing.mp4 is missing/],
    ['<!-- BEGIN ENCRYPT -->Private', /closing END ENCRYPT/],
    ['![public](./image.svg)\n\n<!-- BEGIN ENCRYPT -->\n![private](./image.svg)\n<!-- END ENCRYPT -->', /crosses public and encrypted/],
    ['<!-- BEGIN ENCRYPT -->\n![private](https://example.com/image.svg)\n<!-- END ENCRYPT -->', /encrypted images must use local attachments/],
  ] as const) {
    await fixture({ '1/test.md': `---\ntitle: Test\n---\n${body}`, '1/image.svg': '<svg/>' }, async (directory, content) => {
      const result = build(directory, content)
      assert.equal(result.status, 1)
      assert.match(result.stderr, expected)
      await assert.rejects(access(join(directory, 'src/generated/islands.json')))
    })
  }
})
