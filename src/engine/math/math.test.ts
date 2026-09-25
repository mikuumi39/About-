import { describe, expect, it } from 'vitest'
import { compute } from './index'
import { CalcError } from './errors'
import { evaluate } from './eval'

const DEG = { angle: 'deg' as const, places: 9 }

function value(input: string) {
  return compute(input, DEG)
}

function mainOf(input: string): string {
  const o = compute(input, DEG)
  if (o.kind !== 'value') throw new Error('expected value outcome')
  return o.display.main
}

function exactOf(input: string): string | undefined {
  const o = compute(input, DEG)
  if (o.kind !== 'value') throw new Error('expected value outcome')
  return o.display.exact
}

describe('基础四则运算', () => {
  it('整数四则', () => {
    expect(mainOf('1+1')).toBe('2')
    expect(mainOf('2×3')).toBe('6')
    expect(mainOf('7-3*2')).toBe('1')
    expect(mainOf('(2+3)*4')).toBe('20')
    expect(mainOf('100/8')).toBe('12.5')
  })

  it('优先级与括号', () => {
    expect(mainOf('2+3*4')).toBe('14')
    expect(mainOf('-3^2')).toBe('-9')
    expect(mainOf('(-3)^2')).toBe('9')
    expect(mainOf('2^3^2')).toBe('512')
  })

  it('小数精确', () => {
    expect(mainOf('0.1+0.2')).toBe('0.3') // 有理数精确，无浮点噪声
  })

  it('百分号', () => {
    expect(mainOf('50%')).toBe('0.5')
    expect(mainOf('200+10%')).toBe('200.1')
  })
})

describe('分数与精确形式', () => {
  it('1/2+1/3 = 5/6', () => {
    const o = value('1/2+1/3')
    expect(o.kind === 'value' && o.display.main).toBe('0.833333333')
    expect(exactOf('1/2+1/3')).toBe('5/6')
  })

  it('约分', () => {
    expect(exactOf('4/8')).toBe('1/2')
    expect(mainOf('4/8')).toBe('0.5')
  })

  it('负数除法', () => {
    expect(exactOf('-6/4')).toBe('-3/2')
  })
})

describe('根号与幂', () => {
  it('完全平方开方', () => {
    expect(mainOf('√25')).toBe('5')
    expect(mainOf('sqrt(9/16)')).toBe('0.75')
    expect(exactOf('sqrt(9/16)')).toBe('3/4')
  })

  it('非完全平方保留根式', () => {
    expect(exactOf('√2')).toBe('√2')
    const m = mainOf('√2')
    expect(m).toBe('1.414213562')
  })

  it('幂运算', () => {
    expect(mainOf('2^10')).toBe('1024')
    expect(mainOf('4^(1/2)')).toBe('2')
    expect(mainOf('27^(1/3)')).toBe('3')
    expect(mainOf('2^-3')).toBe('0.125')
  })

  it('立方根', () => {
    expect(mainOf('cbrt(-27)')).toBe('-3')
  })
})

describe('科学计数法与常量', () => {
  it('字面量 e 记号', () => {
    expect(mainOf('1.5e3')).toBe('1500')
    expect(mainOf('2e-2')).toBe('0.02')
  })

  it('π 与 e', () => {
    expect(mainOf('pi*2')).toBe('6.283185307')
    expect(mainOf('e')).toBe('2.718281828')
  })
})

describe('对数', () => {
  it('常用对数精确值', () => {
    expect(mainOf('log(100)')).toBe('2')
    expect(mainOf('lg(1000)')).toBe('3')
    expect(mainOf('log(0.1)')).toBe('-1')
  })

  it('自然对数', () => {
    const m = mainOf('ln(e)')
    expect(Number(m)).toBeCloseTo(1, 8)
    expect(mainOf('ln(1)')).toBe('0')
  })

  it('定义域报错', () => {
    expect(() => value('ln(0)')).toThrow(CalcError)
    expect(() => value('log(-4)')).toThrow(/大于 0/)
  })
})

describe('三角函数（度模式）', () => {
  it('特殊角精确值', () => {
    expect(mainOf('sin(30°)')).toBe('0.5')
    expect(exactOf('sin(30°)')).toBe('1/2')
    expect(mainOf('cos(60°)')).toBe('0.5')
    expect(mainOf('tan(45°)')).toBe('1')
    expect(mainOf('sin(90°)')).toBe('1')
    expect(mainOf('cos(180°)')).toBe('-1')
  })

  it('裸参数按度理解', () => {
    expect(mainOf('sin(30)')).toBe('0.5')
    expect(mainOf('cos(60)')).toBe('0.5')
  })

  it('根式特殊角', () => {
    expect(exactOf('sin(45°)')).toBe('√2/2')
    expect(exactOf('tan(60°)')).toBe('√3')
    expect(exactOf('sin(210°)')).toBe('-1/2')
  })

  it('无括号调用', () => {
    expect(mainOf('sin30°')).toBe('0.5')
    expect(mainOf('tan45°')).toBe('1')
  })

  it('未定义点报错', () => {
    expect(() => value('tan(90°)')).toThrow(/没有定义/)
  })

  it('弧度模式', () => {
    expect(evaluate('sin(pi/2)', 'rad').tag === 'num' ? true : false).toBe(true)
    const v = evaluate('sin(pi/2)', 'rad')
    expect(v.tag === 'num' && v.x).toBeCloseTo(1, 12)
  })
})

