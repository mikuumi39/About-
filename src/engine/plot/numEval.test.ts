import { describe, expect, it } from 'vitest'
import { compilePlotFunction, PlotError } from './numEval'

describe('绘图数值求值', () => {
  it('基本运算与幂', () => {
    expect(compilePlotFunction('x^2').fn(3)).toBeCloseTo(9, 12)
    expect(compilePlotFunction('2x+1').fn(2)).toBeCloseTo(5, 12)
    expect(compilePlotFunction('1/x').fn(4)).toBeCloseTo(0.25, 12)
  })

  it('三角函数（弧度制）', () => {
    expect(compilePlotFunction('sin(x)').fn(Math.PI / 2)).toBeCloseTo(1, 12)
    expect(compilePlotFunction('cos(x)').fn(0)).toBeCloseTo(1, 12)
  })

  it('定义域外返回 NaN / Infinity', () => {
    expect(Number.isNaN(compilePlotFunction('sqrt(x)').fn(-1))).toBe(true)
    expect(compilePlotFunction('ln(x)').fn(0)).toBe(-Infinity)
    // 负底的分数次幂不绘制
    expect(Number.isNaN(compilePlotFunction('x^(1/2)').fn(-4))).toBe(true)
  })

  it('非 x 变量给出中文错误', () => {
    expect(() => compilePlotFunction('y')).toThrow(/只支持自变量 x/)
    expect(() => compilePlotFunction('xy')).toThrow(/只支持自变量 x/)
    expect(() => compilePlotFunction('a*x')).toThrow(/「a」/)
  })

  it('空表达式报错', () => {
    expect(() => compilePlotFunction('')).toThrow(PlotError)
  })

  it('导出 LaTeX', () => {
    const c = compilePlotFunction('sqrt(x)')
    expect(c.latex).toContain('\\sqrt')
  })
})
