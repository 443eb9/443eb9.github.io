import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, relative, join } from 'node:path'
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

  return { id, title: data.title.trim(), desc: data.desc ?? '', tags: [...new Set(tags)], date }
}

export async function collectIslands(root) {
  const result = []
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))
    for (const entry of entries) {
      const path = join(directory, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.')) await visit(path)
      if (entry.isFile() && /\.md$/i.test(entry.name)) {
        const id = relative(root, path).replaceAll('\\', '/')
        const island = parseIsland(await readFile(path, 'utf8'), id)
        if (island) result.push(island)
      }
    }
  }
  await visit(root)
  return result.sort((a, b) => Number(b.id.split('/')[0]) - Number(a.id.split('/')[0]) || a.id.localeCompare(b.id, 'en'))
}

async function main() {
  const root = resolve(process.env.ISLANDS_DIR ?? '.content/islands/islands')
  const islands = await collectIslands(root)
  if (!islands.length) throw new Error(`Add titled Markdown documents under ${root}`)
  await mkdir('src/generated', { recursive: true })
  await writeFile('src/generated/islands.json', JSON.stringify(islands, null, 2) + '\n')
  console.log(`Generated ${islands.length} islands using four public frontmatter fields.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
