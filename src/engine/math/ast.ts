/** 抽象语法树节点 */

export type BinOp = '+' | '-' | '*' | '/' | '^'

export type Node =
  | { t: 'num'; raw: string; pos: number }
  | { t: 'var'; name: string; pos: number }
  | { t: 'const'; name: 'pi' | 'e' | 'i'; pos: number }
  | { t: 'call'; fn: string; args: Node[]; pos: number }
  | { t: 'un'; op: '-' | '+'; arg: Node; pos: number }
  | { t: 'bin'; op: BinOp; l: Node; r: Node; pos: number }
  | { t: 'fact'; arg: Node; pos: number }
  | { t: 'pct'; arg: Node; pos: number }
  | { t: 'deg'; arg: Node; pos: number }

/** 收集表达式中的所有变量名 */
export function collectVars(n: Node, out: Set<string> = new Set()): Set<string> {
  switch (n.t) {
    case 'num':
    case 'const':
      break
    case 'var':
      out.add(n.name)
      break
    case 'call':
      n.args.forEach((a) => collectVars(a, out))
      break
    case 'un':
      collectVars(n.arg, out)
      break
    case 'bin':
      collectVars(n.l, out)
      collectVars(n.r, out)
      break
    case 'fact':
    case 'pct':
    case 'deg':
      collectVars(n.arg, out)
      break
  }
  return out
}
