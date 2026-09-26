/**
 * 词法分析：把用户输入切成带位置的 Token。
 * 支持直接输入的数学符号：× ÷ − √ π ° ! % ^ 以及上标字符 ² ³ ⁻ 等。
 * 所有 Token 携带原文位置，用于错误定位。
 */
import { CalcError } from './errors'

export type TokType =
  | 'num'
  | 'ident'
  | 'op' // + - * / ^
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'bang' // !
  | 'percent' // %
  | 'deg' // °
  | 'sqrt' // √

export interface Tok {
  type: TokType
  /** num: 数字原文；ident: 字母串；op: 归一化后的运算符 */
  value: string
  /** 在原始输入中的起始下标 */
  pos: number
}

/** 单字符归一化表（长度保持 1:1，不破坏错误定位） */
const CHAR_MAP: Record<string, string> = {
  '×': '*',
  '⋅': '*',
  '·': '*',
  '∙': '*',
  '÷': '/',
  '∕': '/',
  '−': '-',
  '–': '-',
  '＋': '+',
  '－': '-',
  '＊': '*',
  '／': '/',
  '（': '(',
  '）': ')',
  '［': '[',
  '］': ']',
  '｛': '{',
  '｝': '}',
  '，': ',',
  '．': '.',
}

const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁻': '-',
  '⁺': '+',
}

export function tokenize(input: string): Tok[] {
  const src = Array.from(input) // 按 Unicode 码点切分
  const toks: Tok[] = []
  let i = 0

  const push = (type: TokType, value: string, pos: number) => {
    toks.push({ type, value, pos })
  }

  while (i < src.length) {
    let c = src[i]

    if (/\s/.test(c)) {
      i++
      continue
    }

    // 单字符归一化
    const mapped = CHAR_MAP[c]
    if (mapped !== undefined && mapped !== c) {
      c = mapped
    }

    // 数字（含小数、科学计数法）
    if (
      /[0-9]/.test(c) ||
      (c === '.' && i + 1 < src.length && /[0-9]/.test(src[i + 1]))
    ) {
      const start = i
      let s = ''
      while (i < src.length && /[0-9.]/.test(src[i])) {
        s += src[i]
        i++
      }
      // 科学计数法：e/E 后紧跟数字，或 符号+数字
      if (
        i < src.length &&
        /[eE]/.test(src[i]) &&
        ((i + 1 < src.length && /[0-9]/.test(src[i + 1])) ||
          (i + 2 < src.length && /[+-]/.test(src[i + 1]) && /[0-9]/.test(src[i + 2])))
      ) {
        let exp = 'e'
        i++ // 吃掉 e/E
        if (src[i] === '+' || src[i] === '-') {
          if (src[i] === '-') exp += '-'
          i++
        }
        while (i < src.length && /[0-9]/.test(src[i])) {
          exp += src[i]
          i++
        }
        s += exp
      }
      push('num', s, start)
      continue
    }

    // 上标序列 → ^(±数字)
    if (SUPERSCRIPTS[c] !== undefined) {
      const start = i
      let digits = ''
      while (i < src.length && SUPERSCRIPTS[src[i]] !== undefined) {
        digits += SUPERSCRIPTS[src[i]]
        i++
      }
      if (digits === '' || digits === '-' || digits === '+') {
        throw new CalcError('上标内容不完整', start)
      }
      push('op', '^', start)
      push('lparen', '(', start)
      push('num', digits, start)
      push('rparen', ')', start)
      continue
    }

    // 字母串（π 视作常量 pi）
    if (/[a-zA-Zπ]/.test(c)) {
      const start = i
      let s = ''
      while (i < src.length && /[a-zA-Zπ]/.test(src[i])) {
        s += src[i] === 'π' ? 'pi' : src[i]
        i++
      }
      push('ident', s, start)
      continue
    }

    switch (c) {
      case '+':
      case '-':
      case '*':
      case '/':
      case '^':
        push('op', c, i)
        break
      case '(':
        push('lparen', c, i)
        break
      case ')':
        push('rparen', c, i)
        break
      case ',':
        push('comma', c, i)
        break
      case '!':
        push('bang', c, i)
        break
      case '%':
        push('percent', c, i)
        break
      case '°':
        push('deg', c, i)
        break
      case '√':
        push('sqrt', c, i)
        break
      default:
        throw new CalcError(`这里出现了无法识别的符号「${c}」`, i)
    }
    i++
  }

  return toks
}
