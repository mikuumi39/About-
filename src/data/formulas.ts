/** 高中数学常用公式库 */

export interface FormulaItem {
  name: string
  latex: string
  note?: string
}

export interface FormulaCategory {
  id: string
  label: string
  items: FormulaItem[]
}

export const FORMULA_LIBRARY: FormulaCategory[] = [
  {
    id: 'seq',
    label: '数列',
    items: [
      { name: '等差数列通项', latex: 'a_n = a_1 + (n-1)d' },
      { name: '等差数列求和', latex: 'S_n = \\frac{n(a_1 + a_n)}{2}' },
      { name: '等差中项', latex: '2b = a + c' },
      { name: '等比数列通项', latex: 'a_n = a_1 q^{\\,n-1}' },
      { name: '等比数列求和', latex: 'S_n = \\frac{a_1(1 - q^n)}{1 - q} \\quad (q \\neq 1)', note: 'q = 1 时 Sₙ = n·a₁' },
      { name: '裂项相消', latex: '\\frac{1}{n(n+1)} = \\frac{1}{n} - \\frac{1}{n+1}' },
    ],
  },
  {
    id: 'trig',
    label: '三角函数',
    items: [
      { name: '同角平方关系', latex: '\\sin^2\\alpha + \\cos^2\\alpha = 1' },
      { name: '商数关系', latex: '\\tan\\alpha = \\frac{\\sin\\alpha}{\\cos\\alpha}' },
      { name: '和角公式', latex: '\\sin(\\alpha \\pm \\beta) = \\sin\\alpha\\cos\\beta \\pm \\cos\\alpha\\sin\\beta' },
      { name: '二倍角', latex: '\\sin 2\\alpha = 2\\sin\\alpha\\cos\\alpha' },
      { name: '余弦二倍角', latex: '\\cos 2\\alpha = \\cos^2\\alpha - \\sin^2\\alpha = 2\\cos^2\\alpha - 1' },
      { name: '正弦定理', latex: '\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C} = 2R' },
      { name: '余弦定理', latex: 'a^2 = b^2 + c^2 - 2bc\\cos A' },
      { name: '三角形面积', latex: 'S = \\frac{1}{2}ab\\sin C' },
    ],
  },
  {
    id: 'vector',
    label: '向量',
    items: [
      { name: '数量积定义', latex: '\\vec{a} \\cdot \\vec{b} = |\\vec{a}|\\,|\\vec{b}|\\cos\\theta' },
      { name: '坐标数量积', latex: '\\vec{a} \\cdot \\vec{b} = x_1 x_2 + y_1 y_2' },
      { name: '向量的模', latex: '|\\vec{a}| = \\sqrt{x^2 + y^2}' },
      { name: '夹角公式', latex: '\\cos\\theta = \\frac{\\vec{a} \\cdot \\vec{b}}{|\\vec{a}|\\,|\\vec{b}|}' },
      { name: '共线（平行）', latex: '\\vec{a} \\parallel \\vec{b} \\iff x_1 y_2 - x_2 y_1 = 0' },
      { name: '垂直条件', latex: '\\vec{a} \\perp \\vec{b} \\iff \\vec{a} \\cdot \\vec{b} = 0' },
    ],
  },
  {
    id: 'deriv',
    label: '导数',
    items: [
      { name: '幂函数导数', latex: "(x^n)' = nx^{\\,n-1}" },
      { name: '三角与指数', latex: "(\\sin x)' = \\cos x,\\quad (\\cos x)' = -\\sin x,\\quad (e^x)' = e^x" },
      { name: '对数导数', latex: "(\\ln x)' = \\frac{1}{x},\\quad (\\log_a x)' = \\frac{1}{x\\ln a}" },
      { name: '四则运算法则', latex: "(uv)' = u'v + uv',\\quad \\left(\\frac{u}{v}\\right)' = \\frac{u'v - uv'}{v^2}" },
      { name: '复合函数链式', latex: "[f(g(x))]' = f'(g(x)) \\cdot g'(x)" },
      { name: '切线方程', latex: 'y - f(x_0) = f\'(x_0)(x - x_0)' },
    ],
  },
  {
    id: 'conic',
    label: '圆锥曲线',
    items: [
      { name: '椭圆标准方程', latex: '\\frac{x^2}{a^2} + \\frac{y^2}{b^2} = 1 \\quad (a > b > 0)' },
      { name: '椭圆离心率', latex: 'e = \\frac{c}{a},\\quad c^2 = a^2 - b^2' },
      { name: '双曲线标准方程', latex: '\\frac{x^2}{a^2} - \\frac{y^2}{b^2} = 1' },
      { name: '双曲线离心率', latex: 'e = \\frac{c}{a},\\quad c^2 = a^2 + b^2' },
      { name: '抛物线', latex: 'y^2 = 2px \\; (p > 0),\\quad \\text{焦点 } \\left(\\frac{p}{2}, 0\\right)', note: '准线 x = −p/2' },
    ],
  },
  {
    id: 'line-circle',
    label: '直线与圆',
    items: [
      { name: '点斜式', latex: 'y - y_0 = k(x - x_0)' },
      { name: '两点间距离', latex: 'd = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}' },
      { name: '点到直线距离', latex: 'd = \\frac{|Ax_0 + By_0 + C|}{\\sqrt{A^2 + B^2}}' },
      { name: '两平行线间距离', latex: 'd = \\frac{|C_1 - C_2|}{\\sqrt{A^2 + B^2}}' },
      { name: '圆的标准方程', latex: '(x-a)^2 + (y-b)^2 = r^2' },
      { name: '直线与圆相交弦长', latex: '|AB| = 2\\sqrt{r^2 - d^2}' },
    ],
  },
  {
    id: 'misc',
    label: '其他重要',
    items: [
      { name: '均值不等式', latex: 'a + b \\geq 2\\sqrt{ab} \\quad (a, b > 0)' },
      { name: '一元二次求根公式', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}', note: '判别式 Δ = b² − 4ac' },
      { name: '韦达定理', latex: 'x_1 + x_2 = -\\frac{b}{a},\\quad x_1 x_2 = \\frac{c}{a}' },
      { name: '二项式定理通项', latex: 'T_{k+1} = \\binom{n}{k} a^{\\,n-k} b^{\\,k}' },
      { name: '复数模', latex: '|z| = |a + bi| = \\sqrt{a^2 + b^2}' },
      { name: '方差', latex: 's^2 = \\frac{1}{n}\\sum_{i=1}^{n}(x_i - \\bar{x})^2' },
      { name: '古典概型', latex: 'P(A) = \\frac{m}{n}' },
      { name: '独立事件乘法', latex: 'P(AB) = P(A)\\,P(B)' },
    ],
  },
]
