/**
 * 方程与方程组求解。
 *
 * 可靠性原则：
 * - 一次 / 二次方程给精确解（分数与根式）
 * - 高次多项式用数值法并明确标注「近似」
 * - 非多项式方程用扫描 + 二分求根，明确标注可能遗漏
 * - 无法可靠处理的一律明确说明，绝不编造结果
 */
import { collectVars, type Node } from './ast'
import { CalcError } from './errors'
import { evalNode, type EvalContext } from './eval'
import { parseExpression } from './parser'
import {
  mkRat,
  rAdd,
  rCmp,
  rDiv,
  rIsInt,
  rIsZero,
  rMul,
  rNeg,
  rSub,
  ratToNumber,
  type Rat,
} from './rational'
import { formatVal } from './format'
import { toNum, type AngleMode, type Val } from './value'

export interface SolveRow {
  label: string
  main: string
  exact?: string
  plain: string
}

export interface SolveResult {
  rows: SolveRow[]
  note?: string
}

const MAX_DEG = 12

// ---------------- 基础多项式工具 ----------------

type Poly = Rat[] // 下标 = 次数；低次在前

function polyTrim(p: Poly): Poly {
  let d = p.length - 1
  while (d > 0 && rIsZero(p[d])) d--
  return p.slice(0, d + 1)
}

function polyAdd(a: Poly, b: Poly, sign: 1 | -1): Poly {
  const len = Math.max(a.length, b.length)
  const out: Poly = []
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? ZERO
    const y = b[i] ?? ZERO
    out.push(sign === 1 ? rAdd(x, y) : rSub(x, y))
  }
  return polyTrim(out)
}

function polyScale(a: Poly, k: Rat): Poly {
  return polyTrim(a.map((c) => rMul(c, k)))
}

const ZERO = mkRat(0n, 1n)

/** 常量子树的精确有理数值；不是常量或非有理时返回 null */
function constRat(n: Node, ctx: EvalContext): Rat | null {
  if (collectVars(n).size > 0) return null
  try {
    const v = evalNode(n, ctx)
    if (v.tag === 'rat') return v.r
    return null
  } catch {
    return null
  }
}

function polyMul(a: Poly, b: Poly): Poly | null {
  if (a.length + b.length - 2 > MAX_DEG) return null
  const out: Poly = Array.from({ length: a.length + b.length - 1 }, () => ZERO)
  a.forEach((ac, i) => {
    b.forEach((bc, j) => {
      out[i + j] = rAdd(out[i + j], rMul(ac, bc))
    })
  })
  return polyTrim(out)
}

/** 单变量整式多项式提取；无法表示为多项式时返回 null */
function polyOf(n: Node, varName: string, ctx: EvalContext): Poly | null {
  switch (n.t) {
    case 'num':
      return [{ ...numLiteralRat(n.raw) }]
    case 'var':
      return n.name === varName ? [ZERO, mkRat(1n, 1n)] : null
    case 'const':
      return null
    case 'un': {
      const p = polyOf(n.arg, varName, ctx)
      return p === null ? null : polyScale(p, mkRat(-1n, 1n))
    }
    case 'bin': {
      switch (n.op) {
        case '+':
        case '-': {
          const l = polyOf(n.l, varName, ctx)
          const r = polyOf(n.r, varName, ctx)
          if (l === null || r === null) return null
          return polyAdd(l, r, n.op === '+' ? 1 : -1)
        }
        case '*': {
          const l = polyOf(n.l, varName, ctx)
          const r = polyOf(n.r, varName, ctx)
          if (l === null || r === null) return null
          return polyMul(l, r)
        }
        case '/': {
          const l = polyOf(n.l, varName, ctx)
          if (l === null) return null
          const rc = constRat(n.r, ctx)
          if (rc === null || rIsZero(rc)) return null
          return polyScale(l, rDiv(mkRat(1n, 1n), rc))
        }
        case '^': {
          const base = polyOf(n.l, varName, ctx)
          if (base === null) return null
          const e = constRat(n.r, ctx)
          if (e === null || !rIsInt(e)) return null
          const k = Number(e.n)
          if (k < 0 || k > MAX_DEG) return null
          let acc: Poly = [mkRat(1n, 1n)]
          for (let i = 0; i < k; i++) {
            const next = polyMul(acc, base)
            if (next === null) return null
            acc = next
          }
          return acc
        }
      }
      return null
    }
    default: {
      // fact/pct/deg/call：含变量则放弃；纯常量则取值
      const c = constRat(n, ctx)
      return c === null ? null : [c]
    }
  }
}

