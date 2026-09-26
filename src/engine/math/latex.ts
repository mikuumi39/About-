/**
 * 把数学 AST 转成 KaTeX/LaTeX 字符串，用于公式美化渲染。
 * 例如 (a+b)/c → \frac{a+b}{c}，√(x+1) → \sqrt{x+1}
 */
import type { BinOp, Node } from './ast'

const PREC: Record<BinOp, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 }

function prec(n: Node): number {
  switch (n.t) {
    case 'bin':
      return PREC[n.op]
    case 'un':
      return 4 // 与 ^ 同级偏上：-(a+b) 需要括号由调用方判断
    default:
      return 10 // 原子
  }
}

function wrap(latex: string, childPrec: number, need: number): string {
  return childPrec < need ? `\\left(${latex}\\right)` : latex
}

const CALL_NAMES: Record<string, string> = {
  sin: '\\sin',
  cos: '\\cos',
  tan: '\\tan',
  asin: '\\arcsin',
  acos: '\\arccos',
  atan: '\\arctan',
  sinh: '\\sinh',
  cosh: '\\cosh',
  tanh: '\\tanh',
  ln: '\\ln',
  log: '\\log',
  sqrt: '\\sqrt',
  cbrt: '',
}

function callLatex(fn: string, argLatex: string): string {
  if (fn === 'sqrt') return `\\sqrt{${argLatex}}`
  if (fn === 'cbrt') return `\\sqrt[3]{${argLatex}}`
  const name = CALL_NAMES[fn]
  if (name !== undefined && name !== '') return `${name}\\left(${argLatex}\\right)`
  if (name === '') return `${argLatex}` // 未映射函数退化为裸参数
  return `\\operatorname{${fn}}\\left(${argLatex}\\right)`
}

function binLatex(op: BinOp, l: Node, r: Node, pos: number): string {
  void pos
  switch (op) {
    case '/':
      return `\\frac{${nodeToLatex(l)}}{${nodeToLatex(r)}}`
    case '^': {
      const ls = wrap(nodeToLatex(l), prec(l), 4)
      return `${ls}^{${nodeToLatex(r)}}`
    }
    case '*': {
      const ls = wrap(nodeToLatex(l), prec(l), PREC['*'])
      const rs = wrap(nodeToLatex(r), prec(r), PREC['*'] + 1)
      // 数字×数字、或一侧以数字结尾时用 \cdot；变量紧邻可省略点
      const lAtomicNum = l.t === 'num'
      const rStartsDigit = r.t === 'num'
      const sep = lAtomicNum || rStartsDigit ? ' \\cdot ' : ''
      return `${ls}${sep}${rs}`
    }
    case '+':
      return `${wrap(nodeToLatex(l), prec(l), PREC['+'])} + ${wrap(
        nodeToLatex(r),
        prec(r),
        PREC['+'] + 1
      )}`
    case '-':
      return `${wrap(nodeToLatex(l), prec(l), PREC['-'])} - ${wrap(
        nodeToLatex(r),
        prec(r),
        PREC['-'] + 1
      )}`
  }
}

export function nodeToLatex(n: Node): string {
  switch (n.t) {
    case 'num': {
      // 科学计数法转 LaTeX
      const ei = n.raw.search(/[eE]/)
      if (ei < 0) return n.raw
      const mant = n.raw.slice(0, ei)
      const exp = n.raw
        .slice(ei + 1)
        .replace('+', '')
        .replace('-', '−')
      return `${mant} \\times 10^{${exp.replace('−', '-')}}`
    }
    case 'var':
      return n.name
    case 'const':
      return n.name === 'pi' ? '\\pi' : 'e'
    case 'call': {
      if (n.fn === 'abs') return `\\left|${nodeToLatex(n.args[0])}\\right|`
      if (n.fn === 'gcd' || n.fn === 'lcm' || n.fn === 'max' || n.fn === 'min') {
        return `\\operatorname{${n.fn}}\\left(${n.args.map(nodeToLatex).join(',')}\\right)`
      }
      if (n.fn === 'ncr')
        return `\\binom{${nodeToLatex(n.args[0])}}{${nodeToLatex(n.args[1])}}`
      if (n.fn === 'npr')
        return `A\\left(${nodeToLatex(n.args[0])},${nodeToLatex(n.args[1])}\\right)`
      return callLatex(n.fn, nodeToLatex(n.args[0]))
    }
    case 'un': {
      const inner = wrap(nodeToLatex(n.arg), prec(n.arg), 5)
      return `-${inner}`
    }
    case 'bin':
      return binLatex(n.op, n.l, n.r, n.pos)
    case 'fact':
      return `${wrap(nodeToLatex(n.arg), prec(n.arg), 10)}!`
    case 'pct':
      return `${wrap(nodeToLatex(n.arg), prec(n.arg), 10)}\\%`
    case 'deg':
      return `${wrap(nodeToLatex(n.arg), prec(n.arg), 10)}^{\\circ}`
  }
}

/** 完整输入串的 LaTeX（含等式） */
export function inputToLatex(input: string, parse: (s: string) => Node): string | null {
  try {
    const parts = input.split('=')
    if (parts.length === 2) {
      return `${nodeToLatex(parse(parts[0]))} = ${nodeToLatex(parse(parts[1]))}`
    }
    if (parts.length > 2) return null
    return nodeToLatex(parse(input))
  } catch {
    return null
  }
}
