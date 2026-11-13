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

export function islandPath(id: string) {
  return `/island/${id.split('/').map(encodeURIComponent).join('/')}`
}

export function islandId(path: string) {
  if (!path.startsWith('/island/')) return null
  try { return decodeURIComponent(path.slice('/island/'.length)) } catch { return null }
}

export function islandAssetUrl(url: string, id: string) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(url)) return url

  const resolved = new URL(url, `https://island.invalid/island-assets/${id.split('/').map(encodeURIComponent).join('/')}`)
  return resolved.pathname + resolved.search + resolved.hash
}
