import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectIslands, parseIsland } from '../scripts/content.mjs'
import { encryptedSections, islandAssetUrl, islandId, islandPath } from '../src/island-content.ts'

test('island routes use only the numeric source directory', () => {
  assert.equal(islandPath('39/tenten-13.md'), '/island/39')
  assert.equal(islandPath('14/笔记 #1.md'), '/island/14')
  assert.equal(islandId('/island/39'), '39')
  assert.equal(islandId('/island/39/'), '39')
  assert.equal(islandId('/island/39/tenten-13.md'), null)
  assert.equal(islandId('/island/%broken'), null)
  assert.equal(islandId('/log'), null)
  assert.throws(() => islandPath('notes/article.md'), /positive integer directory/)
})

test('content includes the Markdown body after YAML and TOML frontmatter', () => {
  for (const header of ['title: Test\ntags: [test]', 'title = "Test"\ntags = ["test"]']) {
    const island = parseIsland(`\uFEFF---\r\n${header}\r\n---\r\n\r\n# Heading\n\nBody`, 'test.md')
    assert.ok(island)
    assert.equal(island.body, '# Heading\n\nBody')
    assert.equal(island.title, 'Test')
    assert.deepEqual(island.tags, ['test'])
  }
})

test('build publishes Markdown bodies, attachments and direct island pages', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'island-build-'))
  try {
    const content = join(directory, 'content')
    await mkdir(join(content, '11', '11'), { recursive: true })
    await writeFile(join(content, '11', '测试.md'), '---\ntitle: Test\n---\n![Work](./11/work.svg)')
    await writeFile(join(content, '11', '11', 'work.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
    await writeFile(join(content, '.private'), 'private')
    execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/content.mjs', import.meta.url))], { cwd: directory, env: { ...process.env, ISLANDS_DIR: content } })
    const generated = JSON.parse(await readFile(join(directory, 'src/generated/islands.json'), 'utf8'))
    assert.equal(generated[0].body, '![Work](./11/work.svg)')
    assert.match(await readFile(join(directory, 'public/island-assets/11/11/work.svg'), 'utf8'), /<svg/)
    await assert.rejects(access(join(directory, 'public/island-assets/11/测试.md')))
    await assert.rejects(access(join(directory, 'public/island-assets/.private')))

    await mkdir(join(directory, 'dist'))
    await writeFile(join(directory, 'dist/index.html'), '<html><body>App</body></html>')
    execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/pages.mjs', import.meta.url))], { cwd: directory })
    assert.equal(await readFile(join(directory, 'dist/island/11/index.html'), 'utf8'), '<html><body>App</body></html>')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('source documents require unique numeric island routes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'island-route-'))
  try {
    await mkdir(join(directory, '39'))
    for (const name of ['one.md', 'two.md']) await writeFile(join(directory, '39', name), '---\ntitle: Test\n---\nBody')
    await assert.rejects(collectIslands(directory), /route id 39 must be unique/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('attachments resolve relative to each Markdown document and preserve absolute links', () => {
  const id = '11/krenz.md'
  assert.equal(islandAssetUrl('./11/work.avif', id), '/island-assets/11/11/work.avif')
  assert.equal(islandAssetUrl('./11/中文 图片.avif', id), '/island-assets/11/11/%E4%B8%AD%E6%96%87%20%E5%9B%BE%E7%89%87.avif')
  assert.equal(islandAssetUrl('../12/work.svg?size=2#image', id), '/island-assets/12/work.svg?size=2#image')
  for (const url of ['https://example.com/image.png', '#heading', '/log', 'javascript:alert(1)']) assert.equal(islandAssetUrl(url, id), url)
})

test('encryption sections retain public content and reject malformed markers', () => {
  assert.deepEqual(encryptedSections('Public<!-- BEGIN ENCRYPT -->Secret<!-- END ENCRYPT -->After'), [
    { body: 'Public', encrypted: false }, { body: 'Secret', encrypted: true }, { body: 'After', encrypted: false },
  ])
  for (const body of ['<!-- BEGIN ENCRYPT -->Secret', '<!-- END ENCRYPT -->', '<!-- BEGIN ENCRYPT --><!-- BEGIN ENCRYPT --><!-- END ENCRYPT -->']) assert.throws(() => encryptedSections(body), /Encryption markers/)
  assert.throws(() => parseIsland('---\ntitle: Test\nencrypted: "true"\n---\nBody', 'test.md'), /encrypted must be a boolean/)
})
