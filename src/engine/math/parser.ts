/**
 * 语法分析（Pratt 风格递归下降）。
 *
 * 优先级从低到高：+−  →  ×÷（含隐式乘法）→ 一元 ±  → ^（右结合）→ 后缀 ! % °
 * 注意：-3² = -9（一元负号低于幂），√ 的参数按一元层解析。
 */
import type { Node } from './ast'
import { CalcError } from './errors'
import { tokenize, type Tok } from './lexer'

export const FUNCTIONS: Record<string, { arity: number | 'variadic'; desc: string }> = {
  sin: { arity: 1, desc: '正弦' },
  cos: { arity: 1, desc: '余弦' },
  tan: { arity: 1, desc: '正切' },
  asin: { arity: 1, desc: '反正弦' },
  acos: { arity: 1, desc: '反余弦' },
  atan: { arity: 1, desc: '反正切' },
  arcsin: { arity: 1, desc: '反正弦' },
  arccos: { arity: 1, desc: '反余弦' },
  arctan: { arity: 1, desc: '反正切' },
  sinh: { arity: 1, desc: '双曲正弦' },
  cosh: { arity: 1, desc: '双曲余弦' },
  tanh: { arity: 1, desc: '双曲正切' },
  ln: { arity: 1, desc: '自然对数' },
  log: { arity: 1, desc: '常用对数（以 10 为底）' },
  sqrt: { arity: 1, desc: '平方根' },
  cbrt: { arity: 1, desc: '立方根' },
  abs: { arity: 1, desc: '绝对值' },
  exp: { arity: 1, desc: 'e 的幂' },
  floor: { arity: 1, desc: '向下取整' },
  ceil: { arity: 1, desc: '向上取整' },
  round: { arity: 1, desc: '四舍五入' },
  sign: { arity: 1, desc: '符号函数' },
  gcd: { arity: 'variadic', desc: '最大公约数' },
  lcm: { arity: 'variadic', desc: '最小公倍数' },
  max: { arity: 'variadic', desc: '最大值' },
  min: { arity: 'variadic', desc: '最小值' },
  ncr: { arity: 2, desc: '组合数 C(n,r)' },
  npr: { arity: 2, desc: '排列数 A(n,r)' },
}

/** 归一化函数名别名 */
const FN_ALIAS: Record<string, string> = {
  arcsin: 'asin',
  arccos: 'acos',
  arctan: 'atan',
  lg: 'log',
}

export const CONSTANTS = new Set(['pi', 'e'])

class Parser {
  private toks: Tok[]
  private idx = 0

  constructor(input: string) {
    this.toks = tokenize(input)
  }

  private peek(): Tok | undefined {
    return this.toks[this.idx]
  }

  private next(): Tok | undefined {
    return this.toks[this.idx++]
  }

  parse(): Node {
    if (this.toks.length === 0) {
      throw new CalcError('还没有输入任何内容')
    }
    const n = this.parseAdditive()
    const rest = this.peek()
    if (rest !== undefined) {
      throw new CalcError(`「${describeTok(rest)}」出现在了不该出现的位置`, rest.pos)
    }
    return n
  }

  private parseAdditive(): Node {
    let l = this.parseMul()
    for (;;) {
      const t = this.peek()
      if (t !== undefined && t.type === 'op' && (t.value === '+' || t.value === '-')) {
        this.next()
        const r = this.parseMul()
        l = { t: 'bin', op: t.value as '+' | '-', l, r, pos: t.pos }
      } else {
        return l
      }
    }
  }

  private startsFactor(t: Tok): boolean {
    return (
      t.type === 'num' ||
      t.type === 'ident' ||
      t.type === 'lparen' ||
      t.type === 'sqrt'
    )
  }

  private parseMul(): Node {
    let l = this.parseUnary()
    for (;;) {
      const t = this.peek()
      if (t !== undefined && t.type === 'op' && (t.value === '*' || t.value === '/')) {
        this.next()
        const r = this.parseUnary()
        l = { t: 'bin', op: t.value as '*' | '/', l, r, pos: t.pos }
      } else if (t !== undefined && this.startsFactor(t)) {
        // 隐式乘法：2π、3(4+5)、2sin(30°)、2x
        const r = this.parseUnary()
        l = { t: 'bin', op: '*', l, r, pos: t.pos }
      } else {
        return l
      }
    }
  }

  private parseUnary(): Node {
    const t = this.peek()
    if (t !== undefined && t.type === 'op' && (t.value === '-' || t.value === '+')) {
      this.next()
      const arg = this.parseUnary()
      return t.value === '-' ? { t: 'un', op: '-', arg, pos: t.pos } : arg
    }
    return this.parsePower()
  }

  private parsePower(): Node {
    const base = this.parsePostfix()
    const t = this.peek()
    if (t !== undefined && t.type === 'op' && t.value === '^') {
      this.next()
      // 右结合，指数允许一元负号：2^-3
      const exp = this.parseUnary()
      return { t: 'bin', op: '^', l: base, r: exp, pos: t.pos }
    }
    return base
  }

