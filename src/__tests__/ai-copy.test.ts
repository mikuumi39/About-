import { describe, expect, it } from 'vitest'
import {
  mathAIText,
  chemFormulaAIText,
  chemEquationAIText,
  chemDisplayToAscii,
} from '../engine/text/ai-text'
import { smartKey, wrapFunction, unclosedParens, autoCompleteParens } from '../components/calc/smartInsert'

describe('数学 AI 纯文本', () => {
  it('规格样例：分数与根号', () => {
    expect(mathAIText('1/2+√2')).toBe('1/2 + sqrt(2)')
    expect(mathAIText('1/2+1/3')).toBe('1/2 + 1/3')
  })

  it('裸根号参数自动加括号', () => {
    expect(mathAIText('√25')).toBe('sqrt(25)')
    expect(mathAIText('∛27*2')).toBe('cbrt(27)*2')
    expect(mathAIText('sin30°+1')).toBe('sin(30°) + 1')
  })

  it('隐式乘法补星号', () => {
    expect(mathAIText('2x+3=7')).toBe('2*x + 3 = 7')
    expect(mathAIText('2(3+4)')).toBe('2*(3 + 4)')
    expect(mathAIText('(1+2)(3+4)')).toBe('(1 + 2)*(3 + 4)')
    expect(mathAIText('2π')).toBe('2*pi')
  })

  it('幂与乘除不加空格，函数保持调用形态', () => {
    expect(mathAIText('2^10')).toBe('2^10')
    expect(mathAIText('2*3/4')).toBe('2*3/4')
    expect(mathAIText('ln(e^2)')).toBe('ln(e^2)')
  })
})

describe('化学 AI 纯文本', () => {
  it('规格样例：化学式', () => {
    expect(chemFormulaAIText('H2SO4')).toBe('H2SO4')
    expect(chemFormulaAIText('SO42-')).toBe('SO4^2-')
    expect(chemFormulaAIText('NH4+')).toBe('NH4^+')
    expect(chemFormulaAIText('Fe3+')).toBe('Fe^3+')
    expect(chemFormulaAIText('Ca(OH)2')).toBe('Ca(OH)2')
    expect(chemFormulaAIText('Al2(SO4)3')).toBe('Al2(SO4)3')
  })

  it('结晶水与状态', () => {
    expect(chemFormulaAIText('CuSO4·5H2O')).toBe('CuSO4·5H2O')
    expect(chemFormulaAIText('CO2(g)')).toBe('CO2(g)')
  })

  it('Unicode 展示文本还原为 ASCII', () => {
    expect(chemDisplayToAscii('H₂SO₄')).toBe('H2SO4')
    expect(chemDisplayToAscii('SO₄²⁻')).toBe('SO4^2-')
  })

  it('方程式：系数、箭头、可逆', () => {
    expect(chemEquationAIText('2H2 + O2 -> 2H2O')).toBe('2H2 + O2 -> 2H2O')
    expect(chemEquationAIText('2H₂ + O₂ → 2H₂O')).toBe('2H2 + O2 -> 2H2O')
    expect(chemEquationAIText('N2 + 3H2 <=> 2NH3')).toBe('N2 + 3H2 <-> 2NH3')
    // 条件是展示信息，AI 文本中省略
    expect(chemEquationAIText('CH4 + 2O2 ->(点燃) CO2 + 2H2O')).toBe(
      'CH4 + 2O2 -> CO2 + 2H2O'
    )
  })
})

describe('智能按键光标语义', () => {
  it('√ 无选区：插入 √() 光标进括号', () => {
    const r = smartKey('', 0, 0, 'sqrt')
    expect(r.next).toBe('√()')
    expect(r.caret).toBe(2)
  })

  it('√ 有选区：包裹选区', () => {
    const r = smartKey('x+1', 0, 3, 'sqrt')
    expect(r.next).toBe('√(x+1)')
    expect(r.caret).toBe(6)
  })

  it('x² 有选区：(选区)^2；无选区追加 ^2', () => {
    expect(smartKey('x+1', 0, 3, 'square').next).toBe('(x+1)^2')
    const r = smartKey('12', 2, 2, 'square')
    expect(r.next).toBe('12^2')
  })

  it('xʸ 无选区：^() 光标进指数', () => {
    const r = smartKey('', 0, 0, 'power')
    expect(r.next).toBe('^()')
    expect(r.caret).toBe(2)
  })

  it('具名函数包裹选区 / 空插入', () => {
    expect(wrapFunction('30', 0, 2, 'sin').next).toBe('sin(30)')
    const r = wrapFunction('', 0, 0, 'log')
    expect(r.next).toBe('log()')
    expect(r.caret).toBe(4)
  })

  it('括号计数与自动闭合', () => {
    expect(unclosedParens('sin(', 4)).toBe(1)
    expect(unclosedParens('sin(x)', 6)).toBe(0)
    expect(autoCompleteParens('√(25+')).toBe('√(25+)')
    expect(autoCompleteParens('(1+2)*3')).toBe('(1+2)*3')
  })
})
