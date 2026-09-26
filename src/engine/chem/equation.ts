/**
 * 化学方程式解析与自动配平。
 * 配平是「建议」：结果只展示给用户，由用户确认后应用，且可一键撤销。
 */

import { ELEMENT_MAP } from '../../data/elements'
import { ChemError, normalizeChem, parseFormula } from './parse'
import type { ChemNode, Formula } from './parse'

export interface EquationSide {
  /** raw 为原始物种文本，formula 为解析结构 */
  items: Array<{ raw: string; formula: Formula }>
}

export interface ParsedEquation {
  left: EquationSide
  right: EquationSide
  reversible: boolean
  condition?: string
  raw: string
}

// ---------- 物种切分（区分「+」分隔符与 Na+ 这类电荷） ----------

function isBoundary(ch: string | undefined): boolean {
  return ch === undefined || ch === ' '
}

/** 把一边按「 + 」切成多个物种字符串 */
export function splitSpeciesSide(side: string): string[] {
  const src = side.trim()
  const out: string[] = []
  let buf = ''
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if ((c === '+' || c === '-') && i > 0) {
      const prev = src[i - 1]
      const next = src[i + 1]
      // 前面是空格：一定是分隔符（如 "H2O + CO2"）
      if (prev === ' ') {
        out.push(buf.trim())
        buf = ''
        continue
      }
      // 紧贴结尾或后随状态括号：电荷（Na+、Cl-、Fe3+）
      if (isBoundary(next) || next === '(') {
        buf += c
        continue
      }
      // 后面紧跟别的字符（通常是大写元素开头）：分隔符（H2+O2）
      out.push(buf.trim())
      buf = ''
      continue
    }
    buf += c
  }
  const tail = buf.trim()
  if (tail !== '') out.push(tail)
  return out.filter((s) => s !== '')
}

function parseSide(side: string): EquationSide {
  const tokens = splitSpeciesSide(side)
  if (tokens.length === 0) throw new ChemError('方程式有一边是空的')
  return {
    items: tokens.map((t) => ({ raw: t, formula: parseFormula(t) })),
  }
}

const ARROW_RE = /(<=>|<->|⇌|->|→|=|＝)/

/** 解析整条方程式；箭头后可带条件，如 ->(点燃) 或 →(Δ) */
export function parseEquation(input: string): ParsedEquation {
  const norm = normalizeChem(input)
  const m = norm.match(ARROW_RE)
  if (m === null || m.index === undefined) {
    throw new ChemError('没有找到箭头：请用 -> 或 = 连接反应前后，如 H2+O2->H2O')
  }
  let cond: string | undefined
  let rest = norm.slice(m.index + m[0].length)
  const cm = rest.match(/^\s*\(([^)]*)\)/)
  if (cm !== null && !/^[slgaq]$/.test(cm[1].trim())) {
    cond = cm[1].trim()
    rest = rest.slice(cm[0].length)
  }

  return {
    left: parseSide(norm.slice(0, m.index)),
    right: parseSide(rest),
    reversible: m[0] === '<=>' || m[0] === '<->' || m[0] === '⇌',
    condition: cond,
    raw: norm,
  }
}

// ---------- 元素计数 ----------

/**
 * 统计一条化学式的元素数。
 * 第一段的前导系数视为用户写的计量数，不参与统计；· 后面的系数是结构的一部分（如 ·5H2O）。
 */
export function elementCounts(f: Formula): Map<string, number> {
  const map = new Map<string, number>()
  f.parts.forEach((p, idx) => {
    const mul = idx === 0 ? 1 : p.coef
    walk(p.nodes, mul, map)
  })
  return map
}

function walk(nodes: ChemNode[], mul: number, map: Map<string, number>): void {
  for (const n of nodes) {
    if (n.kind === 'element') {
      map.set(n.symbol, (map.get(n.symbol) ?? 0) + n.count * mul)
    } else {
      walk(n.items, mul * n.count, map)
    }
  }
}

// ---------- 配平（有理数高斯消元） ----------

interface Frac {
  n: number
  d: number
}

function gcd(a: number, b: number): number {
  while (b !== 0) {
    const t = a % b
    a = b
    b = t
  }
  return a === 0 ? 1 : a
}

function fr(n: number, d = 1): Frac {
  if (d < 0) {
    n = -n
    d = -d
  }
  const g = gcd(Math.abs(n), d)
  return { n: n / g, d: d / g }
}

function frSub(a: Frac, b: Frac): Frac {
  return fr(a.n * b.d - b.n * a.d, a.d * b.d)
}

function frMul(a: Frac, b: Frac): Frac {
  return fr(a.n * b.n, a.d * b.d)
}

