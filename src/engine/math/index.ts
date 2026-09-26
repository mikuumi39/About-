/**
 * 简算 · 数学引擎门面
 * UI 层只需要 import { compute, solveInput, parseExpression, evalNode }
 */
import type { Display } from './format'
import { formatVal } from './format'
import { inputToLatex, nodeToLatex } from './latex'
import { parseExpression } from './parser'
import { evalNode } from './eval'
import { solveInput } from './solve'
import { CalcError, type AngleMode, type Val } from './value'

export interface CalcValueOutcome {
  kind: 'value'
  value: Val
  display: Display
  latex: string | null
}

export interface CalcSolveOutcome {
  kind: 'solve'
  latex: string | null
  rows: Array<{ label: string; main: string; exact?: string; plain: string }>
  note?: string
}

export type CalcOutcome = CalcValueOutcome | CalcSolveOutcome

export interface ComputeOptions {
  angle: AngleMode
  /** 小数位数（2–12） */
  places?: number
}

function hasTopLevelEquals(input: string): boolean {
  let depth = 0
  for (const ch of input) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === '=' && depth === 0) return true
  }
  return false
}

/** 计算或求解：含顶层等号走求解，否则走求值 */
export function compute(input: string, opts: ComputeOptions): CalcOutcome {
  const trimmed = input.trim()
  if (trimmed === '') {
    throw new CalcError('请先输入算式')
  }
  const places = opts.places ?? 9

  const ast = (() => {
    try {
      return parseExpression(trimmed)
    } catch {
      return null // 含等号时解析器无法处理，交由求解器
    }
  })()

  if (ast !== null && !hasTopLevelEquals(trimmed)) {
    const value = evalNode(ast, { angle: opts.angle })
    return {
      kind: 'value',
      value,
      display: formatVal(value, places),
      latex: nodeToLatex(ast),
    }
  }

  const result = solveInput(trimmed, opts.angle)
  return {
    kind: 'solve',
    rows: result.rows,
    note: result.note,
    latex: inputToLatex(trimmed, parseExpression),
  }
}

export { parseExpression, evalNode, solveInput, formatVal, CalcError }
export type { AngleMode, Val, Display }
