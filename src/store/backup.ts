/**
 * 统一数据备份：导出 / 导入 / 版本迁移 / 合并。
 * 备份是纯 JSON 数据，绝不含任何可执行内容；导入时逐字段校验。
 */

import { useSettings } from './settings'
import { useHistory } from './history'
import type { CalcHistoryItem } from './history'
import { useSymbolStore } from './symbols'
import { isBuiltinTheme } from '../theme/themes'

export const BACKUP_VERSION = 1

export interface BackupData {
  settings?: unknown
  history?: unknown
  symbols?: unknown
  formulaDraft?: string
}

export interface BackupFile {
  app: 'jiansuan'
  version: number
  exportedAt: string
  data: BackupData
}

export type BackupMode = 'merge' | 'replace'

const DRAFT_KEY = 'jiansuan.formula-draft'

// ---------- 导出 ----------

export function collectBackup(): BackupFile {
  return {
    app: 'jiansuan',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      settings: useSettings.getState(),
      history: useHistory.getState().items,
      symbols: useSymbolStore.getState(),
      formulaDraft: (() => {
        try {
          return localStorage.getItem(DRAFT_KEY) ?? ''
        } catch {
          return ''
        }
      })(),
    },
  }
}

/** 触发浏览器下载 */
export function downloadBackup(file: BackupFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const day = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `我的计算器喵备份-${day}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ---------- 校验与迁移 ----------

export class BackupError extends Error {}

type UnknownRecord = Record<string, unknown>

function asRecord(v: unknown): UnknownRecord | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as UnknownRecord) : null
}

/**
 * 解析并迁移到当前版本。接受：
 *  - 标准备份 {app:'jiansuan', version, data}
 *  - 未来版本会明确拒绝（向前兼容不做猜测）
 */
export function parseBackup(text: string): BackupFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('这不是有效的 JSON 文件喵')
  }
  const obj = asRecord(raw)
  if (obj === null) throw new BackupError('文件结构不对：应该是一个 JSON 对象')
  if (obj['app'] !== 'jiansuan') {
    throw new BackupError('这不是「我的计算器喵」的备份文件（缺少应用标识）')
  }

  // 迁移链：version N → N+1。新增版本时在这里追加步骤。
  let version = typeof obj['version'] === 'number' ? Math.floor(obj['version']) : 0
  let data = asRecord(obj['data']) ?? {}
  const exportedAt = typeof obj['exportedAt'] === 'string' ? obj['exportedAt'] : ''

  while (version < BACKUP_VERSION) {
    if (version === 0) {
      // v0（早期手测格式）：data 直接平铺，无版本号 —— 结构与 v1 相同
      version = 1
      continue
    }
    throw new BackupError(
      `备份版本太新（v${version}），请先升级 App 再导入喵`
    )
  }
  if (version > BACKUP_VERSION) {
    throw new BackupError(`备份版本 v${version} 比当前 App 还新，请升级后再导入`)
  }

  return { app: 'jiansuan', version, exportedAt, data }
}

// ---------- 字段级校验 ----------

function sanitizeSettings(v: unknown): Partial<Record<string, unknown>> | null {
  const r = asRecord(v)
  if (r === null) return null
  const out: Partial<Record<string, unknown>> = {}
  if (typeof r['themeId'] === 'string') out['themeId'] = isBuiltinTheme(r['themeId']) ? r['themeId'] : 'minimal-light'
  if (r['mode'] === 'simple' || r['mode'] === 'pro') out['mode'] = r['mode']
  if (r['angle'] === 'deg' || r['angle'] === 'rad') out['angle'] = r['angle']
  if (typeof r['fontScale'] === 'number' && r['fontScale'] >= 0.85 && r['fontScale'] <= 1.3) {
    out['fontScale'] = r['fontScale']
  }
  if (typeof r['animations'] === 'boolean') out['animations'] = r['animations']
  if (typeof r['decimalPlaces'] === 'number' && Number.isFinite(r['decimalPlaces'])) {
    out['decimalPlaces'] = Math.min(12, Math.max(2, Math.round(r['decimalPlaces'])))
  }
  if (r['copyMode'] === 'ai' || r['copyMode'] === 'unicode' || r['copyMode'] === 'latex') {
    out['copyMode'] = r['copyMode']
  }
  return out
}

function sanitizeHistory(v: unknown): CalcHistoryItem[] {
  if (!Array.isArray(v)) return []
  const out: CalcHistoryItem[] = []
  for (const it of v) {
    const r = asRecord(it)
    if (r === null) continue
    if (typeof r['expr'] !== 'string' || r['expr'] === '') continue
    if (r['kind'] !== 'value' && r['kind'] !== 'solve') continue
    out.push({
      id: typeof r['id'] === 'string' ? r['id'] : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      expr: r['expr'].slice(0, 500),
      kind: r['kind'],
      main: typeof r['main'] === 'string' ? r['main'].slice(0, 200) : undefined,
      exact: typeof r['exact'] === 'string' ? r['exact'].slice(0, 200) : undefined,
      summary: typeof r['summary'] === 'string' ? r['summary'].slice(0, 500) : undefined,
      ts: typeof r['ts'] === 'number' && Number.isFinite(r['ts']) ? r['ts'] : Date.now(),
      fav: r['fav'] === true,
    })
  }
  return out.slice(0, 100)
}

function sanitizeSymbols(v: unknown): { favorites?: string[]; usage?: Record<string, { count: number; last: number }> } | null {
  const r = asRecord(v)
  if (r === null) return null
  const out: { favorites?: string[]; usage?: Record<string, { count: number; last: number }> } = {}
  if (Array.isArray(r['favorites'])) {
    out['favorites'] = r['favorites'].filter((s): s is string => typeof s === 'string' && s.length <= 8).slice(0, 300)
  }
  const usage = asRecord(r['usage'])
  if (usage !== null) {
    const clean: Record<string, { count: number; last: number }> = {}
    for (const [ch, e] of Object.entries(usage).slice(0, 400)) {
      const er = asRecord(e)
      if (er === null || ch.length > 8) continue
      if (typeof er['count'] === 'number' && er['count'] > 0) {
        clean[ch] = {
          count: Math.min(1e6, Math.round(er['count'])),
          last: typeof er['last'] === 'number' ? er['last'] : 0,
        }
      }
    }
    out['usage'] = clean
  }
  return out
}

// ---------- 应用 ----------

export interface ApplyResult {
  appliedSettings: boolean
  appliedHistory: number
  appliedFavorites: number
  appliedUsage: number
  appliedDraft: boolean
}

export function applyBackup(file: BackupFile, mode: BackupMode): ApplyResult {
  const res: ApplyResult = {
    appliedSettings: false,
    appliedHistory: 0,
    appliedFavorites: 0,
    appliedUsage: 0,
    appliedDraft: false,
  }

  // 设置
  const settings = sanitizeSettings(file.data.settings)
  if (settings !== null && Object.keys(settings).length > 0) {
    useSettings.setState(settings)
    res.appliedSettings = true
  }

  // 历史
  const items = sanitizeHistory(file.data.history)
  if (items.length > 0) {
    if (mode === 'replace') {
      useHistory.setState({ items: items.slice(0, 100) })
      res.appliedHistory = items.length
    } else {
      const cur = useHistory.getState().items
      const seen = new Set(cur.map((i) => i.id))
      const merged = [...cur]
      for (const it of [...items].sort((a, b) => b.ts - a.ts)) {
        if (!seen.has(it.id)) {
          merged.push(it)
          seen.add(it.id)
        }
      }
      // 收藏优先保留
      const favs = merged.filter((i) => i.fav === true).sort((a, b) => b.ts - a.ts).slice(0, 100)
      const rest = merged
        .filter((i) => i.fav !== true)
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 100 - favs.length)
      const finalItems = [...favs, ...rest].sort((a, b) => b.ts - a.ts).slice(0, 100)
      useHistory.setState({ items: finalItems })
      res.appliedHistory = finalItems.filter((i) => items.some((o) => o.id === i.id)).length
    }
  }

  // 符号
  const sym = sanitizeSymbols(file.data.symbols)
  if (sym !== null) {
    const curSym = useSymbolStore.getState()
    if (mode === 'replace') {
      useSymbolStore.setState({
        favorites: sym.favorites ?? [],
        usage: sym.usage ?? {},
      })
      res.appliedFavorites = sym.favorites?.length ?? 0
      res.appliedUsage = Object.keys(sym.usage ?? {}).length
    } else {
      const favs = [...new Set([...curSym.favorites, ...(sym.favorites ?? [])])].slice(0, 300)
      const usage = { ...curSym.usage }
      for (const [ch, e] of Object.entries(sym.usage ?? {})) {
        const prev = usage[ch] ?? { count: 0, last: 0 }
        usage[ch] = { count: Math.max(prev.count, e.count), last: Math.max(prev.last, e.last) }
      }
      useSymbolStore.setState({ favorites: favs, usage })
      res.appliedFavorites = favs.length
      res.appliedUsage = Object.keys(usage).length
    }
  }

  // 公式草稿
  if (typeof file.data.formulaDraft === 'string') {
    try {
      localStorage.setItem(DRAFT_KEY, file.data.formulaDraft.slice(0, 20000))
      res.appliedDraft = true
    } catch {
      /* 存储失败忽略 */
    }
  }

  return res
}

/** 从字符串一步完成解析 + 应用 */
export function importBackup(text: string, mode: BackupMode): ApplyResult {
  return applyBackup(parseBackup(text), mode)
}
