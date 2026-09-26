export interface ThemeDef {
  id: string
  name: string
  emoji: string
  appearance: 'light' | 'dark'
  /** 设置页预览色点 [背景, 面板, 强调] */
  preview: [string, string, string]
}

/** 内置官方主题（第三方主题系统在 Phase 12 接入） */
export const BUILTIN_THEMES: ThemeDef[] = [
  { id: 'ios-dark', name: '毛玻璃效果', emoji: '🧊', appearance: 'dark', preview: ['#141b2e', 'rgba(255,255,255,0.12)', '#ff9f0a'] },
  { id: 'minimal-light', name: '极简白', emoji: '🤍', appearance: 'light', preview: ['#f5f6f8', '#ffffff', '#2160d3'] },
  { id: 'violet-dark', name: '深紫', emoji: '🌌', appearance: 'dark', preview: ['#16131d', '#201b2b', '#9080f2'] },
  { id: 'oled-black', name: 'OLED 黑', emoji: '🖤', appearance: 'dark', preview: ['#000000', '#0d0d10', '#4d8dff'] },
  { id: 'sakura-pink', name: '二次元', emoji: '🌸', appearance: 'light', preview: ['#fdf2f6', '#ffffff', '#ec6a9c'] },
  { id: 'ocean-blue', name: '蓝色', emoji: '🌊', appearance: 'light', preview: ['#edf4fb', '#ffffff', '#1976d2'] },
  { id: 'fresh-green', name: '清新', emoji: '🌿', appearance: 'light', preview: ['#f0f7ee', '#ffffff', '#2e9e44'] },
  { id: 'study-paper', name: '学习工具', emoji: '📚', appearance: 'light', preview: ['#f5efe3', '#fdfaf2', '#a8742a'] },
  { id: 'terminal', name: 'Terminal', emoji: '💻', appearance: 'dark', preview: ['#0a0f0a', '#0f1610', '#3dd968'] },
]

const THEME_IDS = new Set(BUILTIN_THEMES.map((t) => t.id))

export function isBuiltinTheme(id: string): boolean {
  return THEME_IDS.has(id)
}

/** id 是否可用（内置或已安装的第三方主题） */
export function themeExists(id: string): boolean {
  if (THEME_IDS.has(id)) return true
  try {
    const raw = localStorage.getItem('jiansuan.custom-themes.v1')
    if (raw === null) return false
    const parsed = JSON.parse(raw) as { state?: { themes?: Array<{ id?: string }> } }
    return parsed.state?.themes?.some((t) => t.id === id) ?? false
  } catch {
    return false
  }
}

/** 应用主题到 <html data-theme>，并同步移动端地址栏颜色 */
export function applyTheme(id: string, animations = true): void {
  const themeId = themeExists(id) ? id : 'ios-dark'
  document.documentElement.dataset.theme = themeId
  document.documentElement.dataset.motion = animations ? 'on' : 'off'

  requestAnimationFrame(() => {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    if (bg !== '') {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      if (meta === null) {
        meta = document.createElement('meta')
        meta.name = 'theme-color'
        document.head.appendChild(meta)
      }
      meta.content = bg
    }
  })
}
