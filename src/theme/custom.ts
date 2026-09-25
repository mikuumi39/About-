/**
 * 第三方主题：纯数据导入（JSON 或 ZIP 内的 theme.json）。
 * 安全原则：只接受「已知令牌名 + 受控字符集的颜色/阴影值」，
 * 生成的 CSS 完全由本模块拼装，用户字符串永远不进入选择器或规则名。
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CustomTheme {
  /** 固定为 custom-<hash>，不可由文件指定 */
  id: string
  name: string
  appearance: 'light' | 'dark'
  tokens: Record<string, string>
  createdAt: number
}

export class ThemeImportError extends Error {}

// ---------- 令牌白名单（与 tokens.css 的语义层一一对应） ----------

export const THEME_TOKEN_WHITELIST = [
  '--bg',
  '--panel',
  '--panel-2',
  '--border',
  '--text',
  '--text-2',
  '--text-3',
  '--accent',
  '--accent-text',
  '--accent-weak',
  '--danger',
  '--danger-weak',
  '--ok',
  '--warn',
  '--warn-weak',
  '--key',
  '--key-hover',
  '--key-active',
  '--key-fn',
  '--backdrop',
  '--shadow-1',
  '--shadow-2',
] as const

export type ThemeTokenName = (typeof THEME_TOKEN_WHITELIST)[number]

const TOKEN_SET = new Set<string>(THEME_TOKEN_WHITELIST)

/** 必填核心令牌：缺了主题会不可用 */
const REQUIRED: ThemeTokenName[] = ['--bg', '--panel', '--border', '--text', '--accent']

// ---------- 值清洗 ----------

/** 允许的字符集：颜色、阴影、数字、逗号、斜杠、括号、#、.、% */
const VALUE_RE = /^[-#.,%()\s/\da-zA-Z]+$/
/** 明确禁止的片段（防 url/var/expression/@ 等注入面） */
const FORBIDDEN = ['url(', 'var(', 'expression', '@', '<', '>', ';', '{', '}', '`', '"', "'"]

export function sanitizeTokenValue(name: string, raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim()
  if (v === '' || v.length > 80) return null
  if (!VALUE_RE.test(v)) return null
  const lower = v.toLowerCase()
  for (const f of FORBIDDEN) {
    if (lower.includes(f)) return null
  }
  // shadow/backdrop 允许复合值；颜色类令牌再收紧一层
  if (!name.startsWith('--shadow')) {
    const colorish =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^rgba?\([\d\s.,%/]+\)$/i.test(v) ||
      /^hsla?\([\d\s.,%deg]+\)$/i.test(v)
    if (!colorish) return null
  }
  return v
}

// ---------- 整体校验 ----------

function hashId(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0
  }
  return `custom-${(h >>> 0).toString(36)}`
}

/** 解析并校验一个第三方主题对象；任何问题抛中文错误 */
export function validateCustomTheme(raw: unknown): CustomTheme {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ThemeImportError('主题文件结构不对：应该是一个 JSON 对象喵')
  }
  const obj = raw as Record<string, unknown>

  const name =
    typeof obj['name'] === 'string' && obj['name'].trim() !== ''
      ? obj['name'].trim().slice(0, 20)
      : ''
  if (name === '') throw new ThemeImportError('主题缺少名称 name 喵')

  const appearance =
    obj['appearance'] === 'dark' ? ('dark' as const) : obj['appearance'] === 'light' ? ('light' as const) : null
  if (appearance === null) {
    throw new ThemeImportError('appearance 要写 "light" 或 "dark" 喵')
  }

  const tokensRaw = obj['tokens']
  if (typeof tokensRaw !== 'object' || tokensRaw === null || Array.isArray(tokensRaw)) {
    throw new ThemeImportError('缺少 tokens 字段（颜色令牌表）喵')
  }
  const tokens: Record<string, string> = {}
  let knownCount = 0
  for (const [key, value] of Object.entries(tokensRaw as Record<string, unknown>)) {
    if (!TOKEN_SET.has(key)) continue // 未知令牌直接忽略，不报错也不使用
    const clean = sanitizeTokenValue(key, value)
    if (clean !== null) {
      tokens[key] = clean
      knownCount++
    }
  }
  for (const req of REQUIRED) {
    if (tokens[req] === undefined) {
      throw new ThemeImportError(`缺少必要的颜色 ${req}，检查一下 theme 文件喵`)
    }
  }
  if (knownCount < REQUIRED.length) {
    throw new ThemeImportError('可用的颜色太少了喵')
  }

  // id 由内容决定：同内容不重复安装；名字不同但内容相同视为同一主题
  const fingerprint = JSON.stringify({ name, appearance, tokens })
  return { id: hashId(fingerprint), name, appearance, tokens, createdAt: Date.now() }
}

// ---------- CSS 生成与挂载（值已全部过白名单） ----------

export function buildStyleText(themes: CustomTheme[]): string {
  return themes
    .map((t) => {
      const lines = [
        `color-scheme: ${t.appearance};`,
        ...Object.entries(t.tokens).map(([k, v]) => `${k}: ${v};`),
      ]
      return `html[data-theme='${t.id}']{\n${lines.join('\n')}\n}`
    })
    .join('\n')
}

const STYLE_ID = 'jiansuan-custom-themes'

export function installCustomStyles(themes: CustomTheme[]): void {
  let el = document.getElementById(STYLE_ID)
  if (themes.length === 0) {
    el?.remove()
    return
  }
  if (el === null) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  el.textContent = buildStyleText(themes)
}

// ---------- ZIP / JSON 解析 ----------

export async function extractThemeFromZip(buf: ArrayBuffer): Promise<unknown> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buf)
  // 根目录的 theme.json，或任意一级子目录里的 theme.json（兼容「压缩包套文件夹」习惯）
  let file = zip.file('theme.json')
  if (file === null) {
    const matches = zip.file(/(^|\/)theme\.json$/)
    file = matches[0] ?? null
  }
  if (file === null) {
    throw new ThemeImportError('ZIP 里没有找到 theme.json 喵')
  }
  try {
    return JSON.parse(await file.async('string'))
  } catch {
    throw new ThemeImportError('theme.json 不是有效的 JSON 喵')
  }
}

// ---------- 存储与应用 ----------

interface CustomThemeState {
  themes: CustomTheme[]
  add: (t: CustomTheme) => void
  remove: (id: string) => void
}

export const useCustomThemes = create<CustomThemeState>()(
  persist(
    (set, get) => ({
      themes: [],
      add: (t) => set((s) => ({ themes: [...s.themes.filter((x) => x.id !== t.id), t].slice(-50) })),
      remove: (id) => {
        set((s) => ({ themes: s.themes.filter((x) => x.id !== id) }))
        installCustomStyles(get().themes)
      },
    }),
    { name: 'jiansuan.custom-themes.v1', version: 1 }
  )
)

/** App 启动时调用：把所有自定义主题样式挂上 */
export function bootstrapCustomThemes(): void {
  installCustomStyles(useCustomThemes.getState().themes)
}
