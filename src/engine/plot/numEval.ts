/**
 * 绘图用数值求值：把表达式编译成 f(x)。
 * 与计算器共享同一个词法/语法分析器，保证输入体验一致。
 * 绘图固定使用弧度制（数学作图惯例），界面有明确提示。
 */

import { parseExpression } from '../math/parser'
import { nodeToLatex } from '../math/latex'
import type { Node } from '../math/ast'

export class PlotError extends Error {}

const FN1: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  ln: Math.log,
  log: Math.log10,
  log2: Math.log2,
  exp: Math.exp,
  abs: Math.abs,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
}

function evalNumeric(n: Node, x: number): number {
  switch (n.t) {
    case 'num':
      return Number(n.raw)
    case 'const':
      return n.name === 'pi' ? Math.PI : n.name === 'e' ? Math.E : NaN
    case 'var':
      return x // 只允许 x，已在编译期校验
    case 'un':
      return -evalNumeric(n.arg, x)
    case 'bin': {
      const l = evalNumeric(n.l, x)
      const r = evalNumeric(n.r, x)
      switch (n.op) {
        case '+': return l + r
        case '-': return l - r
        case '*': return l * r
        case '/': return l / r
        case '^': {
          // 负底的分数次幂在实数绘图里按 NaN 处理（如 (-8)^(1/3) 不画）
          if (l < 0 && !Number.isInteger(r)) return NaN
          const v = Math.pow(l, r)
          return Number.isFinite(v) || Number.isNaN(v) ? v : NaN
        }
      }
      return NaN
    }
    case 'call': {
      const fn = FN1[n.fn]
      if (fn !== undefined) {
        if (n.args.length !== 1) return NaN
        return fn(evalNumeric(n.args[0], x))
      }
      if (n.fn === 'min' || n.fn === 'max') {
        const vals = n.args.map((a) => evalNumeric(a, x))
        return n.fn === 'min' ? Math.min(...vals) : Math.max(...vals)
      }
      return NaN
    }
    case 'fact': {
      const v = Math.round(evalNumeric(n.arg, x))
      if (v < 0 || v > 170 || !Number.isFinite(v)) return NaN
      let acc = 1
      for (let i = 2; i <= v; i++) acc *= i
      return acc
    }
    case 'pct':
      return evalNumeric(n.arg, x) / 100
    case 'deg': {
      void n
      return NaN // 度数标记在绘图中无意义
    }
  }
  return NaN
}

export interface CompiledPlotFn {
  /** 数值函数；定义域外返回 NaN / ±Infinity */
  fn: (x: number) => number
  latex: string | null
}

/** 编译一条 y=f(x)；只允许变量 x */
export function compilePlotFunction(src: string): CompiledPlotFn {
  const trimmed = src.trim()
  if (trimmed === '') throw new PlotError('表达式是空的')
  let ast: Node
  try {
    ast = parseExpression(trimmed)
  } catch (e) {
    throw new PlotError(e instanceof Error && e.message !== '' ? e.message : '表达式解析失败')
  }

  const vars = new Set<string>()
  collect(ast, vars)
  for (const v of vars) {
    if (v !== 'x') {
      throw new PlotError(`绘图只支持自变量 x，式子里出现了「${v}」喵`)
    }
  }

  const probe = evalNumeric(ast, 0.123456)
  if (Number.isNaN(probe)) {
    // 可能整条式子恒 NaN（比如写错了函数名），再探一个点确认
    const probe2 = evalNumeric(ast, 2.718281)
    if (Number.isNaN(probe2)) {
      throw new PlotError('这个式子算不出数值，检查一下函数名和括号喵')
    }
  }

  return {
    fn: (x: number) => evalNumeric(ast, x),
    latex: (() => {
      try {
        return nodeToLatex(ast)
      } catch {
        return null
      }
    })(),
  }
}

function collect(n: Node, out: Set<string>): void {
  switch (n.t) {
    case 'var':
      out.add(n.name)
      break
    case 'call':
      n.args.forEach((a) => collect(a, out))
      break
    case 'un':
      collect(n.arg, out)
      break
    case 'bin':
      collect(n.l, out)
      collect(n.r, out)
      break
    case 'fact':
    case 'pct':
    case 'deg':
      collect(n.arg, out)
      break
    default:
      break
  }
}
