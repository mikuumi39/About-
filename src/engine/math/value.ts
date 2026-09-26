/**
 * 统一数值模型与运算。
 *
 * 精度策略（自动提升）：
 *   rat  精确有理数        —— 字面量、四则、整数幂尽量保持
 *   surd c·√k（k 无平方因子）—— 开方、特殊角三角值的精确形式
 *   num  IEEE 双精度浮点    —— 超出精确表示能力
 *   cpx  a+bi 复数          —— 负数开偶次方等
 */
import {
  bigAbs,
  gcdBig,
  mkRat,
  perfectRoot,
  rAbs,
  rAdd,
  rCmp,
  rDiv,
  rIsInt,
  rIsZero,
  rMul,
  rNeg,
  rPowInt,
  ratToNumber,
  rSign,
  type Rat,
} from './rational'
import { CalcError } from './errors'

export { CalcError }

export type Val =
  | { tag: 'rat'; r: Rat }
  | { tag: 'surd'; c: Rat; k: bigint } // c·√k，k>1 且无平方因子；c 可为任意分数
  | { tag: 'num'; x: number }
  | { tag: 'cpx'; re: number; im: number }

export type AngleMode = 'deg' | 'rad'

// CalcError 从 errors.ts 导入并原样再导出（见文件头部）

// ---------------- 构造 ----------------

export function vRat(r: Rat): Val {
  return { tag: 'rat', r }
}
export function vInt(n: number): Val {
  return { tag: 'rat', r: { n: BigInt(n), d: 1n } }
}
export function vNum(x: number): Val {
  if (!Number.isFinite(x)) {
    throw new CalcError('计算结果超出了可表示的范围')
  }
  return { tag: 'num', x }
}
/** c·√k：自动化简平方因子并归一 */
export function vSurd(c: Rat, k: bigint): Val {
  if (k <= 1n) return vRat(c)
  // 提出 k 的平方因子
  let out = k
  let coef = c
  for (let p = 2n; p * p <= out; p += p === 2n ? 1n : 2n) {
    while (out % (p * p) === 0n) {
      out /= p * p
      coef = rMul(coef, { n: p, d: 1n })
    }
  }
  if (out === 1n) return vRat(coef)
  if (rIsZero(coef)) return vRat({ n: 0n, d: 1n })
  return { tag: 'surd', c: coef, k: out }
}
export function vCpx(re: number, im: number): Val {
  return { tag: 'cpx', re, im }
}

// ---------------- 探测 / 提升 ----------------

export function isComplex(v: Val): boolean {
  return v.tag === 'cpx'
}
export function toNum(v: Val): number {
  switch (v.tag) {
    case 'rat':
      return ratToNumber(v.r)
    case 'surd':
      return ratToNumber(v.c) * Math.sqrt(ratToNumber({ n: v.k, d: 1n }))
    case 'num':
      return v.x
    case 'cpx':
      if (v.im === 0) return v.re
      throw new CalcError('这一步需要实数，但得到了复数')
  }
}
export function toCpx(v: Val): { re: number; im: number } {
  if (v.tag === 'cpx') return { re: v.re, im: v.im }
  return { re: toNum(v), im: 0 }
}

// ---------------- 四则 ----------------

function promotePair(a: Val, b: Val): 'rat' | 'surd' | 'num' | 'cpx' {
  const rank = { rat: 0, surd: 1, num: 2, cpx: 3 } as const
  return rank[a.tag] >= rank[b.tag] ? a.tag : b.tag
}

export function vAdd(a: Val, b: Val): Val {
  const t = promotePair(a, b)
  if (t === 'rat') return vRat(rAdd((a as { r: Rat }).r, (b as { r: Rat }).r))
  if (t === 'surd') {
    const sa = a.tag === 'surd' ? a : null
    const sb = b.tag === 'surd' ? b : null
    if (sa !== null && sb !== null && sa.k === sb.k) return vSurd(rAdd(sa.c, sb.c), sa.k)
    return vNum(toNum(a) + toNum(b))
  }
  if (t === 'num') return vNum(toNum(a) + toNum(b))
  const ca = toCpx(a)
  const cb = toCpx(b)
  return vCpx(ca.re + cb.re, ca.im + cb.im)
}

export function vSub(a: Val, b: Val): Val {
  return vAdd(a, vNeg(b))
}

