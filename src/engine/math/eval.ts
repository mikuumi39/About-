/**
 * 求值：AST → Val。
 * 角度约定（与教程一致）：
 * - 「度」模式下，三角函数的普通参数按「度」理解；
 * - 无论什么模式，显式写 ° 的参数一律按「度」；
 * - 反三角函数的返回值跟随当前模式。
 */
import type { Node } from './ast'
import { CalcError } from './errors'
import {
  mkRat,
  rAdd,
  rDiv,
  rMul,
  rSub,
  rAbs,
  rCmp,
  ratFromDecimal,
  rIsInt,
  rIsZero,
  type Rat,
} from './rational'
import { parseExpression } from './parser'
import {
  vAdd,
  vCombination,
  vDiv,
  vFactorial,
  vInt,
  vMul,
  vNeg,
  vNum,
  vPermutation,
  vPow,
  vSign,
  vSqrt,
  vSub,
  vCbrt,
  vGcd,
  vLcm,
  vIsZero,
  vSurd,
  toNum,
  type AngleMode,
  type Val,
} from './value'

const PI_NUM = Math.PI

function degToRad(v: Val): Val {
  if (vIsZero(v)) return vInt(0)
  return vNum((toNum(v) * PI_NUM) / 180)
}

/** 度数（有理数）的 sin/cos 精确值；无法精确时返回 null */
function exactSinCos(fn: 'sin' | 'cos', deg: Rat): Val | null {
  const period = { n: 360n, d: 1n }
  let t = deg
  while (rCmp(t, { n: 0n, d: 1n }) < 0) t = rAdd(t, period)
  while (rCmp(t, period) >= 0) t = rSub(t, period)
  // 只处理整数度且可精确表示的特殊角（0,30,45,60,90 及其镜像）
  if (!rIsInt(t)) return null
  const m = Number(t.n) % 360
  const mm = m % 180
  const beta = Math.min(mm, 180 - mm)
  const half: Rat = mkRat(1n, 2n)
  if (fn === 'sin') {
    let base: Val
    switch (beta) {
      case 0:
        base = vInt(0)
        break
      case 30:
        base = { tag: 'rat', r: half }
        break
      case 45:
        base = vSurd(half, 2n)
        break
      case 60:
        base = vSurd(half, 3n)
        break
      case 90:
        base = vInt(1)
        break
      default:
        return null
    }
    // sin：一、二象限为正
    const sign = Math.floor(m / 90) <= 1 ? 1 : -1
    return sign < 0 ? vNeg(base) : base
  }
  // cos：一、四象限为正；余弦表与正弦表互补
  let base: Val
  switch (beta) {
    case 0:
      base = vInt(1)
      break
    case 30:
      base = vSurd(half, 3n)
      break
    case 45:
      base = vSurd(half, 2n)
      break
    case 60:
      base = { tag: 'rat', r: half }
      break
    case 90:
      base = vInt(0)
      break
    default:
      return null
  }
  const quad = Math.floor(m / 90)
  const sign = quad === 1 || quad === 2 ? -1 : 1
  return sign < 0 ? vNeg(base) : base
}

/** 度数（有理数）的 tan 精确值；null = 无法精确；抛错 = 未定义 */
function exactTan(deg: Rat): Val | null {
  const period = { n: 180n, d: 1n }
  let t = deg
  while (rCmp(t, { n: 0n, d: 1n }) < 0) t = rAdd(t, period)
  while (rCmp(t, period) >= 0) t = rSub(t, period)
  if (!rIsInt(t)) return null
  const m = Number(t.n) // [0,180)
  if (m === 90) throw new CalcError('正切 tan 在 90° 处没有定义')
  const beta = Math.min(m, 180 - m)
  const sign = m > 90 ? -1 : 1
  let base: Val
  if (beta === 0) base = vInt(0)
  else if (beta === 45) base = vInt(1)
  else if (beta === 30) base = vSurd(mkRat(1n, 3n), 3n)
  else if (beta === 60) base = vSurd(mkRat(1n, 1n), 3n)
  else return null
  return sign < 0 ? vNeg(base) : base
}

const TRIG_IN = new Set(['sin', 'cos', 'tan'])
const TRIG_OUT = new Set(['asin', 'acos', 'atan'])

export interface EvalContext {
  angle: AngleMode
}