function numLiteralRat(raw: string): Rat {
  const ei = raw.search(/[eE]/)
  if (ei < 0) return ratFromDecimalSafe(raw)
  const mant = ratFromDecimalSafe(raw.slice(0, ei))
  const exp = parseInt(raw.slice(ei + 1), 10)
  if (!Number.isFinite(exp) || Math.abs(exp) > 400) return mant
  if (exp >= 0) return rMul(mant, { n: 10n ** BigInt(exp), d: 1n })
  return rMul(mant, { n: 1n, d: 10n ** BigInt(-exp) })
}

function ratFromDecimalSafe(s: string): Rat {
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(s)
  if (m === null || (m[2] === '' && (m[3] === undefined || m[3] === ''))) {
    throw new CalcError(`无法识别的数字「${s}」`)
  }
  const sign = m[1] === '-' ? -1n : 1n
  const digits = BigInt((m[2] === '' ? '0' : m[2]) + (m[3] ?? ''))
  return mkRat(sign * digits, 10n ** BigInt(m[3]?.length ?? 0))
}

// ---------------- 根式化简工具 ----------------

function isqrtBig(x: bigint): bigint | null {
  if (x < 0n) return null
  if (x < 2n) return x
  let lo = 1n
  let hi = x
  while (lo <= hi) {
    const mid = (lo + hi) / 2n
    const sq = mid * mid
    if (sq === x) return mid
    if (sq < x) lo = mid + 1n
    else hi = mid - 1n
  }
  return null
}

/** 化简 √x → coef·√rad（rad 无平方因子） */
function simplifyRadical(x: bigint): { coef: bigint; rad: bigint } {
  let coef = 1n
  let rest = x
  for (let p = 2n; p * p <= rest; p += p === 2n ? 1n : 2n) {
    while (rest % (p * p) === 0n) {
      rest /= p * p
      coef *= p
    }
  }
  return { coef, rad: rest }
}

function absRat(r: Rat): Rat {
  return r.n < 0n ? { n: -r.n, d: r.d } : r
}

function perfectSquareRat(r: Rat): Rat | null {
  if (r.n < 0n) return null
  const sn = isqrtBig(r.n)
  const sd = isqrtBig(r.d)
  if (sn !== null && sd !== null) return mkRat(sn, sd)
  return null
}

function formatRat(r: Rat): string {
  return r.d === 1n ? r.n.toString() : `${r.n}/${r.d}`
}

function subscript(i: number): string {
  const map = '₀₁₂₃₄₅₆₇₈₉'
  return String(i)
    .split('')
    .map((c) => map[Number(c)] ?? c)
    .join('')
}

// ---------------- 输入切分 ----------------

interface EqPair {
  lhs: Node
  rhs: Node
}

function splitEquations(input: string): string[][] {
  const groups: string[][] = []
  let depth = 0
  let cur = ''
  for (const chRaw of input) {
    const ch = chRaw === '，' ? ',' : chRaw
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      groups.push(cur.split('='))
      cur = ''
      continue
    }
    cur += ch
  }
  groups.push(cur.split('='))
  return groups.map((g) => g.map((s) => s.trim()))
}

// ---------------- 主入口 ----------------

export function solveInput(input: string, angle: AngleMode): SolveResult {
  const ctx: EvalContext = { angle }
  const groups = splitEquations(input.trim())

  if (groups.length === 1) {
    const parts = groups[0]
    if (parts.length === 1) {
      throw new CalcError('没有找到等号「=」。如果只是想计算数值，请去掉等号后直接输入算式')
    }
    if (parts.length > 2) {
      throw new CalcError('一个方程里只能有一个等号「=」')
    }
    const lhs = parseExpression(parts[0])
    const rhs = parseExpression(parts[1])
    return solveSingle(lhs, rhs, ctx)
  }

  const pairs: EqPair[] = groups.map((parts) => {
    if (parts.length !== 2) {
      throw new CalcError('方程组中每个方程都应当恰好包含一个等号「=」')
    }
    return { lhs: parseExpression(parts[0]), rhs: parseExpression(parts[1]) }
  })
  return solveSystem(pairs, ctx)
}

