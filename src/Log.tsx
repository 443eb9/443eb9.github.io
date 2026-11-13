import islands from './generated/islands.json'
import { IslandMap } from './IslandMap'

export function Log() {
  return <IslandMap items={islands} mode="log" />
}
