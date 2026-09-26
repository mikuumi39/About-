import { describe, expect, it } from 'vitest'
import { latexToUnicode } from './latex-unicode'

describe('LaTeX → Unicode 纯文本转换', () => {
  it('分数', () => {
    expect(latexToUnicode('\\frac{a}{b}')).toBe('(a)/(b)')
    expect(latexToUnicode('\\frac{a+b}{c}')).toBe('(a+b)/(c)')
    expect(latexToUnicode('\\dfrac{1}{2}')).toBe('(1)/(2)')
  })

  it('上下标', () => {
    expect(latexToUnicode('x^{2}')).toBe('x²')
    expect(latexToUnicode('x^2')).toBe('x²')
    expect(latexToUnicode('a_{n}')).toBe('aₙ')
    expect(latexToUnicode('a_n')).toBe('aₙ')
    expect(latexToUnicode('10^{-3}')).toBe('10⁻³')
    // 字母上标尽量映射为 Unicode
    expect(latexToUnicode('x^{abc}')).toBe('xᵃᵇᶜ')
    // 完全无法映射的字符回退为可读形式
    expect(latexToUnicode('x^{W}')).toBe('x^(W)')
  })

  it('根号', () => {
    expect(latexToUnicode('\\sqrt{2}')).toBe('√(2)')
    expect(latexToUnicode('\\sqrt{x+1}')).toBe('√(x+1)')
    expect(latexToUnicode('\\sqrt[3]{x}')).toBe('3次根号(x)')
  })

  it('希腊字母与运算符', () => {
    expect(latexToUnicode('\\pi')).toBe('π')
    expect(latexToUnicode('\\alpha\\beta')).toBe('αβ')
    expect(latexToUnicode('\\Delta')).toBe('Δ')
    expect(latexToUnicode('a \\times b')).toBe('a × b')
    expect(latexToUnicode('a \\neq b')).toBe('a ≠ b')
    expect(latexToUnicode('\\infty')).toBe('∞')
  })

  it('三角恒等式整句', () => {
    expect(latexToUnicode('\\sin^2\\alpha + \\cos^2\\alpha = 1')).toBe(
      'sin²α + cos²α = 1'
    )
  })

  it('求和与积分上下限', () => {
    expect(latexToUnicode('\\sum_{i=1}^{n}')).toBe('∑ᵢ₌₁ⁿ')
    expect(latexToUnicode('\\int_{a}^{b}')).toBe('∫ₐᵇ')
  })

  it('矩阵退化为可读文本', () => {
    const out = latexToUnicode(
      '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'
    )
    expect(out).toContain('a')
    expect(out).toContain('d')
    expect(out).not.toContain('pmatrix')
  })

  it('求根公式完整转换', () => {
    const out = latexToUnicode('x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}')
    expect(out).toContain('±')
    expect(out).toContain('√(')
    expect(out).toContain('-b')
  })
})