function fmtRow(label: string, v: Val): SolveRow {
  const d = formatVal(v, 9)
  return { label, main: d.main, exact: d.exact, plain: `${label} ${d.plain}` }
}

function solveSingle(lhs: Node, rhs: Node, ctx: EvalContext): SolveResult {
  const uniq = [...new Set([...collectVars(lhs), ...collectVars(rhs)])].sort()

  if (uniq.length === 0) {
    const l = evalNode(lhs, ctx)
    const r = evalNode(rhs, ctx)
    const equal = valsEqual(l, r)
    return {
      rows: [],
      note: equal ? '等式两边相等，这个式子成立。' : '等式两边不相等，这个式子不成立。',
    }
  }
  if (uniq.length > 1) {
    throw new CalcError(
      `方程里有多个未知量（${uniq.join('、')}）。如果是方程组，请用逗号分隔各个方程`
    )
  }

  const x = uniq[0]
  const lp = polyOf(lhs, x, ctx)
  const rp = polyOf(rhs, x, ctx)

  if (lp !== null && rp !== null) {
    const p = polyAdd(lp, rp, -1)
    return solvePoly(polyTrim(p), x)
  }

  return solveNumeric(lhs, rhs, x, ctx)
}

function valsEqual(a: Val, b: Val): boolean {
  if (a.tag === 'cpx' || b.tag === 'cpx') {
    const ca = toCpxSafe(a)
    const cb = toCpxSafe(b)
    return Math.abs(ca.re - cb.re) < 1e-9 && Math.abs(ca.im - cb.im) < 1e-9
  }
  if (a.tag === 'rat' && b.tag === 'rat') return rCmp(a.r, b.r) === 0
  return Math.abs(toNum(a) - toNum(b)) < 1e-9
}

function toCpxSafe(v: Val): { re: number; im: number } {
  if (v.tag === 'cpx') return { re: v.re, im: v.im }
  return { re: toNum(v), im: 0 }
}

// ---------------- 多项式求解 ----------------

function solvePoly(p: Poly, x: string): SolveResult {
  const deg = p.length - 1

  if (deg === 0) {
    if (rIsZero(p[0])) {
      return { rows: [], note: '化简后是 0 = 0：这个等式对任意 x 都成立（恒等式）。' }
    }
    return {
      rows: [],
      note: `化简后得到 ${formatRat(p[0])} = 0，两边矛盾，所以方程无解。`,
    }
  }

  if (deg === 1) {
    const root = rDiv(rNeg(p[0]), p[1])
    return { rows: [fmtRow(`${x} =`, { tag: 'rat', r: root })] }
  }

  if (deg === 2) {
    return solveQuadratic(p[2], p[1], p[0], x)
  }

  const roots = durandKerner(p.map(ratToNumber))
  const rows: SolveRow[] = roots.map((z, i) => {
    if (Math.abs(z.im) < 1e-9) {
      const d = formatVal({ tag: 'num', x: z.re }, 9)
      return { label: `${x}${subscript(i + 1)} ≈`, main: d.main, plain: d.main }
    }
    const d = formatVal({ tag: 'cpx', re: z.re, im: z.im }, 9)
    return { label: `${x}${subscript(i + 1)} ≈`, main: d.main, plain: d.main }
  })
  return {
    rows,
    note: '三次及以上方程给出的是数值近似解。考试若要求精确解，请先尝试因式分解或有理根检验。',
  }
}