export function vNeg(a: Val): Val {
  switch (a.tag) {
    case 'rat':
      return vRat(rNeg(a.r))
    case 'surd':
      return { tag: 'surd', c: rNeg(a.c), k: a.k }
    case 'num':
      return vNum(-a.x)
    case 'cpx':
      return vCpx(-a.re, -a.im)
  }
}

export function vMul(a: Val, b: Val): Val {
  const t = promotePair(a, b)
  if (t === 'rat') return vRat(rMul((a as { r: Rat }).r, (b as { r: Rat }).r))
  if (t === 'surd') {
    const ra = a.tag === 'rat' ? a.r : null
    const rb = b.tag === 'rat' ? b.r : null
    if (ra !== null && b.tag === 'surd') return vSurd(rMul(ra, b.c), b.k)
    if (rb !== null && a.tag === 'surd') return vSurd(rMul(rb, a.c), a.k)
    if (a.tag === 'surd' && b.tag === 'surd') {
      // √k₁·√k₂：系数相乘，被开方数相乘后由 vSurd 化简平方因子
      return vSurd(rMul(a.c, b.c), a.k * b.k)
    }
    return vNum(toNum(a) * toNum(b))
  }
  if (t === 'num') return vNum(toNum(a) * toNum(b))
  const ca = toCpx(a)
  const cb = toCpx(b)
  return vCpx(ca.re * cb.re - ca.im * cb.im, ca.re * cb.im + ca.im * cb.re)
}

export function vDiv(a: Val, b: Val): Val {
  if (b.tag === 'rat' && rIsZero(b.r)) throw new CalcError('除数不能为 0')
  if (b.tag === 'num' && b.x === 0) throw new CalcError('除数不能为 0')
  const t = promotePair(a, b)
  if (t === 'rat') return vRat(rDiv((a as { r: Rat }).r, (b as { r: Rat }).r))
  if (t === 'surd') {
    // 有理 ÷ 根式：分母有理化 a/(c√k) = a·√k/(ck)
    if (a.tag === 'rat' && b.tag === 'surd') {
      const ck = rMul(b.c, { n: b.k, d: 1n })
      return vSurd(rDiv(a.r, ck), b.k)
    }
    if (a.tag === 'surd' && b.tag === 'rat') return vSurd(rDiv(a.c, b.r), a.k)
    if (a.tag === 'surd' && b.tag === 'surd' && a.k === b.k) return vRat(rDiv(a.c, b.c))
    return vNum(toNum(a) / toNum(b))
  }
  if (t === 'num') return vNum(toNum(a) / toNum(b))
  const ca = toCpx(a)
  const cb = toCpx(b)
  const den = cb.re * cb.re + cb.im * cb.im
  if (den === 0) throw new CalcError('除数不能为 0')
  return vCpx((ca.re * cb.re + ca.im * cb.im) / den, (ca.im * cb.re - ca.re * cb.im) / den)
}

/** 实数值比较（仅限实数） */
export function vCmp(a: Val, b: Val): number {
  if (isComplex(a) || isComplex(b)) {
    throw new CalcError('复数之间没有大小关系')
  }
  if (a.tag === 'rat' && b.tag === 'rat') return rCmp(a.r, b.r)
  const x = toNum(a)
  const y = toNum(b)
  return x < y ? -1 : x > y ? 1 : 0
}

export function vIsZero(v: Val): boolean {
  switch (v.tag) {
    case 'rat':
      return rIsZero(v.r)
    case 'surd':
      return rIsZero(v.c)
    case 'num':
      return v.x === 0
    case 'cpx':
      return v.re === 0 && v.im === 0
  }
}

/**
 * 幂运算。
 * - 整数指数且有理底数 → 尽量精确
 * - 指数为 1/n 且底数为完全 n 次幂 → 精确根
 * - 其余走浮点；负底数非整指数走复数主支
 */