export function evalNode(n: Node, ctx: EvalContext): Val {
  switch (n.t) {
    case 'num':
      return evalNumberLiteral(n.raw)

    case 'const': {
      if (n.name === 'pi') return vNum(PI_NUM)
      if (n.name === 'i') return { tag: 'cpx', re: 0, im: 1 }
      return vNum(Math.E)
    }

    case 'var':
      throw new CalcError(
        `式子里有未知量「${n.name}」，计算需要具体的数字；要解方程请使用求解功能`,
        n.pos
      )

    case 'un': {
      const v = evalNode(n.arg, ctx)
      return vNeg(v)
    }

    case 'bin': {
      const l = evalNode(n.l, ctx)
      const r = evalNode(n.r, ctx)
      switch (n.op) {
        case '+':
          return vAdd(l, r)
        case '-':
          return vSub(l, r)
        case '*':
          return vMul(l, r)
        case '/':
          return vDiv(l, r)
        case '^':
          return vPow(l, r)
      }
      break
    }

    case 'fact':
      return vFactorial(evalNode(n.arg, ctx))

    case 'pct': {
      const v = evalNode(n.arg, ctx)
      if (v.tag === 'rat') return { tag: 'rat', r: rDiv(v.r, { n: 100n, d: 1n }) }
      return vNum(toNum(v) / 100)
    }

    case 'deg': {
      // 显式 °：无论模式，转为弧度数值
      return degToRad(evalNode(n.arg, ctx))
    }

    case 'call':
      return evalCall(n, ctx)
  }
  throw new CalcError('内部错误：未知的表达式节点')
}

/** 数字字面量（可能含科学计数法 e/E） */
function evalNumberLiteral(raw: string): Val {
  const ei = raw.search(/[eE]/)
  if (ei < 0) {
    try {
      return { tag: 'rat', r: ratFromDecimal(raw) }
    } catch {
      return vNum(Number(raw))
    }
  }
  const mant = raw.slice(0, ei)
  const exp = parseInt(raw.slice(ei + 1), 10)
  if (!Number.isFinite(exp) || Math.abs(exp) > 4096) {
    return vNum(Number(raw))
  }
  const mr = ratFromDecimal(mant)
  if (exp >= 0) {
    return { tag: 'rat', r: rMul(mr, { n: 10n ** BigInt(exp), d: 1n }) }
  }
  return { tag: 'rat', r: rMul(mr, { n: 1n, d: 10n ** BigInt(-exp) }) }
}

