import friends from './generated/friends.json'
import { IslandMap, type MapItem } from './IslandMap'

const items: MapItem[] = friends.map(friend => ({
  id: friend.link,
  title: friend.name,
  desc: friend.message,
  tags: [],
  date: null,
  friend: { avatar: friend.avatar, link: friend.link, background: friend.background },
}))

export function Neighbourhood() {
  return <IslandMap items={items} mode="friends" />
}