export function vPow(a: Val, b: Val): Val {
  if (vIsZero(b)) return vInt(1)
  // 复数路径
  if (a.tag === 'cpx' || b.tag === 'cpx') {
    const { re, im } = toCpx(a)
    const n = toNum(b)
    const r = Math.hypot(re, im)
    const theta = Math.atan2(im, re)
    const nr = Math.pow(r, n)
    const nt = theta * n
    let rre = nr * Math.cos(nt)
    let rim = nr * Math.sin(nt)
    // 消除浮点噪声：i²、(1+i)² 等应得到干净结果
    if (Math.abs(rim) < 1e-10 * Math.max(1, Math.abs(rre))) rim = 0
    if (Math.abs(rre) < 1e-10 * Math.max(1, Math.abs(rim))) rre = 0
    return vCpx(rre, rim)
  }
  // 有理指数？
  if (b.tag === 'rat') {
    // 指数是整数
    if (rIsInt(b.r)) {
      const e = Number(b.r.n)
      if (a.tag === 'rat') {
        const exact = rPowInt(a.r, e)
        if (exact !== null) return vRat(exact)
      }
      // 负底数整数幂仍精确为浮点符号处理
      return vNum(Math.pow(toNum(a), e))
    }
    // 分数指数 p/q（q 为分母）
    const q = Number(b.r.d)
    const p = Number(b.r.n)
    if (q % 2 === 1 && a.tag === 'rat' && a.r.n < 0n) {
      // 奇次根允许负底数：(-8)^(1/3) = -2
      const rootNeg = perfectRoot(bigAbs(a.r.n), q)
      const rootDen = perfectRoot(a.r.d, q)
      if (rootNeg !== null && rootDen !== null) {
        const base = mkRat(-rootNeg, rootDen)
        const pe = rPowInt(base, Math.abs(p))
        if (pe !== null) return p >= 0 ? vRat(pe) : vRat(rDiv({ n: 1n, d: 1n }, pe))
      }
      return vNum(-Math.pow(Math.pow(ratToNumber(rAbs(a.r)), 1 / q), p))
    }
    if (a.tag === 'rat') {
      if (a.r.n < 0n) {
        // 负底数偶次根 → 复数主支
        const absRootRe = Math.pow(ratToNumber(rAbs(a.r)), 1 / q)
        const angle = Math.PI / q
        return vCpx(absRootRe * Math.cos(angle * p), absRootRe * Math.sin(angle * p))
      }
      const rn = perfectRoot(a.r.n, q)
      const rd = perfectRoot(a.r.d, q)
      if (rn !== null && rd !== null) {
        const base = mkRat(rn, rd)
        const pe = rPowInt(base, Math.abs(p))
        if (pe !== null) return p >= 0 ? vRat(pe) : vRat(rDiv({ n: 1n, d: 1n }, pe))
      }
      // √(n/d) = √(nd)/d（vSurd 会化简平方因子）
      if (q === 2) {
        return vSurd(mkRat(1n, a.r.d), a.r.n * a.r.d)
      }
    }
  }
  const x = toNum(a)
  const y = toNum(b)
  if (x < 0 && !Number.isInteger(y)) {
    // 负底数非整指数 → 复数主支
    const r = Math.abs(x)
    const res = Math.pow(r, y)
    const nt = Math.PI * y
    return vCpx(res * Math.cos(nt), res * Math.sin(nt))
  }
  const res = Math.pow(x, y)
  if (!Number.isFinite(res)) {
    throw new CalcError('这个幂运算结果太大或未定义')
  }
  return vNum(res)
}

/** 平方根（实数域优先精确/根式，负数进复数） */
export function vSqrt(a: Val): Val {
  if (a.tag === 'cpx') {
    const { re, im } = a
    const r = Math.hypot(re, im)
    const sre = Math.sqrt((r + re) / 2)
    const sim = Math.sign(im || 1) * Math.sqrt((r - re) / 2)
    return vCpx(sre, sim)
  }
  if (a.tag === 'rat') {
    if (a.r.n < 0n) {
      return vCpx(0, Math.sqrt(ratToNumber(rAbs(a.r))))
    }
    const rn = perfectRoot(a.r.n, 2)
    const rd = perfectRoot(a.r.d, 2)
    if (rn !== null && rd !== null) return vRat(mkRat(rn, rd))
    if (rIsZero(a.r)) return vInt(0)
    if (rd !== null) return vSurd(mkRat(1n, rd), a.r.n)
    if (rn !== null) return vSurd({ n: rn, d: 1n }, a.r.d)
    // √(n/d) = √(nd)/d
    return vSurd({ n: 1n, d: a.r.d }, a.r.n * a.r.d)
  }
  const x = toNum(a)
  if (x < 0) return vCpx(0, Math.sqrt(-x))
  return vNum(Math.sqrt(x))
}

/** 立方根 */
export function vCbrt(a: Val): Val {
  if (a.tag === 'rat' && a.r.n < 0n) {
    const rn = perfectRoot(bigAbs(a.r.n), 3)
    const rd = perfectRoot(a.r.d, 3)
    if (rn !== null && rd !== null) return vRat(mkRat(-rn, rd))
    return vNum(-Math.cbrt(ratToNumber(rAbs(a.r))))
  }
  if (a.tag === 'rat') {
    const rn = perfectRoot(a.r.n, 3)
    const rd = perfectRoot(a.r.d, 3)
    if (rn !== null && rd !== null) return vRat(mkRat(rn, rd))
  }
  return vNum(Math.cbrt(toNum(a)))
}