function solveQuadratic(a: Rat, b: Rat, c: Rat, x: string): SolveResult {
  const disc = rSub(rMul(b, b), rMul({ n: 4n, d: 1n }, rMul(a, c)))
  const twoA = rMul({ n: 2n, d: 1n }, a)

  // Δ < 0：共轭复根
  if (rCmp(disc, ZERO) < 0) {
    const pVal: Val = { tag: 'rat', r: rDiv(rNeg(b), twoA) }
    const qNum = Math.sqrt(ratToNumber(absRat(disc))) / Math.abs(ratToNumber(twoA))
    const x1 = formatComplexFrom(pVal, qNum)
    const x2 = formatComplexFrom(pVal, -qNum)
    return {
      rows: [
        { label: `${x}${subscript(1)} =`, main: x1.main, exact: x1.exact, plain: x1.main },
        { label: `${x}${subscript(2)} =`, main: x2.main, exact: x2.exact, plain: x2.main },
      ],
      note: '判别式 Δ < 0：方程在实数范围内无解，这两个是共轭复根。',
    }
  }

  // Δ = 0：重根
  if (rIsZero(disc)) {
    const root = rDiv(rNeg(b), twoA)
    return {
      rows: [fmtRow(`${x} =`, { tag: 'rat', r: root })],
      note: '判别式 Δ = 0：方程有两个相等的实数根（重根）。',
    }
  }

  // Δ > 0 且 √Δ 是精确分数
  const sq = perfectSquareRat(disc)
  if (sq !== null) {
    const r1 = rDiv(rAdd(rNeg(b), sq), twoA)
    const r2 = rSub(rDiv(rNeg(b), twoA), rDiv(sq, twoA))
    const [hi, lo] = ratToNumber(r1) >= ratToNumber(r2) ? [r1, r2] : [r2, r1]
    return {
      rows: [
        fmtRow(`${x}${subscript(1)} =`, { tag: 'rat', r: hi }),
        fmtRow(`${x}${subscript(2)} =`, { tag: 'rat', r: lo }),
      ],
      note: '判别式 Δ > 0 且是完全平方数，两个根都是精确分数。',
    }
  }

  // Δ > 0 根式形式：x = (−b ± √Δ)/(2a)
  const bn = rNeg(b)
  const radN = absRat(disc)
  // 化简 √(dn/dd)：提出平方因子
  const sqN = isqrtBig(radN.n)
  const sqD = isqrtBig(radN.d)
  const rows: SolveRow[] = []
  const order: Array<1 | 2> = [1, 2]
  for (const idx of order) {
    const sign = idx === 1 ? 1 : -1
    const val = (ratToNumber(bn) + sign * Math.sqrt(ratToNumber(disc))) / ratToNumber(twoA)
    const approx = formatVal({ tag: 'num', x: val }, 9)
    let exactStr: string
    if (sqN !== null && sqD !== null) {
      // 理论上不会走到（上面已处理完全平方）
      exactStr = ''
    } else {
      // (p·dd ± coef√rad)/dd 形式
      const simp = simplifyRadical(radN.n * radN.d)
      const pn = bn.n * radN.d
      const pd = bn.d * radN.d
      const coef = simp.coef
      const radPart =
        coef === 1n ? `√${simp.rad}` : coef === -1n ? `-√${simp.rad}` : `${coef}√${simp.rad}`
      const numer =
        pn === 0n
          ? sign === 1
            ? radPart
            : radPart.startsWith('-')
              ? radPart.slice(1)
              : `-${radPart}`
          : sign === 1
            ? `${formatSignedInt(pn)}+${radPart}`
            : `${formatSignedInt(pn)}-${radPart}`
      const denom = pd.toString()
      exactStr = denom === '1' ? numer : `(${numer})/${denom}`
    }
    rows.push({
      label: `${x}${subscript(idx)} =`,
      main: `${exactStr} ≈ ${approx.main}`,
      exact: exactStr,
      plain: exactStr,
    })
  }
  return {
    rows,
    note: '判别式 Δ > 0：两个不相等的实数根；√Δ 不是完全平方数，精确形式写成根式。',
  }
}

function formatSignedInt(n: bigint): string {
  return n.toString()
}

interface CpxDisp {
  main: string
  exact?: string
}

function formatComplexFrom(pVal: Val, im: number): CpxDisp {
  const p = toNum(pVal)
  const fmt = (i: number): string => {
    if (p === 0) {
      const mag = Math.abs(i)
      const magStr = mag === 1 ? 'i' : `${formatFloatShort(mag)}i`
      return i < 0 ? `-${magStr}` : magStr
    }
    const conn = i < 0 ? ' − ' : ' + '
    const mag = Math.abs(i)
    const magStr = mag === 1 ? 'i' : `${formatFloatShort(mag)}i`
    return `${formatFloatShort(p)}${conn}${magStr}`
  }
  return { main: fmt(im) }
}

