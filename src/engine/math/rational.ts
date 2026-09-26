/**
 * 精确有理数（BigInt）。
 * 不变量：d > 0，gcd(|n|, d) = 1。
 */

export interface Rat {
  n: bigint
  d: bigint
}

const _0 = 0n
const _1 = 1n

export function bigAbs(x: bigint): bigint {
  return x < _0 ? -x : x
}

export function gcdBig(a: bigint, b: bigint): bigint {
  let x = bigAbs(a)
  let y = bigAbs(b)
  while (y !== _0) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

export function mkRat(n: bigint, d: bigint): Rat {
  if (d === _0) throw new Error('分母为 0')
  if (d < _0) {
    n = -n
    d = -d
  }
  const g = gcdBig(n, d)
  if (g > _1) {
    return { n: n / g, d: d / g }
  }
  return { n, d }
}

export const RAT_ZERO: Rat = { n: _0, d: _1 }
export const RAT_ONE: Rat = { n: _1, d: _1 }

export function ratFromInt(n: number | bigint): Rat {
  return { n: BigInt(n), d: _1 }
}

/** 由十进制字面量（可带符号、小数点）构造精确分数；非法输入抛错 */
export function ratFromDecimal(s: string): Rat {
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(s)
  if (m === null || (m[2] === '' && (m[3] === undefined || m[3] === ''))) {
    throw new Error(`无法识别的数字：${s}`)
  }
  const sign = m[1] === '-' ? -1n : 1n
  const intPart = m[2] === '' ? '0' : m[2]
  const fracPart = m[3] ?? ''
  const digits = BigInt(intPart + fracPart)
  const den = 10n ** BigInt(fracPart.length)
  return mkRat(sign * digits, den)
}

export function rAdd(a: Rat, b: Rat): Rat {
  return mkRat(a.n * b.d + b.n * a.d, a.d * b.d)
}
export function rSub(a: Rat, b: Rat): Rat {
  return mkRat(a.n * b.d - b.n * a.d, a.d * b.d)
}
export function rMul(a: Rat, b: Rat): Rat {
  return mkRat(a.n * b.n, a.d * b.d)
}
export function rDiv(a: Rat, b: Rat): Rat {
  if (b.n === _0) throw new Error('除数不能为 0')
  return mkRat(a.n * b.d, a.d * b.n)
}
export function rNeg(a: Rat): Rat {
  return { n: -a.n, d: a.d }
}
export function rAbs(a: Rat): Rat {
  return { n: bigAbs(a.n), d: a.d }
}
export function rIsZero(a: Rat): boolean {
  return a.n === _0
}
export function rIsInt(a: Rat): boolean {
  return a.d === _1
}
export function rSign(a: Rat): number {
  return a.n < _0 ? -1 : a.n > _0 ? 1 : 0
}
export function rCmp(a: Rat, b: Rat): number {
  const l = a.n * b.d
  const r = b.n * a.d
  return l < r ? -1 : l > r ? 1 : 0
}
export function rEq(a: Rat, b: Rat): boolean {
  return a.n === b.n && a.d === b.d
}

/** 有理数幂（整数指数）。超出安全范围时返回 null，由上层降级为浮点 */
export function rPowInt(a: Rat, e: number): Rat | null {
  if (!Number.isInteger(e) || Math.abs(e) > 4096) return null
  const LIMIT = 1n << 2048n // 分子/分母绝对值上限（约 616 位十进制）
  let result: Rat = RAT_ONE
  let base: Rat = a
  let k = Math.abs(e)
  while (k > 0) {
    if ((k & 1) === 1) {
      result = rMul(result, base)
      if (bigAbs(result.n) > LIMIT || result.d > LIMIT) return null
    }
    k >>= 1
    if (k > 0) {
      base = rMul(base, base)
      if (bigAbs(base.n) > LIMIT || base.d > LIMIT) return null
    }
  }
  return e >= 0 ? result : rDiv(RAT_ONE, result)
}

/** floor(k 次方根)，k ≥ 2 */
export function irootFloor(x: bigint, k: number): bigint {
  if (x < _0) throw new Error('负数没有实数偶次方根')
  if (x < 2n) return x
  let lo = _0
  let hi = 1n << BigInt(Math.ceil(bitLength(x) / k) + 1)
  while (lo < hi) {
    const mid = (lo + hi + _1) >> 1n
    const p = mid ** BigInt(k)
    if (p <= x) {
      lo = mid
    } else {
      hi = mid - _1
    }
  }
  return lo
}

function bitLength(x: bigint): number {
  if (x < _0) x = -x
  let len = 0
  while (x !== _0) {
    x >>= 8n
    len += 8
  }
  return Math.max(len, 1)
}

/** 是否完全 k 次幂；是则返回精确整数根 */
export function perfectRoot(x: bigint, k: number): bigint | null {
  if (x < _0) return null
  const r = irootFloor(x, k)
  return r ** BigInt(k) === x ? r : null
}

export function ratToNumber(a: Rat): number {
  const nd = Number(a.n)
  if (nd === Infinity || nd === -Infinity) return nd
  const dd = Number(a.d)
  if (dd === Infinity) return 0
  return nd / dd
}

/** 四舍五入到 places 位小数的字符串（去尾零）；places=0 输出整数 */
export function rDecimalString(a: Rat, places: number): string {
  if (rIsZero(a)) return places > 0 ? '0' : '0'
  const neg = a.n < _0
  const n = neg ? -a.n : a.n
  const d = a.d
  const scale = 10n ** BigInt(places)
  // 四舍五入（远离零）：floor((n*scale*2 + d) / (2d))
  const scaled = (n * scale * 2n + d) / (2n * d)
  let s = scaled.toString()
  if (places > 0) {
    while (s.length <= places) s = '0' + s
    const cut = s.length - places
    let intPart = s.slice(0, cut)
    const fracPart = s.slice(cut).replace(/0+$/, '')
    if (intPart === '') intPart = '0'
    s = fracPart === '' ? intPart : `${intPart}.${fracPart}`
  } else if (s === '0') {
    s = '0'
  }
  return neg && scaled !== _0 ? `-${s}` : s
}

/** "n/d" 或整数 "n" */
export function rFractionString(a: Rat): string {
  return a.d === _1 ? a.n.toString() : `${a.n}/${a.d}`
}
