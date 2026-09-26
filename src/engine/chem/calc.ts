/**
 * 化学计算器：物质的量 / 溶液浓度 / pH。
 * 全部为纯函数，输入输出带单位语义，错误用中文说明原因。
 */

import { parseFormula, analyzeFormula } from './parse'

const NA = 6.02e23 // 阿伏加德罗常数（高中取值）
const VM_STP = 22.4 // 标况气体摩尔体积 L/mol
const KW = 1e-14 // 25 ℃ 水的离子积

function requirePositive(v: number, name: string): number {
  if (!Number.isFinite(v)) throw new Error(`${name}要填一个数字喵`)
  if (v <= 0) throw new Error(`${name}必须大于 0`)
  return v
}

function requireNonNeg(v: number, name: string): number {
  if (!Number.isFinite(v)) throw new Error(`${name}要填一个数字喵`)
  if (v < 0) throw new Error(`${name}不能小于 0`)
  return v
}

// ---------- 物质的量 ----------

/** 相对分子质量（Mr，数值上等于摩尔质量 g/mol） */
export function molarMassOf(formula: string): number {
  const f = parseFormula(formula)
  const { mr } = analyzeFormula(f)
  if (!(mr > 0)) throw new Error('这个化学式算不出相对分子质量喵')
  return mr
}

/** n = m / M */
export function molFromMass(massG: number, molarMass: number): number {
  requireNonNeg(massG, '质量')
  requirePositive(molarMass, '摩尔质量')
  return massG / molarMass
}

/** m = n × M */
export function massFromMol(n: number, molarMass: number): number {
  requireNonNeg(n, '物质的量')
  requirePositive(molarMass, '摩尔质量')
  return n * molarMass
}

/** N = n × NA（粒子个数） */
export function particlesFromMol(n: number): number {
  requireNonNeg(n, '物质的量')
  return n * NA
}

/** 标况气体体积 V = n × 22.4 L/mol */
export function gasVolumeSTP(n: number): number {
  requireNonNeg(n, '物质的量')
  return n * VM_STP
}

// ---------- 溶液浓度 ----------

/** 物质的量浓度 c = n / V(aq) */
export function molarity(n: number, volumeL: number): number {
  requireNonNeg(n, '物质的量')
  requirePositive(volumeL, '溶液体积')
  return n / volumeL
}

/** 质量分数 w = 溶质质量 / 溶液质量 × 100% */
export function massFraction(massSoluteG: number, massSolutionG: number): number {
  requireNonNeg(massSoluteG, '溶质质量')
  requirePositive(massSolutionG, '溶液质量')
  if (massSoluteG > massSolutionG) {
    throw new Error('溶质质量不能大于溶液总质量喵')
  }
  return massSoluteG / massSolutionG
}

/** 稀释（或浓缩）守恒 c1V1 = c2V2：填三个求第四个，未知项传 null */
export function dilute(vals: {
  c1?: number | null
  v1?: number | null
  c2?: number | null
  v2?: number | null
}): { missing: 'c1' | 'v1' | 'c2' | 'v2'; value: number } {
  const entries = Object.entries(vals)
  const unknown = entries.filter(([, v]) => v === null || v === undefined)
  if (unknown.length !== 1) {
    throw new Error('请恰好留一个空格填「?」，其他三项都要有数字喵')
  }
  const missing = unknown[0][0] as 'c1' | 'v1' | 'c2' | 'v2'
  const g = (k: 'c1' | 'v1' | 'c2' | 'v2') => {
    const v = vals[k]
    if (v === null || v === undefined) throw new Error('数字缺失喵')
    return requirePositive(v, k)
  }
  switch (missing) {
    case 'c1':
      return { missing, value: (g('c2') * g('v2')) / g('v1') }
    case 'v1':
      return { missing, value: (g('c2') * g('v2')) / g('c1') }
    case 'c2':
      return { missing, value: (g('c1') * g('v1')) / g('v2') }
    default:
      return { missing, value: (g('c1') * g('v1')) / g('c2') }
  }
}

// ---------- pH ----------

/** pH = −lg c(H⁺)，c 单位 mol/L */
export function phFromH(hConc: number): number {
  requirePositive(hConc, '氢离子浓度')
  if (hConc > 1e3 || hConc < 1e-16) {
    throw new Error('氢离子浓度超出常见范围，检查一下单位是不是 mol/L 喵')
  }
  const ph = -Math.log10(hConc)
  return Math.round(ph * 100) / 100
}

/** c(H⁺) = 10^(−pH) */
export function hFromPh(ph: number): number {
  requireNonNeg(ph, 'pH')
  if (ph > 16) throw new Error('pH 超过 16 了，检查一下数值喵')
  return Math.pow(10, -ph)
}

/** c(OH⁻) 由 pH：先 c(H⁺)=10^(−pH)，再除以 Kw */
export function ohFromPh(ph: number): number {
  return KW / hFromPh(ph)
}

// ---------- 组合示例：由质量求粒子数等 ----------

/** 由质量直接求粒子数 N = (m/M)×NA */
export function particlesFromMass(massG: number, formula: string): { n: number; mr: number; count: number } {
  const mr = molarMassOf(formula)
  const n = molFromMass(massG, mr)
  return { n, mr, count: particlesFromMol(n) }
}
