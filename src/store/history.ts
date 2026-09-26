import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CalcHistoryItem {
  id: string
  /** 原始输入表达式 */
  expr: string
  kind: 'value' | 'solve'
  /** 主显示结果（value 时） */
  main?: string
  exact?: string
  /** solve 时的摘要 */
  summary?: string
  ts: number
  /** 收藏标记（收藏的不被挤掉） */
  fav?: boolean
}

interface CalcHistoryState {
  items: CalcHistoryItem[]
  add: (item: Omit<CalcHistoryItem, 'id' | 'ts'>) => void
  remove: (id: string) => void
  clear: () => void
  toggleFav: (id: string) => void
}

const MAX_ITEMS = 100

/** 计算历史；收藏条目在超量时不被清除 */
export const useHistory = create<CalcHistoryState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) =>
        set((s) => {
          const next = [
            { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ts: Date.now() },
            ...s.items,
          ]
          // 先保收藏，再按时间保留最新，总量不超上限
          const favs = next.filter((i) => i.fav === true).slice(0, MAX_ITEMS)
          const rest = next.filter((i) => i.fav !== true).slice(0, MAX_ITEMS - favs.length)
          const merged = [...favs, ...rest].sort((a, b) => b.ts - a.ts)
          return { items: merged.slice(0, MAX_ITEMS) }
        }),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
      toggleFav: (id) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, fav: i.fav !== true } : i)),
        })),
    }),
    { name: 'jiansuan.calc-history.v1', version: 1 }
  )
)
