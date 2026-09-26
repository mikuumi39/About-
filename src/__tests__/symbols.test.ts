// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { useSymbolStore, commonSymbols } from '../store/symbols'
import { USABLE_SYMBOLS } from '../data/symbols'

beforeEach(() => {
  window.localStorage.clear()
  useSymbolStore.setState({ favorites: [], usage: {} })
})

describe('符号使用统计与常用排序', () => {
  it('记录使用次数', () => {
    const s = useSymbolStore.getState()
    s.record('π')
    s.record('π')
    s.record('√')
    expect(useSymbolStore.getState().usage['π'].count).toBe(2)
    expect(useSymbolStore.getState().usage['√'].count).toBe(1)
  })

  it('收藏切换', () => {
    const s = useSymbolStore.getState()
    s.toggleFav('π')
    expect(useSymbolStore.getState().favorites).toContain('π')
    s.toggleFav('π')
    expect(useSymbolStore.getState().favorites).not.toContain('π')
  })

  it('常用列表：收藏优先，其次按使用次数', () => {
    const s = useSymbolStore.getState()
    s.record('θ') // 用过一次
    s.record('θ')
    s.record('α') // 用过一次
    s.toggleFav('Ω') // 收藏
    const list = commonSymbols(20)
    expect(list[0]).toBe('Ω') // 收藏最优先
    expect(list.indexOf('θ')).toBeLessThan(list.indexOf('α')) // 次数多在前
    expect(list.length).toBeGreaterThanOrEqual(3)
  })

  it('符号库无重复且都有名称', () => {
    const set = new Set(USABLE_SYMBOLS.map((s) => s.ch))
    expect(set.size).toBe(USABLE_SYMBOLS.length)
    expect(USABLE_SYMBOLS.every((s) => s.name.trim() !== '')).toBe(true)
  })
})
