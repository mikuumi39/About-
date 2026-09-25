import { create } from 'zustand'

interface CalcBridgeState {
  pending: string | null
  send: (text: string) => void
  /** 取走待发送内容（取走即清空） */
  consume: () => string | null
}

/** 公式编辑器 → 计算器 的单向传递 */
export const useCalcBridge = create<CalcBridgeState>((set) => ({
  pending: null,
  send: (text) => set({ pending: text }),
  consume: () => {
    let taken: string | null = null
    set((s) => {
      taken = s.pending
      return { pending: null }
    })
    return taken
  },
}))
