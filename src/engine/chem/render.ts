/**
 * 化学式 / 方程式 → LaTeX 与 Unicode 纯文本。
 * Unicode 输出使用真正的上下标字符（H₂O、SO₄²⁻），可直接粘贴到微信 / 文档。
 */

import type { ChemNode, Formula, Species } from './parse'
import type { ParsedEquation } from './equation'

function nodeLatex(n: ChemNode): string {
  if (n.kind === 'element') {
    return n.count === 1 ? n.symbol : `${n.symbol}_{${n.count}}`
  }
  const inner = n.items.map(nodeLatex).join('')
  const body = `(${inner})`
  return n.count === 1 ? body : `${body}_{${n.count}}`
}

function speciesLatex(sp: Species): string {
  let out = sp.coef > 1 ? String(sp.coef) : ''
  out += sp.nodes.map(nodeLatex).join('')
  if (sp.charge !== 0) {
    const mag = Math.abs(sp.charge)
    const sign = sp.charge > 0 ? '+' : '-'
    out += mag === 1 ? `^{${sign}}` : `^{${mag}${sign}}`
  }
  if (sp.state !== undefined) {
    out += `\\,(${sp.state})`
  }
  return out
}

export function formulaToLatex(f: Formula): string {
  return f.parts.map(speciesLatex).join('\\cdot ')
}

// ---------- Unicode ----------

const SUBS = '₀₁₂₃₄₅₆₇₈₉'
const SUPS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻',
}

function toSubNum(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUBS[Number(d)])
    .join('')
}

function toSup(s: string): string {
  return s
    .split('')
    .map((c) => SUPS[c] ?? c)
    .join('')
}

function nodeUnicode(n: ChemNode): string {
  if (n.kind === 'element') {
    return n.count === 1 ? n.symbol : `${n.symbol}${toSubNum(n.count)}`
  }
  const inner = n.items.map(nodeUnicode).join('')
  const body = `(${inner})`
  return n.count === 1 ? body : `${body}${toSubNum(n.count)}`
}

function speciesUnicode(sp: Species): string {
  let out = sp.coef > 1 ? String(sp.coef) : ''
  out += sp.nodes.map(nodeUnicode).join('')
  if (sp.charge !== 0) {
    const mag = Math.abs(sp.charge)
    const sign = sp.charge > 0 ? '+' : '-'
    out += toSup(mag === 1 ? sign : `${mag}${sign}`)
  }
  if (sp.state !== undefined) {
    out += `(${sp.state})`
  }
  return out
}

export function formulaToUnicode(f: Formula): string {
  return f.parts.map(speciesUnicode).join('·')
}

// ---------- 整条方程式 ----------

function eqSideLatex(eq: ParsedEquation['left']): string {
  return eq.items.map((it) => formulaToLatex(it.formula)).join(' + ')
}

export function equationToLatex(eq: ParsedEquation): string {
  let arrow: string
  if (eq.reversible) arrow = '\\rightleftharpoons'
  else if (eq.condition !== undefined && eq.condition !== '') {
    arrow = `\\xrightarrow{\\text{${eq.condition}}}`
  } else arrow = '\\rightarrow'
  return `${eqSideLatex(eq.left)} ${arrow} ${eqSideLatex(eq.right)}`
}

function eqSideUnicode(eq: ParsedEquation['left']): string {
  return eq.items.map((it) => formulaToUnicode(it.formula)).join(' + ')
}

export function equationToUnicode(eq: ParsedEquation): string {
  let arrow: string
  if (eq.reversible) arrow = '⇌'
  else if (eq.condition !== undefined && eq.condition !== '') {
    arrow = `→(${eq.condition})`
  } else arrow = '→'
  return `${eqSideUnicode(eq.left)} ${arrow} ${eqSideUnicode(eq.right)}`
}