function formatFloatShort(x: number): string {
  const d = formatVal({ tag: 'num', x }, 6)
  return d.main
}

// ---------------- 数值求解（非多项式） ----------------

function solveNumeric(lhs: Node, rhs: Node, x: string, ctx: EvalContext): SolveResult {
  const f = (t: number): number => {
    const xv: Val = { tag: 'num', x: t }
    try {
      const l = evalNode(substVar(lhs, x, xv), ctx)
      const r = evalNode(substVar(rhs, x, xv), ctx)
      const diff = toNumSafe(l) - toNumSafe(r)
      return diff
    } catch {
      return NaN
    }
  }

  const found: number[] = []
  const LO = -50
  const HI = 50
  const STEP = 0.05
  let prevX = LO
  let prevY = f(LO)
  for (let t = LO + STEP; t <= HI + 1e-9; t += STEP) {
    const y = f(t)
    if (Number.isFinite(prevY) && Number.isFinite(y)) {
      if (prevY === 0) pushUnique(found, prevX)
      else if (prevY * y < 0) {
        const root = bisect(f, prevX, t)
        if (root !== null) pushUnique(found, root)
      }
    }
    prevX = t
    prevY = y
  }

  if (found.length === 0) {
    return {
      rows: [],
      note: '在 −50 到 50 的范围内没有找到解。它可能无解、只有整数解之外的特殊解，或解在更远处。',
    }
  }

  const shown = found.slice(0, 6)
  const rows = shown.map((root, i) => {
    const rounded =
      Math.abs(root - Math.round(root)) < 1e-9 ? Math.round(root) : root
    const d = formatVal({ tag: 'num', x: rounded }, 9)
    return {
      label: `${x}${shown.length > 1 ? subscript(i + 1) : ''} ≈`,
      main: d.main,
      plain: d.main,
    }
  })
  return {
    rows,
    note:
      '这不是整式方程，用的是数值方法（近似解）。建议把结果代入原方程检验。' +
      (found.length > 6 ? '范围内还有其他解，只显示前 6 个。' : ''),
  }
}

function toNumSafe(v: Val): number {
  const x = toNum(v)
  return Number.isFinite(x) ? x : NaN
}

function substVar(n: Node, name: string, v: Val): Node {
  switch (n.t) {
    case 'var':
      return n.name === name ? { t: 'num', raw: String(toNum(v)), pos: n.pos } : n
    case 'num':
    case 'const':
      return n
    case 'call':
      return { t: 'call', fn: n.fn, args: n.args.map((a) => substVar(a, name, v)), pos: n.pos }
    case 'un':
      return { t: 'un', op: n.op, arg: substVar(n.arg, name, v), pos: n.pos }
    case 'bin':
      return {
        t: 'bin',
        op: n.op,
        l: substVar(n.l, name, v),
        r: substVar(n.r, name, v),
        pos: n.pos,
      }
    case 'fact':
      return { t: 'fact', arg: substVar(n.arg, name, v), pos: n.pos }
    case 'pct':
      return { t: 'pct', arg: substVar(n.arg, name, v), pos: n.pos }
    case 'deg':
      return { t: 'deg', arg: substVar(n.arg, name, v), pos: n.pos }
  }
}

function pushUnique(arr: number[], x: number): void {
  const rx = Math.round(x * 1e8) / 1e8
  if (!arr.some((a) => Math.abs(a - rx) < 1e-6)) arr.push(rx)
}

function bisect(
  f: (t: number) => number,
  lo: number,
  hi: number
): number | null {
  let a = lo
  let b = hi
  let fa = f(a)
  if (!Number.isFinite(fa)) return null
  for (let i = 0; i < 100 && b - a > 1e-13; i++) {
    const m = (a + b) / 2
    const fm = f(m)
    if (!Number.isFinite(fm)) return null
    if (fm === 0) return m
    if (fa * fm < 0) {
      b = m
    } else {
      a = m
      fa = fm
    }
  }
  return (a + b) / 2
}

// ---------------- 高次多项式：Durand–Kerner ----------------

