import { create } from 'zustand'

export interface Toast {
  id: number
  text: string
}

interface ToastState {
  toasts: Toast[]
  show: (text: string) => void
  dismiss: (id: number) => void
}

let nextId = 1

/** 全局轻提示（复制成功等），自动消失 */
export const useToast = create<ToastState>((set) => ({
  toasts: [],
  show: (text) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 1800)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** 复制文本到剪贴板，带降级方案 */
export async function copyText(text: string, okMsg = '已复制'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    useToast.getState().show(okMsg)
  } catch {
    // 降级：旧浏览器 / 非安全上下文
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      useToast.getState().show(okMsg)
    } catch {
      useToast.getState().show('复制失败，请长按文本手动复制')
    }
  }
}