  private parsePostfix(): Node {
    let n = this.parsePrimary()
    for (;;) {
      const t = this.peek()
      if (t === undefined) return n
      if (t.type === 'bang') {
        this.next()
        n = { t: 'fact', arg: n, pos: t.pos }
      } else if (t.type === 'percent') {
        this.next()
        n = { t: 'pct', arg: n, pos: t.pos }
      } else if (t.type === 'deg') {
        this.next()
        n = { t: 'deg', arg: n, pos: t.pos }
      } else {
        return n
      }
    }
  }

  private parseArgs(fnName: string, fnPos: number): Node[] {
    const lp = this.peek()
    if (lp === undefined || lp.type !== 'lparen') {
      throw new CalcError(`${fnName} 后面需要用括号写参数，例如 ${fnName}(…)`, fnPos)
    }
    this.next()
    const args: Node[] = []
    if (this.peek()?.type === 'rparen') {
      this.next()
      return args
    }
    for (;;) {
      args.push(this.parseAdditive())
      const t = this.next()
      if (t === undefined) {
        throw new CalcError('缺少右括号，表达式没有写完', fnPos)
      }
      if (t.type === 'rparen') return args
      if (t.type !== 'comma') {
        throw new CalcError('参数之间需要用逗号分隔', t.pos)
      }
    }
  }

  /** 无括号函数调用：sin30、cos45°、ln100 */
  private tryBareArgument(): Node | null {
    const t = this.peek()
    if (t === undefined) return null
    if (t.type === 'num' || t.type === 'ident') {
      return this.parsePower()
    }
    if (t.type === 'sqrt') {
      return this.parsePower()
    }
    return null
  }

  private parsePrimary(): Node {
    const t = this.next()
    if (t === undefined) {
      throw new CalcError(
        this.idx > 0 ? '表达式在这里就结束了，可能缺少内容' : '请先输入内容',
        this.toks.length > 0 ? this.toks[this.toks.length - 1].pos : 0
      )
    }

    switch (t.type) {
      case 'num':
        return { t: 'num', raw: t.value, pos: t.pos }

      case 'sqrt': {
        const arg = this.parseUnary()
        return { t: 'call', fn: 'sqrt', args: [arg], pos: t.pos }
      }

      case 'lparen': {
        const inner = this.parseAdditive()
        const rp = this.next()
        if (rp === undefined || rp.type !== 'rparen') {
          throw new CalcError('这里缺少右括号 )', t.pos)
        }
        return inner
      }

      case 'ident': {
        const lower = t.value.toLowerCase()
        // 已知常量：π、e、虚数单位 i
        if (
          lower === 'pi' ||
          lower === 'i' ||
          (lower === 'e' && FUNCTIONS[t.value] === undefined && FUNCTIONS[lower] === undefined)
        ) {
          return { t: 'const', name: lower as 'pi' | 'e' | 'i', pos: t.pos }
        }
        // 已知函数
        const canonical =
          FUNCTIONS[t.value] !== undefined ? t.value : FN_ALIAS[lower] ?? FN_ALIAS[t.value]
        if (canonical !== undefined && FUNCTIONS[canonical] !== undefined) {
          const nt = this.peek()
          if (nt !== undefined && nt.type === 'lparen') {
            const args = this.parseArgs(canonical, t.pos)
            checkArity(canonical, args, t.pos)
            return { t: 'call', fn: canonical, args, pos: t.pos }
          }
          // 无括号调用：取一个紧随的因子
          const bare = this.tryBareArgument()
          if (bare !== null) {
            return { t: 'call', fn: canonical, args: [bare], pos: t.pos }
          }
          throw new CalcError(`${t.value} 后面需要跟参数，例如 ${t.value}(30°)`, t.pos)
        }
        // 未知多字母串：拆成单字母变量乘积 xy → x·y
        if (/^[a-zA-Z]{2,}$/.test(t.value)) {
          let node: Node = { t: 'var', name: t.value[0], pos: t.pos }
          for (let k = 1; k < t.value.length; k++) {
            node = {
              t: 'bin',
              op: '*',
              l: node,
              r: { t: 'var', name: t.value[k], pos: t.pos + k },
              pos: t.pos,
            }
          }
          return node
        }
        // 单字母变量（大小写敏感）
        return { t: 'var', name: t.value, pos: t.pos }
      }

      case 'op': {
        if (t.value === '-') {
          const arg = this.parseUnary()
          return { t: 'un', op: '-', arg, pos: t.pos }
        }
        if (t.value === '+') {
          return this.parseUnary()
        }
        throw new CalcError(`「${t.value}」不能出现在这里`, t.pos)
      }

      default:
        throw new CalcError(`「${describeTok(t)}」不能出现在这里`, t.pos)
    }
  }
}

function checkArity(fn: string, args: Node[], pos: number): void {
  const spec = FUNCTIONS[fn]
  if (spec.arity === 'variadic') {
    if (args.length < 1) {
      throw new CalcError(`${fn} 至少需要一个参数`, pos)
    }
    return
  }
  if (args.length !== spec.arity) {
    throw new CalcError(
      `${fn} 需要 ${spec.arity} 个参数，但写出了 ${args.length} 个`,
      pos
    )
  }
}

function describeTok(t: Tok): string {
  switch (t.type) {
    case 'num':
      return t.value
    case 'ident':
      return t.value
    default:
      return t.value
  }
}

export function parseExpression(input: string): Node {
  return new Parser(input).parse()
}
