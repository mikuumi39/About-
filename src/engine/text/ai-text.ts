/**
 * 统一「AI 纯文本」转换层。
 *
 * 三层模型：Human Display（KaTeX/Unicode）→ Semantic（引擎内部字符串）→ AI Plain Text。
 * 用户永远只按一个「复制」，本模块负责把内部表示转成 AI 最容易理解的文本：
 *   数学: 1/2 + sqrt(2)、x^2 + 2*x + 1 = 0
 *   化学: H2SO4、SO4^2-、NH4+
 *   方程式: 2H2 + O2 -> 2H2O
 */

// ---------- 数学 ----------

const FUNCS = [
  'asin', 'acos', 'atan', 'sin', 'cos', 'tan',
  'sqrt', 'cbrt', 'abs', 'ln', 'log', 'ncr', 'npr',
] as const

type Tok =
  | { t: 'num'; v: string }
  | { t: 'id'; v: string } // 单字母变量 / pi / e / i / x
  | { t: 'fn'; v: string }
  | { t: 'op'; v: string }
  | { t: 'paren'; v: '(' | ')' }
  | { t: 'comma' }

function tokenizeMath(src: string): Tok[] {
  const s = src.replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/∛/g, 'cbrt')
  const toks: Tok[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === ' ') {
      i++
      continue
    }
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < s.length && /[0-9.]/.test(s[j])) j++
      // 角度后缀 ° 粘在数字上
      let v = s.slice(i, j)
      if (s[j] === '°') {
        v += '°'
        j++
      }
      toks.push({ t: 'num', v })
      i = j
      continue
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++
      const word = s.slice(i, j)
      const fn = (FUNCS as readonly string[]).find((f) => word === f)
      if (fn !== undefined) toks.push({ t: 'fn', v: fn })
      else if (word === 'pi' || word === 'mod') toks.push({ t: 'id', v: word })
      else {
        // 未知字母串按单字符拆开（x、i、e 等）
        for (const ch of word) toks.push({ t: 'id', v: ch })
      }
      i = j
      continue
    }
    if (c === '(' || c === ')') {
      toks.push({ t: 'paren', v: c })
      i++
      continue
    }
    if (c === ',') {
      toks.push({ t: 'comma' })
      i++
      continue
    }
    toks.push({ t: 'op', v: c })
    i++
  }
  return toks
}

/** 因子类 token：可以与右侧因子隐式相乘的左操作数 */
function isFactorEnd(t: Tok): boolean {
  return t.t === 'num' || (t.t === 'id' && t.v !== 'pi') || (t.t === 'paren' && t.v === ')')
}
function isFactorStart(t: Tok): boolean {
  return t.t === 'num' || t.t === 'id' || t.t === 'fn' || (t.t === 'paren' && t.v === '(')
}

/**
 * 计算器内部表达式 → AI 可读纯文本。
 * 例："1/2+√2" → "1/2 + sqrt(2)"；"2x+3=7" → "2*x + 3 = 7"
 */
export function mathAIText(expr: string): string {
  const toks = tokenizeMath(expr)
  const out: string[] = []
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]
    if (k > 0 && isFactorEnd(toks[k - 1]) && isFactorStart(t)) {
      out.push('*')
    }
    switch (t.t) {
      case 'fn': {
        // 函数名后若无括号，把后面的主参数包起来：sqrt 25 → sqrt(25)
        const next = toks[k + 1]
        if (next !== undefined && !(next.t === 'paren' && next.v === '(')) {
          // 收集一个主参数：数字（含°）/ 标识符
          if (next !== undefined && (next.t === 'num' || next.t === 'id')) {
            out.push(t.v + '(' + next.v + ')')
            k++
            break
          }
        }
        out.push(t.v)
        break
      }
      case 'num':
      case 'id':
        out.push(t.v)
        break
      case 'paren':
        out.push(t.v)
        break
      case 'comma':
        out.push(', ')
        break
      case 'op': {
        if ('+-='.includes(t.v) && out.length > 0) out.push(' ' + t.v + ' ')
        else out.push(t.v)
        break
      }
    }
  }
  return out.join('').replace(/\s+/g, ' ').trim()
}

// ---------- 化学 ----------

const SUB_MAP: Record<string, string> = Object.fromEntries(
  '₀₁₂₃₄₅₆₇₈₉'.split('').map((c, i) => [c, String(i)])
)
const SUP_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-',
}

/** 把展示层的 Unicode 下标/上标还原成 ASCII（兜底用） */
export function chemDisplayToAscii(display: string): string {
  let out = ''
  let supBuf = ''
  const flushSup = () => {
    if (supBuf !== '') {
      out += '^' + supBuf
      supBuf = ''
    }
  }
  for (const ch of display) {
    if (SUB_MAP[ch] !== undefined) {
      flushSup()
      out += SUB_MAP[ch]
    } else if (SUP_MAP[ch] !== undefined) {
      supBuf += SUP_MAP[ch]
    } else {
      flushSup()
      out += ch
    }
  }
  flushSup()
  return out
}

import { parseFormula } from '../chem/parse'
import type { ChemNode, Species } from '../chem/parse'

function nodeAscii(n: ChemNode): string {
  if (n.kind === 'element') return n.count === 1 ? n.symbol : `${n.symbol}${n.count}`
  const inner = n.items.map(nodeAscii).join('')
  return n.count === 1 ? `(${inner})` : `(${inner})${n.count}`
}

function speciesAscii(sp: Species): string {
  let out = sp.coef > 1 ? String(sp.coef) : ''
  out += sp.nodes.map(nodeAscii).join('')
  if (sp.charge !== 0) {
    const mag = Math.abs(sp.charge)
    const sign = sp.charge > 0 ? '+' : '-'
    out += mag === 1 ? `^${sign}` : `^${mag}${sign}`
  }
  if (sp.state !== undefined) out += `(${sp.state})`
  return out
}

/** 化学式 → AI 文本：H₂SO₄ 显示 → H2SO4；SO₄²⁻ → SO4^2- */
export function chemFormulaAIText(raw: string): string {
  try {
    const f = parseFormula(raw)
    return f.parts.map(speciesAscii).join('·')
  } catch {
    return chemDisplayToAscii(raw)
  }
}

function sideAscii(raw: string): string {
  return raw
    .split('+')
    .map((s) => chemFormulaAIText(s.trim()))
    .join(' + ')
}

/** 方程式 → AI 文本：2H₂ + O₂ ⇌ 2H₂O 显示 → 2H2 + O2 <-> 2H2O */
export function chemEquationAIText(raw: string): string {
  const m = raw.match(/(<=>|<->|⇌|->|→|=|＝)/)
  if (m === null || m.index === undefined) return chemFormulaAIText(raw)
  const reversible = ['<=>', '<->', '⇌'].includes(m[0])
  const arrow = reversible ? ' <-> ' : ' -> '
  const cond = raw.slice(m.index + m[0].length).match(/^\s*\(([^)]*)\)/)
  // 反应条件属于展示信息，AI 文本里省略
  const rightRaw = cond !== null ? raw.slice(m.index + m[0].length + cond[0].length) : raw.slice(m.index + m[0].length)
  return `${sideAscii(raw.slice(0, m.index).trim())}${arrow}${sideAscii(rightRaw.trim())}`
}

export type AICopyKind = 'math' | 'chem' | 'equation'

export interface AICopyVariants {
  ai: string
  unicode: string
  latex: string
}

/** 复制成功提示语（产品固定口吻） */
export const COPY_OK_MSG = '已复制，可直接粘贴给 AI 喵 ฅ(≧▽≦)ฅ'
