import { describe, expect, it } from 'vitest'
import { parseFormula, analyzeFormula, normalizeChem, ChemError } from './parse'
import { formulaToLatex, formulaToUnicode, equationToLatex, equationToUnicode } from './render'
import {
  parseEquation,
  splitSpeciesSide,
  balanceEquation,
  checkConservation,
} from './equation'

describe('化学式解析', () => {
  it('普通化学式与下标', () => {
    const f = parseFormula('H2O')
    expect(formulaToUnicode(f)).toBe('H₂O')
    expect(formulaToLatex(f)).toBe('H_{2}O')
  })

  it('括号分组', () => {
    const f = parseFormula('Fe(OH)3')
    const { tally } = analyzeFormula(f)
    expect(tally.find((t) => t.symbol === 'O')?.count).toBe(3)
    expect(formulaToLatex(f)).toBe('Fe(OH)_{3}')
  })

  it('结晶水', () => {
    const f = parseFormula('CuSO4·5H2O')
    const { mr } = analyzeFormula(f)
    // CuSO4: 63.546+32.06+64 ≈ 159.6 + 5×18.015 = 249.7
    expect(mr).toBeGreaterThan(249)
    expect(mr).toBeLessThan(250.5)
    expect(formulaToUnicode(f)).toBe('CuSO₄·5H₂O')
  })

  it('带电荷的离子（^ 形式与裸正负号）', () => {
    expect(formulaToUnicode(parseFormula('SO4^2-'))).toBe('SO₄²⁻')
    expect(formulaToUnicode(parseFormula('NH4^+'))).toBe('NH₄⁺')
    expect(formulaToUnicode(parseFormula('Na+'))).toBe('Na⁺')
    expect(formulaToUnicode(parseFormula('Cl-'))).toBe('Cl⁻')
  })

  it('状态标注', () => {
    const f = parseFormula('CO2(g)')
    expect(formulaToUnicode(f)).toBe('CO₂(g)')
  })

  it('相对分子质量：KMnO4 = 158', () => {
    const { mr } = analyzeFormula(parseFormula('KMnO4'))
    expect(Math.round(mr)).toBe(158)
  })

  it('错误提示带位置', () => {
    try {
      parseFormula('H2O)')
      throw new Error('should throw')
    } catch (e) {
      expect(e).toBeInstanceOf(ChemError)
      expect((e as ChemError).message).toContain('右括号')
    }
    expect(() => parseFormula('Xx2')).toThrow(ChemError)
    expect(() => parseFormula('')).toThrow(ChemError)
  })

  it('Unicode 下标输入归一化', () => {
    expect(normalizeChem('H₂SO₄')).toBe('H2SO4')
    expect(formulaToUnicode(parseFormula('H₂SO₄'))).toBe('H₂SO₄')
  })
})

describe('方程式切分与解析', () => {
  it('+ 分隔与电荷区分', () => {
    expect(splitSpeciesSide('H2+O2')).toEqual(['H2', 'O2'])
    expect(splitSpeciesSide('Na+ + Cl-')).toEqual(['Na+', 'Cl-'])
    expect(splitSpeciesSide('Cu2+ + Fe')).toEqual(['Cu2+', 'Fe'])
    expect(splitSpeciesSide('Ag+ + Cl-')).toEqual(['Ag+', 'Cl-'])
  })

  it('箭头形式与条件', () => {
    const eq = parseEquation('CH4 + 2O2 ->(点燃) CO2 + 2H2O')
    expect(eq.left.items.length).toBe(2)
    expect(eq.right.items.length).toBe(2)
    expect(eq.condition).toBe('点燃')
    expect(eq.reversible).toBe(false)

    const eq2 = parseEquation('N2 + 3H2 ⇌(催化剂) NH3')
    expect(eq2.reversible).toBe(true)
    expect(eq2.condition).toBe('催化剂')
  })

  it('等号形式', () => {
    const eq = parseEquation('Zn + H2SO4 = ZnSO4 + H2')
    expect(eq.left.items.length).toBe(2)
    expect(eq.right.items.length).toBe(2)
  })

  it('方程式渲染（LaTeX 与纯文本）', () => {
    const eq = parseEquation('CH4 + O2 ->(点燃) CO2 + H2O')
    const lx = equationToLatex(eq)
    expect(lx).toContain('\\xrightarrow{\\text{点燃}}')
    expect(lx).toContain('CH_{4}')
    const uni = equationToUnicode(eq)
    expect(uni).toContain('→(点燃)')
    expect(uni).toContain('CO₂')

    const eq2 = parseEquation('N2 + H2 <=> NH3')
    expect(equationToLatex(eq2)).toContain('\\rightleftharpoons')
    expect(equationToUnicode(eq2)).toContain('⇌')
  })
})

describe('自动配平', () => {
  function coeffsOf(src: string): number[] {
    const eq = parseEquation(src)
    return balanceEquation(eq).coeffs
  }

  it('H2 + O2 -> H2O', () => {
    expect(coeffsOf('H2 + O2 -> H2O')).toEqual([2, 1, 2])
  })

  it('CH4 + O2 -> CO2 + H2O', () => {
    expect(coeffsOf('CH4 + O2 -> CO2 + H2O')).toEqual([1, 2, 1, 2])
  })

  it('Fe + O2 -> Fe3O4（工业铁燃烧）', () => {
    expect(coeffsOf('Fe + O2 -> Fe3O4')).toEqual([3, 2, 1])
  })

  it('Al + HCl -> AlCl3 + H2', () => {
    expect(coeffsOf('Al + HCl -> AlCl3 + H2')).toEqual([2, 6, 2, 3])
  })

  it('KMnO4 分解', () => {
    expect(coeffsOf('KMnO4 -> K2MnO4 + MnO2 + O2')).toEqual([2, 1, 1, 1])
  })

  it('离子方程式电荷守恒：Fe2+ + ... ', () => {
    // Zn + Cu2+ -> Zn2+ + Cu
    expect(coeffsOf('Zn + Cu2+ -> Zn2+ + Cu')).toEqual([1, 1, 1, 1])
    // MnO4- + Fe2+ + H+ -> Mn2+ + Fe3+ + H2O
    expect(
      coeffsOf('MnO4^- + Fe2+ + H+ -> Mn2+ + Fe3+ + H2O')
    ).toEqual([1, 5, 8, 1, 5, 4])
  })

  it('配平后守恒校验通过', () => {
    const eq = parseEquation('C3H8 + O2 -> CO2 + H2O')
    const { coeffs } = balanceEquation(eq)
    expect(checkConservation(eq, coeffs)).toBe(true)
    expect(coeffs).toEqual([1, 5, 3, 4])
  })

  it('无法唯一配平时给出中文解释', () => {
    // C + O2 -> CO + CO2 有两个自由变量，不能唯一确定
    expect(() => coeffsOf('C + O2 -> CO + CO2')).toThrow(/唯一/)
  })
})