describe('反三角函数', () => {
  it('度模式输出角度', () => {
    expect(mainOf('asin(0.5)')).toBe('30')
    expect(mainOf('acos(0.5)')).toBe('60')
    expect(mainOf('atan(1)')).toBe('45')
  })
})

describe('阶乘 / 排列 / 组合', () => {
  it('阶乘', () => {
    expect(mainOf('5!')).toBe('120')
    expect(mainOf('0!')).toBe('1')
  })

  it('组合与排列', () => {
    expect(mainOf('ncr(5,2)')).toBe('10')
    expect(mainOf('npr(5,2)')).toBe('20')
  })
})

describe('复数', () => {
  it('虚数单位', () => {
    expect(mainOf('sqrt(-1)')).toBe('i')
    expect(mainOf('sqrt(-4)')).toBe('2i')
  })

  it('复数运算', () => {
    expect(mainOf('(1+i)*(1-i)')).toBe('2')
    expect(mainOf('i^2')).toBe('-1')
  })
})

describe('隐式乘法', () => {
  it('常见形式', () => {
    expect(mainOf('3(4+5)')).toBe('27')
    expect(mainOf('2sin(30°)')).toBe('1')
    expect(mainOf('2√9')).toBe('6')
    expect(mainOf('2π')).toBe('6.283185307')
  })
})

describe('错误处理与定位', () => {
  it('除零', () => {
    let msg = ''
    try {
      value('1/0')
    } catch (e) {
      msg = (e as Error).message
    }
    expect(msg).toContain('除数不能为 0')
  })

  it('缺右括号', () => {
    expect(() => value('√(')).toThrow(CalcError)
    expect(() => value('(1+2')).toThrow(CalcError)
    expect(() => value('sin(30°')).toThrow(CalcError)
  })

  it('不完整表达式', () => {
    expect(() => value('1+')).toThrow(CalcError)
    expect(() => value('√')).toThrow(CalcError)
  })

  it('未知变量提示解方程', () => {
    expect(() => value('2x+1')).toThrow(/未知量|方程/)
  })
})

describe('方程求解', () => {
  function solveRows(input: string) {
    const o = compute(input, DEG)
    if (o.kind !== 'solve') throw new Error('expected solve outcome')
    return o
  }

  it('一元一次', () => {
    const o = solveRows('2x+3=7')
    expect(o.rows[0].main).toBe('2')
  })

  it('一元二次（完全平方判别式）', () => {
    const o = solveRows('x^2-5x+6=0')
    expect(o.rows.map((r) => r.main)).toEqual(['3', '2'])
  })

  it('一元二次（根式解）', () => {
    const o = solveRows('x^2-2=0')
    expect(o.rows[0].exact).toBe('2√2')
    expect(o.rows[1].exact).toBe('-2√2')
  })

  it('无实数解给出复根说明', () => {
    const o = solveRows('x^2+x+1=0')
    expect(o.note).toContain('Δ < 0')
    expect(o.rows.length).toBe(2)
  })

  it('恒等式与矛盾式', () => {
    const o1 = solveRows('2x=x+x')
    expect(o1.note).toContain('恒等式')
    const o2 = solveRows('x=x+1')
    expect(o2.note).toContain('无解')
  })

  it('线性方程组', () => {
    const o = solveRows('x+y=3, x-y=1')
    expect(o.rows[0].label.startsWith('x')).toBe(true)
    expect(o.rows[0].main).toBe('2')
    expect(o.rows[1].main).toBe('1')
  })

  it('三次方程数值解', () => {
    const o = solveRows('x^3-8=0')
    expect(o.rows.length).toBeGreaterThanOrEqual(1)
    expect(o.rows[0].main).toBe('2')
    expect(o.note).toContain('近似')
  })

  it('超越方程数值解', () => {
    const o = compute('cos(x)=x', { angle: 'rad', places: 9 })
    if (o.kind !== 'solve') throw new Error('expected solve outcome')
    expect(o.rows.length).toBe(1)
    const x = Number(o.rows[0].main)
    expect(x).toBeGreaterThan(0.73)
    expect(x).toBeLessThan(0.74)
  })
})