function durandKerner(coeffs: number[]): Array<{ re: number; im: number }> {
  let n = coeffs.length - 1
  while (n > 0 && coeffs[n] === 0) n--
  if (n < 1) return []
  const norm = coeffs.slice(0, n + 1).map((c) => c / coeffs[n])

  const evalPoly = (z: { re: number; im: number }): { re: number; im: number } => {
    let re = 0
    let im = 0
    for (let i = n; i >= 0; i--) {
      const nre = re * z.re - im * z.im + norm[i]
      const nim = re * z.im + im * z.re
      re = nre
      im = nim
    }
    return { re, im }
  }

  const seed = { re: 0.4, im: 0.9 }
  const roots: Array<{ re: number; im: number }> = []
  let cur = { re: 1, im: 0 }
  for (let k = 0; k < n; k++) {
    cur = cmul(cur, seed)
    roots.push({ ...cur })
  }

  for (let iter = 0; iter < 800; iter++) {
    let maxDelta = 0
    for (let i = 0; i < n; i++) {
      const zi = roots[i]
      let dre = 1
      let dim = 0
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        const w = csub(zi, roots[j])
        const nd = cmul({ re: dre, im: dim }, w)
        dre = nd.re
        dim = nd.im
      }
      const den = dre * dre + dim * dim
      if (den === 0) continue
      const pz = evalPoly(zi)
      // 复数除法：pz / (dre + dim·i)
      const qx = (pz.re * dre + pz.im * dim) / den
      const qy = (pz.im * dre - pz.re * dim) / den
      maxDelta = Math.max(maxDelta, Math.hypot(qx, qy))
      roots[i] = { re: zi.re - qx, im: zi.im - qy }
    }
    if (maxDelta < 1e-15) break
  }

  const cleaned: Array<{ re: number; im: number }> = []
  for (const z of roots) {
    const mag = Math.max(1, Math.hypot(z.re, z.im))
    const iz = Math.abs(z.im) < 1e-7 * mag ? 0 : z.im
    const cand = {
      re: Math.round(z.re * 1e10) / 1e10,
      im: Math.round(iz * 1e10) / 1e10,
    }
    if (
      !cleaned.some(
        (c) => Math.abs(c.re - cand.re) < 1e-6 && Math.abs(c.im - cand.im) < 1e-6
      )
    ) {
      cleaned.push(cand)
    }
  }
  cleaned.sort((u, v) => {
    const ur = Math.abs(u.im) < 1e-9
    const vr = Math.abs(v.im) < 1e-9
    if (ur !== vr) return ur ? -1 : 1
    return u.re - v.re || u.im - v.im
  })
  return cleaned
}

function csub(a: { re: number; im: number }, b: { re: number; im: number }) {
  return { re: a.re - b.re, im: a.im - b.im }
}
function cmul(a: { re: number; im: number }, b: { re: number; im: number }) {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }
}

// ---------------- 线性方程组 ----------------

interface LinearForm {
  coefs: Map<string, Rat>
  constant: Rat
}

function linearOf(n: Node, vars: string[], ctx: EvalContext): LinearForm | null {
  const zeroForm = (): LinearForm => ({
    coefs: new Map(vars.map((v) => [v, ZERO])),
    constant: ZERO,
  })

  const scaleForm = (f: LinearForm, k: Rat): LinearForm => {
    const out = zeroForm()
    out.constant = rMul(f.constant, k)
    for (const v of vars) out.coefs.set(v, rMul(f.coefs.get(v) ?? ZERO, k))
    return out
  }

  const go = (node: Node): LinearForm | null => {
    switch (node.t) {
      case 'num': {
        const f = zeroForm()
        f.constant = numLiteralRat(node.raw)
        return f
      }
      case 'var': {
        if (!vars.includes(node.name)) return null
        const f = zeroForm()
        f.coefs.set(node.name, mkRat(1n, 1n))
        return f
      }
      case 'un': {
        const f = go(node.arg)
        return f === null ? null : scaleForm(f, mkRat(-1n, 1n))
      }
      case 'bin': {
        if (node.op === '+' || node.op === '-') {
          const l = go(node.l)
          const r = go(node.r)
          if (l === null || r === null) return null
          const out = zeroForm()
          out.constant =
            node.op === '+' ? rAdd(l.constant, r.constant) : rSub(l.constant, r.constant)
          for (const v of vars) {
            const lv = l.coefs.get(v) ?? ZERO
            const rv = r.coefs.get(v) ?? ZERO
            out.coefs.set(v, node.op === '+' ? rAdd(lv, rv) : rSub(lv, rv))
          }
          return out
        }
        if (node.op === '*') {
          const l = go(node.l)
          const r = go(node.r)
          if (l === null || r === null) return null
          const lConst = [...l.coefs.values()].every((c) => rIsZero(c))
          const rConst = [...r.coefs.values()].every((c) => rIsZero(c))
          if (lConst && rConst) {
            const out = zeroForm()
            out.constant = rMul(l.constant, r.constant)
            return out
          }
          if (lConst) return scaleForm(r, l.constant)
          if (rConst) return scaleForm(l, r.constant)
          return null // 变量相乘 → 非线性
        }
        if (node.op === '/') {
          const l = go(node.l)
          if (l === null) return null
          const rc = constRat(node.r, ctx)
          if (rc === null || rIsZero(rc)) return null
          return scaleForm(l, rDiv(mkRat(1n, 1n), rc))
        }
        return null
      }
      default: {
        const c = constRat(node, ctx)
        if (c === null) return null
        const f = zeroForm()
        f.constant = c
        return f
      }
    }
  }
  return go(n)
}

