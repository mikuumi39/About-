/**
 * LaTeX → Unicode 纯文本转换。
 * 用途：把公式编辑器的内容复制成能直接粘贴到微信 / QQ / 文档 / AI 的文本。
 * 转换遵循「尽力而为」：无法用 Unicode 表示的结构退化为可读形式（如 ^(1/2)、下标原样），
 * 绝不产生乱码或静默丢失内容。
 */

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ',
  tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
  Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
}

const OPERATORS: Record<string, string> = {
  times: '×', cdot: '·', div: '÷', pm: '±', mp: '∓',
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈',
  equiv: '≡', sim: '∽', cong: '≌', propto: '∝',
  infty: '∞', angle: '∠', perp: '⊥', parallel: '∥', mid: '|',
  because: '∵', therefore: '∴',
  cup: '∪', cap: '∩', subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇',
  in: '∈', notin: '∉', ni: '∋',
  emptyset: '∅', varnothing: '∅',
  forall: '∀', exists: '∃',
  neg: '¬', land: '∧', lor: '∨',
  Rightarrow: '⇒', rightarrow: '→', longrightarrow: '⟶',
  Leftarrow: '⇐', leftarrow: '←',
  Leftrightarrow: '⇔', leftrightarrow: '↔',
  uparrow: '↑', downarrow: '↓', updownarrow: '↕',
  mapsto: '↦',
  prime: '′',
  degree: '°', circ: '°',
  ldots: '…', cdots: '⋯', dots: '…',
  partial: '∂', nabla: '∇',
  sum: '∑', prod: '∏', int: '∫', iint: '∬', iiint: '∭',
  lim: 'lim',
  max: 'max', min: 'min',
  sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', sec: 'sec', csc: 'csc',
  arcsin: 'arcsin', arccos: 'arccos', arctan: 'arctan',
  ln: 'ln', log: 'log', lg: 'lg', exp: 'exp',
}

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵',
  '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻',
  '=': '⁼', '(': '⁽', ')': '⁾',
  a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ',
  i: 'ⁱ', j: 'ʲ', k: 'ᵏ', l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ',
  r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ',
}

const SUBSCRIPTS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ',
  m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ',
  u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
}

interface Cursor {
  i: number
}

function readGroup(src: string, cur: Cursor): string {
  // 读取一个「参数」：{...} 或单字符或命令
  while (cur.i < src.length && src[cur.i] === ' ') cur.i++
  if (cur.i >= src.length) return ''
  const c = src[cur.i]
  if (c === '{') {
    cur.i++
    let depth = 1
    let out = ''
    while (cur.i < src.length && depth > 0) {
      const ch = src[cur.i]
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) break
      }
      out += ch
      cur.i++
    }
    cur.i++ // 跳过 }
    return out
  }
  if (c === '\\') {
    const cmd = readCommand(src, cur)
    return cmd.raw
  }
  cur.i++
  return c
}

function readCommand(src: string, cur: Cursor): { name: string; raw: string } {
  // cur.i 指向反斜杠
  let j = cur.i + 1
  if (j < src.length && !/[a-zA-Z]/.test(src[j])) {
    const raw = src.slice(cur.i, j + 1)
    cur.i = j + 1
    return { name: src[j], raw }
  }
  while (j < src.length && /[a-zA-Z]/.test(src[j])) j++
  const raw = src.slice(cur.i, j)
  const name = src.slice(cur.i + 1, j)
  cur.i = j
  return { name, raw }
}

function toSuper(s: string): string {
  const chars = Array.from(s)
  if (chars.every((ch) => SUPERSCRIPTS[ch] !== undefined)) {
    return chars.map((ch) => SUPERSCRIPTS[ch]).join('')
  }
  return `^(${s})`
}

function toSub(s: string): string {
  const chars = Array.from(s)
  if (chars.every((ch) => SUBSCRIPTS[ch] !== undefined)) {
    return chars.map((ch) => SUBSCRIPTS[ch]).join('')
  }
  return `_(${s})`
}

/** 递归转换一段 LaTeX */
function convert(src: string, cur: Cursor, stopAtBrace = false): string {
  let out = ''
  while (cur.i < src.length) {
    const c = src[cur.i]
    if (c === '}') {
      if (stopAtBrace) break
      cur.i++
      continue
    }
    if (c === '{') {
      cur.i++
      out += convert(src, cur, true)
      if (cur.i < src.length && src[cur.i] === '}') cur.i++
      continue
    }
    if (c === '\\') {
      const { name } = readCommand(src, cur)
      switch (name) {
        case 'frac':
        case 'dfrac':
        case 'tfrac': {
          const a = readGroup(src, cur)
          const b = readGroup(src, cur)
          out += `(${convert(a, { i: 0 })})/(${convert(b, { i: 0 })})`
          break
        }
        case 'sqrt': {
          // 可选的 [n] 次根
          let idx = ''
          if (src[cur.i] === '[') {
            const close = src.indexOf(']', cur.i)
            idx = src.slice(cur.i + 1, close)
            cur.i = close + 1
          }
          const bodyRaw = readGroup(src, cur)
          const body = convert(bodyRaw, { i: 0 })
          out += idx === '' ? `√(${body})` : `${convert(idx, { i: 0 })}次根号(${body})`
          break
        }
        case 'binom': {
          const a = readGroup(src, cur)
          const b = readGroup(src, cur)
          out += `C(${convert(a, { i: 0 })},${convert(b, { i: 0 })})`
          break
        }
        case 'begin': {
          // 矩阵/环境：退化为可读文本 [a，b；c，d]
          readGroup(src, cur) // 环境名 {pmatrix} 等
          let body = ''
          while (cur.i < src.length && !src.startsWith('\\end', cur.i)) {
            body += src[cur.i]
            cur.i++
          }
          if (src.startsWith('\\end', cur.i)) {
            cur.i += 4
            readGroup(src, cur) // 吃掉 {pmatrix}
          }
          const rows = body
            .split(/\\\\|\\cr/)
            .map((r) =>
              r
                .split('&')
                .map((cell) => convert(cell, { i: 0 }).trim())
                .join('，')
            )
            .filter((r) => r.replace(/[\s]/g, '') !== '')
          out += `[${rows.join('；')}]`
          break
        }
        case 'text':
        case 'mathrm': {
          const body = readGroup(src, cur)
          out += body
          break
        }
        case 'left':
        case 'right': {
          // 吃掉后面的定界符字符
          if (cur.i < src.length && src[cur.i] !== '\\') cur.i++
          else if (src[cur.i] === '\\') readCommand(src, cur)
          break
        }
        case '\\':
          out += '\n'
          break
        default: {
          const g = GREEK[name]
          if (g !== undefined) {
            out += g
            break
          }
          const op = OPERATORS[name]
          if (op !== undefined) {
            // lim/sum 等若带上下标，后面统一处理；此处直接输出
            out += op
            break
          }
          // 未知命令：去掉反斜杠保留名称
          out += name
        }
      }
      continue
    }
    if (c === '^' || c === '_') {
      cur.i++
      const arg = readGroup(src, cur)
      const converted = convert(arg, { i: 0 })
      out += c === '^' ? toSuper(converted) : toSub(converted)
      continue
    }
    if (c === '&') {
      cur.i++
      out += '  '
      continue
    }
    out += c
    cur.i++
  }
  return out
}

/** 把 LaTeX 源串转成可读的 Unicode 文本 */
export function latexToUnicode(latex: string): string {
  try {
    return convert(latex, { i: 0 })
      .replace(/ {2,}/g, '  ')
      .trim()
  } catch {
    return latex
  }
}
