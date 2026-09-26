import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { USABLE_SYMBOLS } from '../data/symbols'

interface UsageEntry {
  count: number
  last: number
}

interface SymbolState {
  favorites: string[]
  usage: Record<string, UsageEntry>
  toggleFav: (ch: string) => void
  record: (ch: string) => void
}

export const useSymbolStore = create<SymbolState>()(
  persist(
    (set) => ({
      favorites: [],
      usage: {},
      toggleFav: (ch) =>
        set((s) => ({
          favorites: s.favorites.includes(ch)
            ? s.favorites.filter((f) => f !== ch)
            : [ch, ...s.favorites].slice(0, 200),
        })),
      record: (ch) =>
        set((s) => {
          const prev = s.usage[ch] ?? { count: 0, last: 0 }
          return {
            usage: {
              ...s.usage,
              [ch]: { count: prev.count + 1, last: Date.now() },
            },
          }
        }),
    }),
    { name: 'jiansuan.symbols.v1', version: 1 }
  )
)

/**
 * 「我的常用」排序：
 * 1. 收藏的符号（按收藏顺序）
 * 2. 使用次数多的在前，次数相同按最近使用
 * 3. 其余按内置顺序补充到足够数量
 */
export function commonSymbols(limit = 40): string[] {
  const { favorites, usage } = useSymbolStore.getState()
  const out: string[] = []
  for (const ch of favorites) {
    if (USABLE_SYMBOLS.some((s) => s.ch === ch)) out.push(ch)
  }
  const used = Object.entries(usage)
    .filter(([ch]) => !out.includes(ch))
    .sort((a, b) => b[1].count - a[1].count || b[1].last - a[1].last)
  for (const [ch] of used) {
    out.push(ch)
    if (out.length >= limit) return out.slice(0, limit)
  }
  for (const s of USABLE_SYMBOLS) {
    if (out.length >= limit) break
    if (!out.includes(s.ch)) out.push(s.ch)
  }
  return out.slice(0, limit)
}
