import { describe, expect, it } from 'vitest'
import {
  molarMassOf,
  molFromMass,
  particlesFromMass,
  gasVolumeSTP,
  molarity,
  massFraction,
  dilute,
  phFromH,
  hFromPh,
  ohFromPh,
} from './calc'

describe('化学计算器', () => {
  it('摩尔质量：H2O=18，CO2=44', () => {
    expect(Math.round(molarMassOf('H2O'))).toBe(18)
    expect(Math.round(molarMassOf('CO2'))).toBe(44)
  })

  it('n = m / M：9 g 水 ≈ 0.5 mol（精确原子量下 Mr=18.015）', () => {
    const mr = molarMassOf('H2O')
    expect(mr).toBeCloseTo(18.015, 3)
    expect(molFromMass(9, mr)).toBeCloseTo(0.5, 3)
  })

  it('粒子数：0.5 mol 水约 3.01e23 个', () => {
    const r = particlesFromMass(9, 'H2O')
    expect(r.n).toBeCloseTo(0.5, 3)
    expect(r.count / 3.01e23).toBeCloseTo(1, 2)
  })

  it('标况气体体积：1 mol = 22.4 L', () => {
    expect(gasVolumeSTP(1)).toBeCloseTo(22.4, 10)
    expect(gasVolumeSTP(2)).toBeCloseTo(44.8, 10)
  })

  it('物质的量浓度 c = n/V', () => {
    expect(molarity(0.5, 2)).toBeCloseTo(0.25, 12)
  })

  it('质量分数与校验', () => {
    expect(massFraction(20, 100)).toBeCloseTo(0.2, 12)
    expect(() => massFraction(120, 100)).toThrow(/不能大于/)
  })

  it('稀释公式四项互求', () => {
    // 2 mol/L × 0.5 L 稀释到 2 L → 0.5 mol/L
    expect(dilute({ c1: 2, v1: 0.5, v2: 2, c2: null }).value).toBeCloseTo(0.5, 12)
    // 稀释到 0.5 mol/L、终体积 2 L → 需要浓液 0.5 L
    expect(dilute({ c1: 2, v1: null, c2: 0.5, v2: 2 }).value).toBeCloseTo(0.5, 12)
    expect(dilute({ c1: null, v1: 1, c2: 4, v2: 0.25 }).value).toBeCloseTo(1, 12)
    expect(() => dilute({ c1: 1, v1: 1 })).toThrow(/恰好留一个/)
    expect(() => dilute({})).toThrow(/恰好留一个/)
  })

  it('pH 与反向', () => {
    expect(phFromH(1e-7)).toBe(7)
    expect(phFromH(0.1)).toBe(1)
    expect(phFromH(1e-3)).toBe(3)
    expect(hFromPh(3)).toBeCloseTo(1e-3, 15)
    // 往返一致
    expect(phFromH(hFromPh(4.5))).toBeCloseTo(4.5, 2)
  })

  it('c(OH⁻) 由 pH：pH=7 时为 1e-7', () => {
    expect(ohFromPh(7)).toBeCloseTo(1e-7, 18)
  })

  it('非法输入给中文错误', () => {
    expect(() => molFromMass(-1, 18)).toThrow(/不能小于/)
    expect(() => phFromH(0)).toThrow(/大于 0/)
  })
})
