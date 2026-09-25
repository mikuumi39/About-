/**
 * 化学式 / 化学方程式解析。
 * 接受的输入形式（对手机输入法友好）：
 *   H2O            数字自动成为下标
 *   Fe(OH)3        括号分组
 *   CuSO4·5H2O     结晶水（· 或 . 或 *）
 *   Na+  SO4^2-    电荷用 ^n± / + / - 表示
 *   Ca(g) (aq)     状态标注可省略
 */

import { ELEMENT_MAP } from '../../data/elements'

export class ChemError extends Error {
  readonly pos?: number
  constructor(message: string, pos?: number) {
    super(message)
    this.name = 'ChemError'
    this.pos = pos
  }
}

export interface ElementNode {
  kind: 'element'
  symbol: string
  count: number
}

export interface GroupNode {
  kind: 'group'
  items: ChemNode[]
  count: number
}

export type ChemNode = ElementNode | GroupNode

export interface Species {
  /** 化学计量系数（结晶水等部分可能 >1，如 ·5H2O） */
  coef: number
  nodes: ChemNode[]
  charge: number
  state?: 's' | 'l' | 'g' | 'aq'
  raw: string
}

/** 一条化学式 = 若干以 · 连接的部分（水合物的组成部分） */
export interface Formula {
  parts: Species[]
  raw: string
}

// ---------- 字符归一化 ----------

const SUB_DIGITS = '₀₁₂₃₄₅₆₇₈₉'

/** 把 Unicode 下标/上标转成 ^ 与普通数字，方便统一解析 */
export function normalizeChem(src: string): string {
  let out = ''
  for (const ch of src) {
    const di = SUB_DIGITS.indexOf(ch)
    if (di >= 0) {
      out += String(di)
      continue
    }
    if (ch === '⁺') {
      out += '^+'
      continue
    }
    if (ch === '⁻') {
      out += '^-'
      continue
    }
    const si = '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(ch)
    if (si >= 0) {
      // 上标数字：电荷的一部分（如 SO4²⁻ 已拆出 ⁻），也可能是下标误输
      out += String(si)
      continue
    }
    out += ch
  }
  return out.replace(/\*/g, '·').replace(/\s+/g, ' ').trim()
}

// ---------- 单个物种解析 ----------

interface Cursor {
  i: number
}

function parseCount(src: string, cur: Cursor): number {
  let num = ''
  while (cur.i < src.length && src[cur.i] >= '0' && src[cur.i] <= '9') {
    num += src[cur.i]
    cur.i++
  }
  return num === '' ? 1 : Number(num)
}

function parseNodes(src: string, cur: Cursor, stopAtParen: boolean): ChemNode[] {
  const items: ChemNode[] = []
  while (cur.i < src.length) {
    const c = src[cur.i]
    if (c === ')') {
      if (stopAtParen) break
      throw new ChemError('这里多了一个右括号「)」', cur.i)
    }
    if (c === '(') {
      cur.i++
      const inner = parseNodes(src, cur, true)
      if (src[cur.i] !== ')') {
        throw new ChemError('括号没有配对，缺少右括号「)」', cur.i)
      }
      cur.i++
      const count = parseCount(src, cur)
      items.push({ kind: 'group', items: inner, count })
      continue
    }
    if (/[A-Z]/.test(c)) {
      let sym = c
      cur.i++
      // 元素符号第二个字母为小写（如 Cl、Mg）
      if (cur.i < src.length && /[a-z]/.test(src[cur.i]) && sym.length === 1) {
        const two = sym + src[cur.i]
        if (ELEMENT_MAP.has(two)) {
          sym = two
          cur.i++
        }
      }
      if (!ELEMENT_MAP.has(sym)) {
        throw new ChemError(`「${sym}」不是有效的元素符号`, cur.i - sym.length)
      }
      const count = parseCount(src, cur)
      items.push({ kind: 'element', symbol: sym, count })
      continue
    }
    if (c === '^') {
      // 电荷交给外层处理
      break
    }
    if (c === '+' || c === '-') {
      break
    }
    throw new ChemError(`「${c}」不能出现在化学式这里`, cur.i)
  }
  return items
}

function nodeToCounts(nodes: ChemNode[], mul: number, map: Map<string, number>): void {
  for (const n of nodes) {
    if (n.kind === 'element') {
      map.set(n.symbol, (map.get(n.symbol) ?? 0) + n.count * mul)
    } else {
      nodeToCounts(n.items, mul * n.count, map)
    }
  }
}

/**
 * 学生常把电荷数字直接跟在符号后（Cu2+、SO42-）。
 * 判读规则：
 *  - 显式 ^ 永远优先；
 *  - 单元素物种（Cu2+、Fe3+、S2-）：尾随数字是电荷大小；
 *  - 多原子物种默认尾随数字是下标、正负号是 ±1 电荷（NH4+、NO3-）；
 *    但已知含氧酸根等按「下标+电荷」连写（SO42-、PO43-），查表识别。
 */
