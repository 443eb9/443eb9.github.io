import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'

await mkdir('dist/log', { recursive: true })
const html = await readFile('dist/index.html', 'utf8')
await writeFile('dist/log/index.html', html.replace('<title>Crepuscular Archipelago · 443eb9#C</title>', '<title>日志 · Crepuscular Archipelago</title>'))
await copyFile('dist/index.html', 'dist/404.html')
await writeFile('dist/.nojekyll', '')
await writeFile('dist/CNAME', '443eb9.dev\n')