/** 齐次矩阵 RREF，返回主元列 */
function rref(matrix: Frac[][], rows: number, cols: number): number[] {
  const pivots: number[] = []
  let r = 0
  for (let c = 0; c < cols && r < rows; c++) {
    let pivotRow = -1
    for (let rr = r; rr < rows; rr++) {
      if (matrix[rr][c].n !== 0) {
        pivotRow = rr
        break
      }
    }
    if (pivotRow === -1) continue
    const tmp = matrix[r]
    matrix[r] = matrix[pivotRow]
    matrix[pivotRow] = tmp

    // 主元行归一化
    const pv = matrix[r][c]
    for (let cc = 0; cc < cols; cc++) {
      matrix[r][cc] = frMul(matrix[r][cc], fr(pv.d, pv.n))
    }
    // 消去其余行
    for (let rr = 0; rr < rows; rr++) {
      if (rr !== r && matrix[rr][c].n !== 0) {
        const k = matrix[rr][c]
        for (let cc = 0; cc < cols; cc++) {
          matrix[rr][cc] = frSub(matrix[rr][cc], frMul(k, matrix[r][cc]))
        }
      }
    }
    pivots.push(c)
    r++
  }
  return pivots
}

export interface BalanceResult {
  /** 最小整数配平系数，顺序：左…右 */
  coeffs: number[]
}

/** 解出最小整数配平系数（不修改原方程式的展示，仅作为建议返回） */
export function balanceEquation(eq: ParsedEquation): BalanceResult {
  const all = [...eq.left.items, ...eq.right.items]
  const total = all.length
  if (total < 2) throw new ChemError('至少要有两种物质才能配平')

  // 每个物种的元素计数（忽略用户写的前导系数）
  const countsList = all.map(({ formula }) => {
    const map = elementCounts(formula)
    return map
  })

  const elemSet = new Set<string>()
  for (const m of countsList) {
    for (const k of m.keys()) elemSet.add(k)
  }
  if (all.some(({ formula }) => formula.parts.some((p) => p.charge !== 0))) {
    elemSet.add('__charge__')
  }

  const elems = [...elemSet]
  if (elems.length === 0) throw new ChemError('没有识别到任何元素')

  // 齐次矩阵：左正右负
  const matrix: Frac[][] = elems.map((el) =>
    all.map((_s, j) => {
      const isLeft = j < eq.left.items.length
      const v =
        el === '__charge__'
          ? all[j].formula.parts.reduce((acc, p) => acc + p.charge, 0)
          : (countsList[j].get(el) ?? 0)
      return fr(isLeft ? v : -v)
    })
  )

  const pivots = rref(matrix, elems.length, total)
  const freeCols: number[] = []
  for (let c = 0; c < total; c++) {
    if (!pivots.includes(c)) freeCols.push(c)
  }

  if (freeCols.length !== 1) {
    if (freeCols.length === 0) {
      throw new ChemError('这个方程式只有零解，检查一下反应物和生成物是不是写反了喵')
    }
    throw new ChemError('这个方程式不能唯一确定配平系数——可能有物质没写出来，先检查一下喵')
  }

  const free = freeCols[0]
  const solution: Frac[] = new Array(total)
  solution[free] = fr(1)
  pivots.forEach((col, rowIdx) => {
    solution[col] = fr(-matrix[rowIdx][free].n, matrix[rowIdx][free].d)
  })

  // 化为最小正整数
  let lcmD = 1
  for (const s of solution) lcmD = Math.round((lcmD * s.d) / gcd(lcmD, s.d))
  let ints = solution.map((s) => Math.round((s.n * lcmD) / s.d))
  let g = 0
  for (const v of ints) g = gcd(g, Math.abs(v))
  if (g > 1) ints = ints.map((v) => v / g)

  if (ints.some((v) => v === 0)) {
    throw new ChemError('有物质的系数算出来是 0，它可能不属于这个反应喵')
  }
  if (ints.some((v) => v < 0)) {
    if (ints.every((v) => v <= 0)) {
      ints = ints.map((v) => -v)
    } else {
      throw new ChemError('配平出现矛盾：检查一下某些物质是不是放错了边喵')
    }
  }

  return { coeffs: ints }
}

/** 元素与电荷守恒校验 */
export function checkConservation(eq: ParsedEquation, coeffs: number[]): boolean {
  const totals = new Map<string, number>()
  const add = (f: Formula, k: number) => {
    for (const [el, count] of elementCounts(f)) {
      totals.set(el, (totals.get(el) ?? 0) + count * k)
    }
    const q = f.parts.reduce((acc, p) => acc + p.charge, 0)
    if (q !== 0) totals.set('__charge__', (totals.get('__charge__') ?? 0) + q * k)
  }
  eq.left.items.forEach((it, j) => add(it.formula, coeffs[j]))
  // 右侧取负：守恒 = 左右相抵为零
  eq.right.items.forEach((it, j) =>
    add(it.formula, -coeffs[eq.left.items.length + j])
  )
  return [...totals.values()].every((v) => v === 0)
}

/** 元素符号合法性提示 */
export function unknownElementHint(symbol: string): string | undefined {
  if (!ELEMENT_MAP.has(symbol)) return `${symbol} 不是有效的元素符号`
  return undefined
}
