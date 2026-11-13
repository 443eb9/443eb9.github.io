import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'

let islands
try {
  islands = JSON.parse(await readFile('src/generated/islands.json', 'utf8'))
} catch (cause) {
  throw new Error('Read generated island data failed. Run npm run content before creating pages.', { cause })
}

await mkdir('dist/log', { recursive: true })
const html = await readFile('dist/index.html', 'utf8')
await writeFile('dist/log/index.html', html.replace('<title>Crepuscular Archipelago · 443eb9#C</title>', '<title>日志 · Crepuscular Archipelago</title>'))
for (const island of islands) {
  const directory = `dist/island/${island.id}`
  await mkdir(directory, { recursive: true })
  await writeFile(`${directory}/index.html`, html)
}
await copyFile('dist/index.html', 'dist/404.html')
await writeFile('dist/.nojekyll', '')
await writeFile('dist/CNAME', '443eb9.dev\n')