const POLYATOMIC_TRAILING_CHARGE: Record<string, number> = {
  'SO42-': -2,
  'SO42': -2,
  'SO32-': -2,
  'CO32-': -2,
  'PO43-': -3,
  'PO33-': -3,
  'Cr2O72-': -2,
  'C2O42-': -2,
}

function distinctUppercase(s: string): number {
  return new Set(s.match(/[A-Z]/g) ?? []).size
}

/** 解析一个物种（可带前导系数与电荷、状态） */
export function parseSpecies(raw0: string): Species {
  const rawRaw = raw0.trim()
  if (rawRaw === '') throw new ChemError('化学式是空的')
  let work = rawRaw

  // 1) 结尾状态标注 (s)(l)(g)(aq)
  let state: Species['state']
  const sm = work.match(/\((s|l|g|aq)\)$/i)
  if (sm !== null) {
    state = sm[1].toLowerCase() as Species['state']
    work = work.slice(0, sm.index)
  }

  // 2) 电荷
  let charge = 0
  let body = work
  const cm0 = body.match(/(\d*)([+-])$/)
  if (body.indexOf('^') === -1 && cm0 !== null && cm0[0] !== '') {
    const [, digits, sign] = cm0
    const prefix = body.slice(0, cm0.index)
    const sgn = sign === '+' ? 1 : -1
    if (digits === '') {
      charge = sgn
      body = prefix
    } else if (distinctUppercase(prefix) <= 1 && !prefix.includes('(')) {
      // 单元素：Cu2+ / Fe3+ / S2-
      charge = Number(digits) * sgn
      body = prefix
    } else {
      const known = POLYATOMIC_TRAILING_CHARGE[prefix + digits + sign]
      if (known !== undefined) {
        charge = known
        // 表键形如 SO42-：末位数字是电荷大小，其余数字是下标
        // → SO42- 解析为 SO₄ 带 2- 电荷
        body = digits.length > 1 ? prefix + digits.slice(0, -1) : prefix
      }
      // 否则数字当下标（NH4+、NO3-），电荷为 ±1 —— 交给正常解析
    }
  }

  const cur: Cursor = { i: 0 }
  const coef = parseCount(body, cur)
  const nodes = parseNodes(body, cur, false)

  if (cur.i < body.length && body[cur.i] === '^') {
    cur.i++
    let digits = ''
    while (cur.i < body.length && body[cur.i] >= '0' && body[cur.i] <= '9') {
      digits += body[cur.i]
      cur.i++
    }
    const signChar = body[cur.i]
    if (signChar !== '+' && signChar !== '-') {
      throw new ChemError('电荷要写成 ^2- 这样的形式（数字加正负号）', cur.i)
    }
    cur.i++
    charge = (digits === '' ? 1 : Number(digits)) * (signChar === '+' ? 1 : -1)
  } else if (cur.i < body.length && (body[cur.i] === '+' || body[cur.i] === '-')) {
    charge = body[cur.i] === '+' ? 1 : -1
    cur.i++
  }

  if (cur.i < body.length) {
    throw new ChemError(`「${body.slice(cur.i)}」多出来了，检查一下这里`, cur.i)
  }
  if (nodes.length === 0) {
    throw new ChemError('没有找到元素符号', 0)
  }

  return { coef, nodes, charge, state, raw: rawRaw }
}

/** 解析整条化学式（含 · 水合物） */
export function parseFormula(input: string): Formula {
  const norm = normalizeChem(input)
  if (norm === '') throw new ChemError('请先输入化学式')
  const parts = norm.split('·').map((seg) => seg.trim())
  return { parts: parts.map(parseSpecies), raw: norm }
}

// ---------- 统计 ----------

export interface ElementTally {
  symbol: string
  count: number
  massShare: number
}

/** 计算一条化学式的元素组成与相对分子质量（Mr） */
export function analyzeFormula(f: Formula): { tally: ElementTally[]; mr: number } {
  const map = new Map<string, number>()
  // 第一段前导系数是计量数（如 2H2O），不改变单个分子的 Mr
  f.parts.forEach((p, idx) => {
    const mul = idx === 0 ? 1 : p.coef
    nodeToCounts(p.nodes, mul, map)
  })
  let mr = 0
  for (const [sym, count] of map) {
    mr += (ELEMENT_MAP.get(sym)?.mass ?? 0) * count
  }
  const tally: ElementTally[] = [...map.entries()].map(([symbol, count]) => ({
    symbol,
    count,
    massShare: ((ELEMENT_MAP.get(symbol)?.mass ?? 0) * count) / mr,
  }))
  return { tally, mr }
}
