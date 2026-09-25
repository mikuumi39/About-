/**
 * 计算器「智能按键」：根据当前光标 / 选区决定插入结果。
 *
 * - 函数键（sin、√…）：无选区 → 插入 f() 且光标进括号；有选区 → 包裹成 f(选区)
 * - x²：有选区 → (选区)^2；无选区 → 追加 ^2
 * - xʸ：有选区 → (选区)^()；无选区 → ^() 光标进指数
 */

export interface SmartResult {
  next: string
  caret: number
}

type FuncKind = 'sqrt' | 'cbrt' | 'abs'

const FUNC_TEXT: Record<FuncKind, { open: string; close: string }> = {
  sqrt: { open: '√(', close: ')' },
  cbrt: { open: '∛(', close: ')' },
  abs: { open: 'abs(', close: ')' },
}

/** 具名数学函数（引擎语法：名字 + 括号） */
export function wrapFunction(
  input: string,
  selStart: number,
  selEnd: number,
  name: string
): SmartResult {
  if (selStart !== selEnd) {
    const next = `${input.slice(0, selStart)}${name}(${input.slice(selStart, selEnd)})${input.slice(selEnd)}`
    return { next, caret: selStart + name.length + 1 + (selEnd - selStart) + 1 }
  }
  const next = `${input.slice(0, selStart)}${name}()${input.slice(selEnd)}`
  return { next, caret: selStart + name.length + 1 }
}

export function smartKey(
  input: string,
  selStart: number,
  selEnd: number,
  kind: FuncKind | 'square' | 'power'
): SmartResult {
  if (kind === 'square') {
    if (selStart !== selEnd) {
      const next = `${input.slice(0, selStart)}(${input.slice(selStart, selEnd)})^2${input.slice(selEnd)}`
      return { next, caret: selStart + (selEnd - selStart) + 4 }
    }
    const next = `${input.slice(0, selStart)}^2${input.slice(selEnd)}`
    return { next, caret: selStart + 2 }
  }
  if (kind === 'power') {
    if (selStart !== selEnd) {
      const next = `${input.slice(0, selStart)}(${input.slice(selStart, selEnd)})^()${input.slice(selEnd)}`
      return { next, caret: selStart + (selEnd - selStart) + 4 }
    }
    const next = `${input.slice(0, selStart)}^()${input.slice(selEnd)}`
    return { next, caret: selStart + 2 }
  }
  const { open, close } = FUNC_TEXT[kind]
  if (selStart !== selEnd) {
    const next = `${input.slice(0, selStart)}${open}${input.slice(selStart, selEnd)}${close}${input.slice(selEnd)}`
    return { next, caret: selStart + open.length + (selEnd - selStart) + close.length }
  }
  const next = `${input.slice(0, selStart)}${open}${close}${input.slice(selEnd)}`
  return { next, caret: selStart + open.length }
}

/** 统计光标前未闭合的左括号数 */
export function unclosedParens(input: string, upto: number): number {
  let depth = 0
  for (let i = 0; i < Math.min(upto, input.length); i++) {
    const c = input[i]
    if (c === '(') depth++
    else if (c === ')') depth--
  }
  return depth
}

/** 补齐末尾缺失的右括号（按 = 时自动闭合） */
export function autoCompleteParens(input: string): string {
  const depth = unclosedParens(input, input.length)
  return depth > 0 ? input + ')'.repeat(depth) : input
}