function evalCall(n: Extract<Node, { t: 'call' }>, ctx: EvalContext): Val {
  const fn = n.fn

  // ---- 三角函数（输入）----
  if (TRIG_IN.has(fn)) {
    let degVal: Rat | null = null // 能拿到「度」的有理数时走精确路径
    let x: Val
    const argAst = n.args[0]
    if (argAst.t === 'deg') {
      // 显式 °：内部值就是度数
      const inner = evalNode(argAst.arg, ctx)
      x = degToRad(inner)
      if (inner.tag === 'rat') degVal = inner.r
    } else if (ctx.angle === 'deg') {
      const inner = evalNode(argAst, ctx)
      x = degToRad(inner)
      if (inner.tag === 'rat') degVal = inner.r
    } else {
      x = evalNode(argAst, ctx)
    }
    if (degVal !== null) {
      if (fn === 'sin') {
        const ex = exactSinCos('sin', degVal)
        if (ex !== null) return ex
      }
      if (fn === 'cos') {
        const ex = exactSinCos('cos', degVal)
        if (ex !== null) return ex
      }
      if (fn === 'tan') {
        const ex = exactTan(degVal)
        if (ex !== null) return ex
      }
    }
    const xr = toNum(x)
    switch (fn) {
      case 'sin':
        return vNum(Math.abs(Math.sin(xr)) < 1e-14 ? 0 : Math.sin(xr))
      case 'cos': {
        const c = Math.cos(xr)
        return vNum(Math.abs(c) < 1e-14 ? 0 : c)
      }
      case 'tan': {
        const c = Math.cos(xr)
        if (Math.abs(c) < 1e-14) {
          throw new CalcError('正切在这里没有定义（余弦为 0，如 90°、270° 等）')
        }
        const s = Math.sin(xr)
        return vNum(Math.abs(s) < 1e-14 ? 0 : s / c)
      }
    }
  }

  // ---- 反三角（输出跟随模式）----
  if (TRIG_OUT.has(fn)) {
    const x = toNum(evalNode(n.args[0], ctx))
    let out: number
    switch (fn) {
      case 'asin':
        if (x < -1 || x > 1) {
          throw new CalcError('反正弦的定义域是 [-1, 1]，当前输入超出了范围')
        }
        out = Math.asin(x)
        break
      case 'acos':
        if (x < -1 || x > 1) {
          throw new CalcError('反余弦的定义域是 [-1, 1]，当前输入超出了范围')
        }
        out = Math.acos(x)
        break
      default:
        out = Math.atan(x)
    }
    return ctx.angle === 'deg' ? vNum((out * 180) / PI_NUM) : vNum(out)
  }

  // ---- 双曲函数 ----
  switch (fn) {
    case 'sinh':
      return vNum(Math.sinh(toNum(evalNode(n.args[0], ctx))))
    case 'cosh':
      return vNum(Math.cosh(toNum(evalNode(n.args[0], ctx))))
    case 'tanh':
      return vNum(Math.tanh(toNum(evalNode(n.args[0], ctx))))
  }

  // ---- 对数与指数 ----
  if (fn === 'ln' || fn === 'log') {
    const v = evalNode(n.args[0], ctx)
    if (v.tag === 'rat') {
      if (rIsZero(v.r)) throw new CalcError('对数的真数必须大于 0（不能对 0 求对数）')
      if (v.r.n < 0n) throw new CalcError('对数的真数必须大于 0（负数没有实数对数）')
      if (fn === 'log') {
        const k = log10Exact(v.r)
        if (k !== null) return vInt(k)
      }
    }
    const x = toNum(v)
    if (x <= 0) throw new CalcError('对数的真数必须大于 0')
    return vNum(fn === 'ln' ? Math.log(x) : Math.log10(x))
  }

  if (fn === 'exp') return vNum(Math.exp(toNum(evalNode(n.args[0], ctx))))

  // ---- 根式与绝对值 ----
  if (fn === 'sqrt') return vSqrt(evalNode(n.args[0], ctx))
  if (fn === 'cbrt') return vCbrt(evalNode(n.args[0], ctx))
  if (fn === 'abs') {
    const v = evalNode(n.args[0], ctx)
    switch (v.tag) {
      case 'rat':
        return { tag: 'rat', r: rAbs(v.r) }
      case 'surd':
        return { tag: 'surd', c: rAbs(v.c), k: v.k }
      case 'num':
        return vNum(Math.abs(v.x))
      case 'cpx':
        return vNum(Math.hypot(v.re, v.im))
    }
  }

  // ---- 取整 ----
  if (fn === 'floor') return vInt(Math.floor(toNum(evalNode(n.args[0], ctx))))
  if (fn === 'ceil') return vInt(Math.ceil(toNum(evalNode(n.args[0], ctx))))
  if (fn === 'round') return vInt(Math.round(toNum(evalNode(n.args[0], ctx))))
  if (fn === 'sign') return vSign(evalNode(n.args[0], ctx))

  // ---- 多参函数 ----
  if (fn === 'gcd' || fn === 'lcm') {
    let acc = evalNode(n.args[0], ctx)
    for (let i = 1; i < n.args.length; i++) {
      const b = evalNode(n.args[i], ctx)
      acc = fn === 'gcd' ? vGcd(acc, b) : vLcm(acc, b)
    }
    return acc
  }
  if (fn === 'max' || fn === 'min') {
    let best = evalNode(n.args[0], ctx)
    for (let i = 1; i < n.args.length; i++) {
      const cand = evalNode(n.args[i], ctx)
      const cmp = cmpVals(cand, best)
      if ((fn === 'max' && cmp > 0) || (fn === 'min' && cmp < 0)) best = cand
    }
    return best
  }
  if (fn === 'ncr') {
    return vCombination(evalNode(n.args[0], ctx), evalNode(n.args[1], ctx))
  }
  if (fn === 'npr') {
    return vPermutation(evalNode(n.args[0], ctx), evalNode(n.args[1], ctx))
  }

  throw new CalcError(`暂不支持的函数「${fn}」`)
}

function cmpVals(a: Val, b: Val): number {
  const x = toNum(a)
  const y = toNum(b)
  return x < y ? -1 : x > y ? 1 : 0
}

/** 10 的整数次幂 → 返回指数；否则 null */
function log10Exact(r: Rat): number | null {
  if (r.d === 1n) {
    const s = r.n.toString()
    return /^10*$/.test(s) ? s.length - 1 : null
  }
  const kn = /^10*$/.test(r.n.toString()) ? r.n.toString().length - 1 : null
  const kd = /^10*$/.test(r.d.toString()) ? r.d.toString().length - 1 : null
  if (kn === null || kd === null) return null
  return kn - kd
}

/** 对外主入口：计算一个表达式字符串 */
export function evaluate(input: string, angle: AngleMode): Val {
  return evalNode(parseExpression(input), { angle })
}
