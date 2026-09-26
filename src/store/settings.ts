import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type WorkMode = 'simple' | 'pro'
export type AngleUnit = 'deg' | 'rad'
/** 复制格式：默认 AI 纯文本；高级设置可换 Unicode / LaTeX */
export type CopyMode = 'ai' | 'unicode' | 'latex'

/**
 * 基础设置（高频项）。存储键带版本号，未来结构变化时做迁移。
 */
interface SettingsState {
  themeId: string
  mode: WorkMode
  angle: AngleUnit
  /** 字号缩放 0.85 – 1.3，1 = 标准 */
  fontScale: number
  /** 全站动画开关（无障碍） */
  animations: boolean
  /** 结果小数位数（2–12），默认 9 位有效展示 */
  decimalPlaces: number
  /** 复制按钮输出的格式（默认 AI 纯文本） */
  copyMode: CopyMode
  setThemeId: (id: string) => void
  setMode: (mode: WorkMode) => void
  setAngle: (angle: AngleUnit) => void
  setFontScale: (scale: number) => void
  setAnimations: (on: boolean) => void
  setDecimalPlaces: (n: number) => void
  setCopyMode: (m: CopyMode) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      themeId: 'ios-dark',
      mode: 'simple',
      angle: 'deg',
      fontScale: 1,
      animations: true,
      decimalPlaces: 9,
      copyMode: 'ai',
      setThemeId: (id) => set({ themeId: id }),
      setMode: (mode) => set({ mode }),
      setAngle: (angle) => set({ angle }),
      setFontScale: (scale) =>
        set({ fontScale: Math.min(1.3, Math.max(0.85, scale)) }),
      setAnimations: (animations) => set({ animations }),
      setDecimalPlaces: (n) =>
        set({ decimalPlaces: Math.min(12, Math.max(2, Math.round(n))) }),
      setCopyMode: (copyMode) => set({ copyMode }),
    }),
    {
      name: 'jiansuan.settings.v1',
      version: 1,
    }
  )
)

/** 把设置副作用同步到 DOM（主题、字号、动画） */
export function syncSettingsToDom(): () => void {
  const apply = () => {
    const s = useSettings.getState()
    document.documentElement.style.setProperty('--font-scale', String(s.fontScale))
  }
  apply()
  return useSettings.subscribe(apply)
}
