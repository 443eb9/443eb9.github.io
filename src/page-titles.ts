const siteName = 'Crepuscular Archipelago'

export const pageNames = new Map([
  ['/log', 'Log'],
  ['/metadata', 'Metadata'],
  ['/neighbourhood', 'Neighbourhood'],
  ['/lapiz/roadmap', 'Lapiz Roadmap'],
])

export function pageTitle(path: string, articleTitle?: string) {
  if (path === '/') return `${siteName} · 443eb9#C`
  return `${articleTitle ?? pageNames.get(path) ?? '404 Not Found'} · ${siteName}`
}
