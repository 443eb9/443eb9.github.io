import { mkdir, writeFile } from 'node:fs/promises'

const FRIENDS_SOURCE = 'https://raw.githubusercontent.com/443eb9/aetheric-cargo/main/partitions/friends.json'

async function main() {
  const response = await fetch(FRIENDS_SOURCE, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`Read friends data failed with HTTP ${response.status}.`)
  const friends = await response.json()
  if (!Array.isArray(friends) || friends.length === 0) throw new Error('Friends data must contain a nonempty array.')

  const links = new Set()
  for (const [index, friend] of friends.entries()) {
    for (const field of ['avatar', 'name', 'link', 'message']) {
      if (typeof friend?.[field] !== 'string' || !friend[field].trim()) throw new Error(`Friend ${index + 1}: ${field} must contain a nonempty string.`)
    }
    if (friend.background != null && typeof friend.background !== 'string') throw new Error(`Friend ${index + 1}: background must contain a string.`)
    if (links.has(friend.link)) throw new Error(`Friend ${index + 1}: link must be unique.`)
    links.add(friend.link)
  }

  await mkdir('src/generated', { recursive: true })
  await writeFile('src/generated/friends.json', JSON.stringify(friends, null, 2) + '\n')
  console.log(`Generated ${friends.length} friends from ${FRIENDS_SOURCE}.`)
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
