import { describe, expect, it } from 'vitest'
import { parseHash, VIEWS } from './nav'

describe('导航哈希解析', () => {
  it('空哈希默认进入计算器', () => {
    expect(parseHash('')).toBe('calc')
    expect(parseHash('#')).toBe('calc')
    expect(parseHash('#/')).toBe('calc')
  })

  it('解析合法视图 id', () => {
    expect(parseHash('#/chem')).toBe('chem')
    expect(parseHash('#/settings')).toBe('settings')
  })

  it('非法视图 id 回退到计算器', () => {
    expect(parseHash('#/nope')).toBe('calc')
    expect(parseHash('#/CALC')).toBe('calc')
  })

  it('视图注册表完整', () => {
    const ids = VIEWS.map((v) => v.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'calc',
        'chem',
        'formula',
        'plot',
        'symbols',
        'learn',
        'settings',
      ])
    )
  })
})
