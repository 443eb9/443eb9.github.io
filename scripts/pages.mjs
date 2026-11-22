import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { islandRouteId } from '../src/island-content.ts'
import { pageNames, pageTitle } from '../src/page-titles.ts'

let islands
try {
  islands = JSON.parse(await readFile('src/generated/islands.json', 'utf8'))
} catch (cause) {
  throw new Error('Read generated island data failed. Run npm run content before creating pages.', { cause })
}

const html = await readFile('dist/index.html', 'utf8')
const fixedPageHtml = path => html.replace(/<title>[^<]*<\/title>/, `<title>${pageTitle(path)}</title>`)
for (const path of pageNames.keys()) {
  const directory = `dist${path}`
  await mkdir(directory, { recursive: true })
  await writeFile(`${directory}/index.html`, fixedPageHtml(path))
}
for (const island of islands) {
  const directory = `dist/island/${islandRouteId(island.id)}`
  await mkdir(directory, { recursive: true })
  await writeFile(`${directory}/index.html`, html)
}
await writeFile('dist/404.html', fixedPageHtml('/404'))
await writeFile('dist/.nojekyll', '')
await writeFile('dist/CNAME', '443eb9.dev\n')
