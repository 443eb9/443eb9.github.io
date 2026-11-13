export const ENCRYPT_BEGIN = '<!-- BEGIN ENCRYPT -->'
export const ENCRYPT_END = '<!-- END ENCRYPT -->'

export function encryptedSections(body: string) {
  const sections: { body: string; encrypted: boolean }[] = []
  let position = 0
  let encrypted = false
  for (const match of body.matchAll(/<!-- (?:BEGIN|END) ENCRYPT -->/g)) {
    const begin = match[0] === ENCRYPT_BEGIN
    if (begin === encrypted) throw new Error('Encryption markers must form complete, separate BEGIN/END pairs.')
    sections.push({ body: body.slice(position, match.index), encrypted })
    encrypted = begin
    position = match.index + match[0].length
  }
  if (encrypted) throw new Error('Encryption markers require a closing END ENCRYPT marker.')
  sections.push({ body: body.slice(position), encrypted: false })
  return sections
}

export function islandRouteId(sourcePath: string) {
  const id = sourcePath.split('/')[0]
  if (!/^[1-9]\d*$/.test(id)) throw new Error(`${sourcePath}: island route id must be a positive integer directory.`)
  return id
}

export function islandPath(sourcePath: string) {
  return `/island/${islandRouteId(sourcePath)}`
}

export function islandId(path: string) {
  return /^\/island\/([1-9]\d*)\/?$/.exec(path)?.[1] ?? null
}

export function islandAssetUrl(url: string, id: string) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(url)) return url

  const resolved = new URL(url, `https://island.invalid/island-assets/${id.split('/').map(encodeURIComponent).join('/')}`)
  return resolved.pathname + resolved.search + resolved.hash
}
