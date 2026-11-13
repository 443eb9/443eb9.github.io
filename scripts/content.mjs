import { readdir, readFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve, relative, join, dirname } from 'node:path'
import Markdown from 'react-markdown'
import { markdownPlugins } from '../src/markdown.ts'
import { ENCRYPT_BEGIN, ENCRYPT_END, encryptedSections, islandAssetUrl, islandRouteId } from '../src/island-content.ts'
import { encryptContent, encryptionKey } from './encryption.mjs'
import { pathToFileURL } from 'node:url'
import { parse as parseToml } from 'smol-toml'
import { parse as parseYaml } from 'yaml'

export function parseIsland(source, id) {
  const match = source.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) return null

  const header = match[1]
  const data = /^\s*[\w-]+\s*=/m.test(header) ? parseToml(header) : parseYaml(header)
  if (!data || typeof data !== 'object' || !('title' in data)) return null
  if (typeof data.title !== 'string' || !data.title.trim()) throw new Error(`${id}: title must be a nonempty string`)
  if (data.desc != null && typeof data.desc !== 'string') throw new Error(`${id}: desc must be a string`)
  if (data.encrypted != null && typeof data.encrypted !== 'boolean') throw new Error(`${id}: encrypted must be a boolean`)

  const ty = data.ty ?? 'article'
  if (!['article', 'note', 'achievement', 'external'].includes(ty)) throw new Error(`${id}: ty must be article, note, achievement or external`)
  if (ty === 'external') {
    if (typeof data.ref !== 'string' || !/^https?:\/\//i.test(data.ref) || !URL.canParse(data.ref)) throw new Error(`${id}: external ref must be an HTTP(S) URL`)
  }

  const tags = data.tags == null ? [] : typeof data.tags === 'string' ? [data.tags] : data.tags
  if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string')) throw new Error(`${id}: tags must contain strings`)

  let date = null
  if (data.date != null && data.date !== '') {
    const raw = data.date instanceof Date ? data.date.toISOString() : String(data.date)
    // Offset-free dates use UTC so build hosts produce the same output.
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z` : /(?:Z|[+-]\d\d:\d\d)$/i.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`
    const time = new Date(normalized)
    if (Number.isNaN(time.valueOf())) throw new Error(`${id}: date must be an ISO date`)
    date = time.toISOString()
  }

  return { id, ty, ref: ty === 'external' ? data.ref : null, title: data.title.trim(), desc: data.desc ?? '', tags: [...new Set(tags)], date, encrypted: data.encrypted === true, body: source.replace(/^\uFEFF/, '').slice(match[0].length).trim() }
}

export async function collectIslands(root) {
  const result = []
  const routeIds = new Set()
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))
    for (const entry of entries) {
      const path = join(directory, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.')) await visit(path)
      if (entry.isFile() && /\.md$/i.test(entry.name)) {
        const id = relative(root, path).replaceAll('\\', '/')
        const island = parseIsland(await readFile(path, 'utf8'), id)
        if (island) {
          const routeId = islandRouteId(id)
          if (routeIds.has(routeId)) throw new Error(`${id}: island route id ${routeId} must be unique.`)
          routeIds.add(routeId)
          result.push(island)
        }
      }
    }
  }
  await visit(root)
  return result.sort((a, b) => Number(islandRouteId(b.id)) - Number(islandRouteId(a.id)) || a.id.localeCompare(b.id, 'en'))
}

async function publicationAssets(root, islands, sections) {
  const assets = new Map()
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      if (!entry.isFile() || /\.md$/i.test(entry.name)) continue

      const name = relative(root, path).replaceAll('\\', '/')
      const owners = islands.filter(island => {
        const folder = dirname(island.id).replaceAll('\\', '/')
        return folder === '.' || name.startsWith(`${folder}/`)
      }).sort((a, b) => dirname(b.id).length - dirname(a.id).length)
      if (!owners.length) continue
      const closest = owners.filter(island => dirname(island.id) === dirname(owners[0].id))
      if (closest.some(island => island.encrypted !== closest[0].encrypted)) throw new Error(`${name}: attachments require one encryption policy per source directory.`)
      const fullEncryption = closest[0].encrypted
      const encrypted = fullEncryption || closest.some(island => sections.get(island.id).some(section => section.encrypted))
      assets.set(name, { path, encrypted, fullEncryption, referencedPolicy: undefined })
    }
  }
  await visit(root)

  for (const island of islands) {
    for (const section of sections.get(island.id)) {
      const encrypted = island.encrypted || section.encrypted
      Markdown({ children: section.body, ...markdownPlugins, urlTransform: (url, key) => {
        if (!url || url.startsWith('#')) return url
        const resolved = islandAssetUrl(url, island.id)
        const local = resolved.startsWith('/island-assets/')
        if (key === 'src' && encrypted && !local) throw new Error(`${island.id}: encrypted images must use local attachments.`)
        if (!local) return url

        const name = decodeURIComponent(new URL(resolved, 'https://island.invalid').pathname.slice('/island-assets/'.length))
        const asset = assets.get(name)
        if (!asset) throw new Error(`${island.id}: attachment ${name} is missing. Sync the full islands directory before building.`)
        if ((asset.fullEncryption && !encrypted) || (asset.referencedPolicy !== undefined && asset.referencedPolicy !== encrypted)) throw new Error(`${island.id}: attachment ${name} crosses public and encrypted content.`)
        asset.encrypted = encrypted
        asset.referencedPolicy = encrypted
        return url
      } })
    }
  }
  return assets
}

async function main() {
  // Invalidate previous outputs before validating content so a failed build leaves source data private.
  await rm('src/generated/islands.json', { force: true })
  await rm('public/island-assets', { recursive: true, force: true })
  await rm('dist', { recursive: true, force: true })

  const root = resolve(process.env.ISLANDS_DIR ?? '.content/islands/islands')
  const islands = await collectIslands(root)
  if (!islands.length) throw new Error(`Add titled Markdown documents under ${root}`)
  const sections = new Map(islands.map(island => [island.id, encryptedSections(island.body)]))
  const protectedContent = islands.some(island => island.encrypted || sections.get(island.id).some(section => section.encrypted))
  const key = protectedContent ? encryptionKey(process.env.ISLAND_ENCRYPTION_KEY) : null
  const assets = await publicationAssets(root, islands, sections)
  const published = islands.map(island => {
    if (island.encrypted) return { ...island, body: encryptContent(Buffer.from(island.body, 'utf8'), key, `island:${island.id}`).toString('base64') }

    let sectionIndex = 0
    const body = sections.get(island.id).map(section => {
      if (!section.encrypted) return section.body
      const ciphertext = encryptContent(Buffer.from(section.body, 'utf8'), key, `island:${island.id}:section:${sectionIndex++}`).toString('base64')
      return `${ENCRYPT_BEGIN}\n\n${ciphertext}\n\n${ENCRYPT_END}`
    }).join('')
    return { ...island, body }
  })

  for (const [name, asset] of assets) {
    const target = join('public/island-assets', asset.encrypted ? `${name}.enc` : name)
    await mkdir(dirname(target), { recursive: true })
    const content = await readFile(asset.path)
    await writeFile(target, asset.encrypted ? encryptContent(content, key, `asset:${name}`) : content)
  }
  await mkdir('src/generated', { recursive: true })
  await writeFile('src/generated/islands.json', JSON.stringify(published, null, 2) + '\n')
  console.log(`Generated ${islands.length} islands and ${assets.size} validated attachments.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
