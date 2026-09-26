// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import {
  collectBackup,
  parseBackup,
  applyBackup,
  importBackup,
  BACKUP_VERSION,
} from '../store/backup'
import { useSettings } from '../store/settings'
import { useHistory } from '../store/history'
import { useSymbolStore } from '../store/symbols'

beforeEach(() => {
  window.localStorage.clear()
  useSettings.setState({
    themeId: 'minimal-light',
    mode: 'simple',
    angle: 'deg',
    fontScale: 1,
    animations: true,
    decimalPlaces: 9,
  })
  useHistory.setState({ items: [] })
  useSymbolStore.setState({ favorites: [], usage: {} })
})

function makeBackup(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    app: 'jiansuan',
    version: BACKUP_VERSION,
    exportedAt: '2026-02-08T00:00:00.000Z',
    data: {
      settings: { themeId: 'sakura-pink', mode: 'pro', decimalPlaces: 4 },
      history: [
        { id: 'a1', expr: '1+1', kind: 'value', main: '2', ts: 1000 },
        { id: 'a2', expr: '√25', kind: 'value', main: '5', ts: 2000, fav: true },
      ],
      symbols: {
        favorites: ['π', '±'],
        usage: { π: { count: 3, last: 500 } },
      },
      formulaDraft: '\\frac{a}{b}',
    },
    ...overrides,
  })
}

describe('数据备份与导入导出', () => {
  it('收集 → 导入（replace）完整还原', () => {
    useSettings.getState().setThemeId('terminal')
    useHistory.getState().add({ expr: '2+2', kind: 'value', main: '4' })
    const file = collectBackup()
    // 清空后还原
    useHistory.setState({ items: [] })
    const res = applyBackup(parseBackup(JSON.stringify(file)), 'replace')
    expect(res.appliedSettings).toBe(true)
    expect(useSettings.getState().themeId).toBe('terminal')
    expect(useHistory.getState().items.some((i) => i.expr === '2+2')).toBe(true)
  })

  it('标准备份应用：设置校验非法主题回退', () => {
    importBackup(makeBackup(), 'merge')
    expect(useSettings.getState().themeId).toBe('sakura-pink')
    expect(useSettings.getState().mode).toBe('pro')
    expect(useSettings.getState().decimalPlaces).toBe(4)
    expect(useHistory.getState().items.length).toBe(2)
    expect(useSymbolStore.getState().favorites).toContain('π')
  })

  it('合并模式不丢现有数据，收藏去重', () => {
    useHistory.getState().add({ expr: '9/2', kind: 'value', main: '4.5' })
    useSymbolStore.setState({ favorites: ['√'], usage: {} })
    importBackup(makeBackup(), 'merge')
    const hist = useHistory.getState().items
    expect(hist.some((i) => i.expr === '9/2')).toBe(true)
    expect(hist.some((i) => i.expr === '√25')).toBe(true)
    const favs = useSymbolStore.getState().favorites
    expect(favs).toContain('√')
    expect(favs).toContain('π')
  })

  it('v0 旧格式自动迁移到 v1', () => {
    const legacy = JSON.stringify({
      app: 'jiansuan',
      version: 0,
      data: { settings: { angle: 'rad' }, history: [] },
    })
    const file = parseBackup(legacy)
    expect(file.version).toBe(BACKUP_VERSION)
    importBackup(legacy, 'merge')
    expect(useSettings.getState().angle).toBe('rad')
  })

  it('未来版本明确拒绝', () => {
    const future = makeBackup({ version: 99 })
    expect(() => parseBackup(future)).toThrow(/还新/)
  })

  it('非本应用文件拒绝', () => {
    expect(() => parseBackup('{"app":"other"}')).toThrow(/不是「我的计算器喵」/)
    expect(() => parseBackup('not json')).toThrow(/JSON/)
    expect(() => parseBackup('[1,2]')).toThrow(/结构不对/)
  })

  it('恶意/畸形字段被清洗而不是崩溃', () => {
    const evil = JSON.stringify({
      app: 'jiansuan',
      version: 1,
      data: {
        settings: { themeId: '<script>', decimalPlaces: 99999, fontScale: 42, extra: (() => undefined)() },
        history: [
          { expr: 'ok', kind: 'value' },
          { expr: '', kind: 'value' },
          null,
          { expr: 'bad-kind', kind: 'hax', payload: 'javascript:alert(1)' },
        ],
        symbols: { favorites: ['<img src=x onerror=1>', 'π'], usage: { x: 'not-an-object' } },
      },
    })
    importBackup(evil, 'replace')
    const s = useSettings.getState()
    expect(s.themeId).toBe('minimal-light') // 非法主题回退
    expect(s.decimalPlaces).toBe(12) // 夹紧
    expect(s.fontScale).toBe(1) // 越界丢弃
    const hist = useHistory.getState().items
    expect(hist.length).toBe(1) // 只留合法条目
    expect(JSON.stringify(hist)).not.toContain('payload')
    expect(useSymbolStore.getState().favorites).toEqual(['π'])
  })

  it('公式草稿随备份恢复', () => {
    localStorage.removeItem('jiansuan.formula-draft')
    importBackup(makeBackup(), 'replace')
    expect(localStorage.getItem('jiansuan.formula-draft')).toBe('\\frac{a}{b}')
  })

  it('历史收藏在超量时优先保留', () => {
    for (let i = 0; i < 105; i++) {
      useHistory.getState().add({ expr: `x${i}`, kind: 'value' })
    }
    const items = useHistory.getState().items
    expect(items.length).toBeLessThanOrEqual(100)
  })
})
