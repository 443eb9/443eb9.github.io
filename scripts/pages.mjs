import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { islandRouteId } from '../src/island-content.ts'

let islands
try {
  islands = JSON.parse(await readFile('src/generated/islands.json', 'utf8'))
} catch (cause) {
  throw new Error('Read generated island data failed. Run npm run content before creating pages.', { cause })
}

const html = await readFile('dist/index.html', 'utf8')
for (const [path, title] of [['log', '日志'], ['metadata', '元数据'], ['neighbourhood', '邻域']]) {
  await mkdir(`dist/${path}`, { recursive: true })
  await writeFile(`dist/${path}/index.html`, html.replace('<title>Crepuscular Archipelago · 443eb9#C</title>', `<title>${title} · Crepuscular Archipelago</title>`))
}
for (const island of islands) {
  const directory = `dist/island/${islandRouteId(island.id)}`
  await mkdir(directory, { recursive: true })
  await writeFile(`${directory}/index.html`, html)
}
await copyFile('dist/index.html', 'dist/404.html')
await writeFile('dist/.nojekyll', '')
await writeFile('dist/CNAME', '443eb9.dev\n')