function solveSystem(pairs: EqPair[], ctx: EvalContext): SolveResult {
  const varSet = new Set<string>()
  for (const p of pairs) {
    collectVars(p.lhs, varSet)
    collectVars(p.rhs, varSet)
  }
  const vars = [...varSet].sort()

  if (vars.length === 0) {
    throw new CalcError('方程组里没有未知量')
  }

  const forms: LinearForm[] = []
  for (const p of pairs) {
    const l = linearOf(p.lhs, vars, ctx)
    const r = linearOf(p.rhs, vars, ctx)
    if (l === null || r === null) {
      throw new CalcError(
        '目前方程组只支持一次（线性）方程：未知量不能相乘、不能有高次方或非线性函数'
      )
    }
    forms.push({
      coefs: new Map(
        vars.map((v) => [
          v,
          rSub(l.coefs.get(v) ?? ZERO, r.coefs.get(v) ?? ZERO),
        ])
      ),
      // 方程 LHS = RHS 化为 A·x + c = 0，增广矩阵右端取 −c
      constant: rNeg(rSub(l.constant, r.constant)),
    })
  }

  if (pairs.length !== vars.length) {
    throw new CalcError(
      `方程个数（${pairs.length}）和未知量个数（${vars.length}）不一致，无法唯一确定一组解`
    )
  }

  const n = vars.length
  const m: Rat[][] = forms.map((f) => [
    ...vars.map((v) => f.coefs.get(v) ?? ZERO),
    f.constant,
  ])

  for (let col = 0; col < n; col++) {
    let piv = -1
    for (let row = col; row < n; row++) {
      if (!rIsZero(m[row][col])) {
        piv = row
        break
      }
    }
    if (piv === -1) continue
    if (piv !== col) {
      const tmp = m[piv]
      m[piv] = m[col]
      m[col] = tmp
    }
    const pv = m[col][col]
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      if (rIsZero(m[row][col])) continue
      const factor = rDiv(m[row][col], pv)
      for (let c2 = col; c2 <= n; c2++) {
        m[row][c2] = rSub(m[row][c2], rMul(factor, m[col][c2]))
      }
    }
  }

  for (let row = 0; row < n; row++) {
    const coefAllZero = m[row].slice(0, n).every((c) => rIsZero(c))
    if (coefAllZero && !rIsZero(m[row][n])) {
      return {
        rows: [],
        note: '消元后出现「0 = 非零」：这些方程互相矛盾，方程组无解。',
      }
    }
  }
  for (let col = 0; col < n; col++) {
    if (rIsZero(m[col][col])) {
      return {
        rows: [],
        note: '这些方程不完全独立，有无穷多组解。本工具暂不展开通解形式。',
      }
    }
  }

  const rows: SolveRow[] = vars.map((v, i) => {
    const sol = rDiv(m[i][n], m[i][i])
    return fmtRow(`${v} =`, { tag: 'rat', r: sol })
  })
  return { rows }
}