/** 阶乘（0–170 整数，精确） */
export function vFactorial(a: Val): Val {
  let n: number
  if (a.tag === 'rat' && rIsInt(a.r)) {
    n = Number(a.r.n)
  } else if (a.tag === 'num' && Number.isInteger(a.x)) {
    n = a.x
  } else {
    throw new CalcError('阶乘只支持整数（目前支持 0–170）')
  }
  if (n < 0 || n > 170) {
    throw new CalcError('阶乘只支持 0–170 的整数')
  }
  let acc = 1n
  for (let i = 2n; i <= BigInt(n); i++) acc *= i
  return vRat({ n: acc, d: 1n })
}

/** 排列 A(n,r) */
export function vPermutation(nV: Val, rV: Val): Val {
  const { n, r } = intPair(nV, rV, '排列 A(n,r)')
  if (r > n) throw new CalcError('排列要求 r ≤ n')
  if (n > 100000) throw new CalcError('排列只支持 n ≤ 100000')
  let acc = 1n
  for (let i = 0; i < r; i++) acc *= BigInt(n - i)
  return vRat({ n: acc, d: 1n })
}

/** 组合 C(n,r) */
export function vCombination(nV: Val, rV: Val): Val {
  const { n, r } = intPair(nV, rV, '组合 C(n,r)')
  if (r > n) throw new CalcError('组合要求 r ≤ n')
  if (n > 1000000) throw new CalcError('组合只支持 n ≤ 1000000')
  const k = Math.min(r, n - r)
  let acc = 1n
  for (let i = 1; i <= k; i++) {
    acc = (acc * BigInt(n - k + i)) / BigInt(i)
  }
  return vRat({ n: acc, d: 1n })
}

function intPair(a: Val, b: Val, label: string): { n: number; r: number } {
  const na = toNum(a)
  const nb = toNum(b)
  if (!Number.isInteger(na) || !Number.isInteger(nb)) {
    throw new CalcError(`${label} 只支持整数`)
  }
  if (na < 0 || nb < 0) {
    throw new CalcError(`${label} 要求 n、r 为非负整数`)
  }
  return { n: na, r: nb }
}

/** 最大公约数 / 最小公倍数（支持分数：先通分为同分母再对分子操作） */
export function vGcd(a: Val, b: Val): Val {
  const [ra, rb] = twoRats(a, b, 'gcd')
  const g = gcdBig(ra.n * rb.d, rb.n * ra.d)
  return vRat(mkRat(g, ra.d * rb.d))
}
export function vLcm(a: Val, b: Val): Val {
  const [ra, rb] = twoRats(a, b, 'lcm')
  if (rIsZero(ra) || rIsZero(rb)) return vInt(0)
  const numLcm = bigAbs(ra.n * rb.n) / gcdBig(ra.n, rb.n)
  return vRat(mkRat(numLcm, gcdBig(ra.d, rb.d)))
}

function twoRats(a: Val, b: Val, label: string): [Rat, Rat] {
  if ((a.tag !== 'rat' && !(a.tag === 'num' && Number.isInteger(a.x))) ||
      (b.tag !== 'rat' && !(b.tag === 'num' && Number.isInteger(b.x)))) {
    // 允许浮点整数
    const na = toNum(a)
    const nb = toNum(b)
    if (!Number.isInteger(na) || !Number.isInteger(nb)) {
      throw new CalcError(`${label} 只支持整数`)
    }
    return [{ n: BigInt(na), d: 1n }, { n: BigInt(nb), d: 1n }]
  }
  const ra = a.tag === 'rat' ? a.r : { n: BigInt(toNum(a)), d: 1n }
  const rb = b.tag === 'rat' ? b.r : { n: BigInt(toNum(b)), d: 1n }
  return [ra, rb]
}

export function vSign(a: Val): Val {
  const x = toNum(a)
  return vInt(x > 0 ? 1 : x < 0 ? -1 : 0)
}

export function rSignOf(v: Val): number {
  if (v.tag === 'rat') return rSign(v.r)
  if (v.tag === 'surd') return rSign(v.c)
  return Math.sign(toNum(v))
}
