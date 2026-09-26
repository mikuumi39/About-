/**
 * 结果格式化：
 * - main  默认展示（直观小数优先）
 * - exact 精确形式（分数 / 根式），仅在存在且与 main 不同时提供
 * - plain 复制用纯文本（Unicode，可直接粘贴到微信 / QQ / 文档）
 */
import {
  bigAbs,
  rDecimalString,
  rFractionString,
  rIsInt,
  type Rat,
} from './rational'
import { toNum, type Val } from './value'

export interface Display {
  main: string
  exact?: string
  plain: string
}

const SUP_MAP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
  '+': '',
}

export function toSuperscript(s: string): string {
  return Array.from(s)
    .map((c) => SUP_MAP[c] ?? c)
    .join('')
}

function trimZeros(s: string): string {
  if (s.includes('.')) {
    s = s.replace(/0+$/, '').replace(/\.$/, '')
  }
  return s === '-0' ? '0' : s
}

/** 浮点 → 展示字符串；过大过小自动科学计数法（×10ⁿ 形式） */
export function formatFloat(x: number, places: number): string {
  if (Object.is(x, -0)) return '0'
  if (!Number.isFinite(x)) return x > 0 ? '+∞' : '-∞'
  if (x === 0) return '0'
  const ax = Math.abs(x)
  if (ax >= 1e13 || ax < 1e-9) {
    const exp = Math.floor(Math.log10(ax))
    let mant = x / Math.pow(10, exp)
    // 处理 9.999999→10 的边界
    if (Math.abs(mant) >= 10) {
      mant /= 10
      return `${trimZeros(mant.toFixed(Math.min(places, 10)))}×10${toSuperscript(String(exp + 1))}`
    }
    return `${trimZeros(mant.toFixed(Math.min(places, 10)))}×10${toSuperscript(String(exp))}`
  }
  return trimZeros(x.toFixed(places))
}

/** 根式 c·√k → 「√2/2」「2√3」「-3√5/7」 */
export function formatSurd(c: Rat, k: bigint): string {
  const neg = c.n < 0n
  const p = bigAbs(c.n)
  const q = c.d
  const rad = k === 1n ? '' : `√${k.toString()}`
  let numerator: string
  if (p === 1n && rad !== '') {
    numerator = rad
  } else {
    numerator = `${p.toString()}${rad}`
  }
  const body = q === 1n ? numerator : `${numerator}/${q.toString()}`
  return neg ? `-${body}` : body
}

export function formatComplex(re: number, im: number, places: number): string {
  if (im === 0) return formatFloat(re, places)
  const imMag = Math.abs(im)
  const imUnit = imMag === 1 ? 'i' : `${formatFloat(imMag, places)}i`
  if (re === 0) return (im < 0 ? '-' : '') + imUnit
  const conn = im > 0 ? ' + ' : ' - '
  return `${formatFloat(re, places)}${conn}${imUnit}`
}

export function formatVal(v: Val, places: number): Display {
  switch (v.tag) {
    case 'rat': {
      const dec = rDecimalString(v.r, places)
      if (rIsInt(v.r)) {
        return { main: dec, plain: v.r.n.toString() }
      }
      const frac = rFractionString(v.r)
      return { main: dec, exact: frac, plain: frac }
    }
    case 'surd': {
      const main = formatFloat(toNum(v), places)
      const exact = formatSurd(v.c, v.k)
      return { main, exact, plain: exact }
    }
    case 'num': {
      const main = formatFloat(v.x, places)
      return { main, plain: main }
    }
    case 'cpx': {
      const main = formatComplex(v.re, v.im, places)
      return { main, plain: main }
    }
  }
}

/** 有理数的 LaTeX（用于预览）：分数形式 */
export function ratToLatex(r: Rat): string {
  if (rIsInt(r)) return r.n.toString()
  return `\\frac{${r.n}}{${r.d}}`
}
