import { useState } from 'react'
import {
  molFromMass,
  particlesFromMol,
  gasVolumeSTP,
  molarity,
  massFraction,
  dilute,
  phFromH,
  hFromPh,
  ohFromPh,
  molarMassOf,
} from '../../engine/chem/calc'

const SUPS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻',
}

/** 结果数字格式化：中庸位数，超大/超小转 ×10ⁿ */
export function fmtNum(x: number, sig = 6): string {
  if (!Number.isFinite(x)) return '—'
  if (x === 0) return '0'
  const ax = Math.abs(x)
  if (ax >= 1e6 || ax < 1e-4) {
    const exp = x.toExponential(sig - 1)
    const [m, e] = exp.split('e')
    const mantissa = m.replace(/\.?0+$/, '')
    const ee = e.replace('+', '')
    return `${mantissa}×10${ee
      .split('')
      .map((c) => SUPS[c] ?? c)
      .join('')}`
  }
  let s = x.toPrecision(sig)
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  return s
}

function NumField(props: {
  label: string
  unit?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="cc-field">
      <span className="cc-label">
        {props.label}
        {props.unit !== undefined && <small>（{props.unit}）</small>}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder ?? ''}
        autoComplete="off"
      />
    </label>
  )
}

function readNum(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function Result({ children }: { children: React.ReactNode }) {
  return (
    <div className="cc-result" role="status">
      {children}
    </div>
  )
}

function ToolCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel cc-tool">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

export default function ChemCalculators() {
  // 工具 A：质量 → 物质的量 → 粒子数 / 气体体积
  const [massA, setMassA] = useState('')
  const [formulaA, setFormulaA] = useState('')
  const [mrA, setMrA] = useState('')
  const [isGas, setIsGas] = useState(false)

  const resultA = (() => {
    const m = readNum(massA)
    if (m === null || m < 0) return null
    try {
      const mr =
        mrA.trim() !== '' ? readNum(mrA) ?? NaN : formulaA.trim() !== '' ? molarMassOf(formulaA) : NaN
      if (!Number.isFinite(mr) || mr <= 0) return null
      const n = molFromMass(m, mr)
      return { n, mr, count: particlesFromMol(n), vol: gasVolumeSTP(n) }
    } catch {
      return null
    }
  })()

  // 工具 B：物质的量浓度
  const [nb, setNb] = useState('')
  const [vb, setVb] = useState('')
  const resultB = (() => {
    const n = readNum(nb)
    const v = readNum(vb)
    if (n === null || v === null || v <= 0) return null
    try {
      return molarity(n, v)
    } catch {
      return null
    }
  })()

  // 工具 C：质量分数
  const [soluteC, setSoluteC] = useState('')
  const [solutionC, setSolutionC] = useState('')
  const resultC = (() => {
    const ms = readNum(soluteC)
    const ml = readNum(solutionC)
    if (ms === null || ml === null || ml <= 0) return null
    try {
      return massFraction(ms, ml)
    } catch {
      return null
    }
  })()

  // 工具 D：稀释
  const [diluteVals, setDiluteVals] = useState({ c1: '', v1: '', c2: '', v2: '' })
  const resultD = (() => {
    const parsed = Object.fromEntries(
      Object.entries(diluteVals).map(([k, v]) => [
        k,
        v.trim() === '' || v.trim() === '?' ? null : readNum(v),
      ])
    ) as Record<'c1' | 'v1' | 'c2' | 'v2', number | null>
    try {
      return dilute(parsed)
    } catch {
      return null
    }
  })()

  // 工具 E：pH
  const [phE, setPhE] = useState('')
  const [hE, setHE] = useState('')
  const phFromHField = (() => {
    const h = readNum(hE)
    if (h === null) return null
    try {
      return phFromH(h)
    } catch {
      return null
    }
  })()
  const hFromPhField = (() => {
    const p = readNum(phE)
    if (p === null) return null
    try {
      return hFromPh(p)
    } catch {
      return null
    }
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <ToolCard title="① 质量 → 物质的量 → 粒子数">
        <div className="cc-fields">
          <NumField label="质量 m" unit="g" value={massA} onChange={setMassA} placeholder="如 9" />
          <NumField label="化学式" value={formulaA} onChange={setFormulaA} placeholder="如 H2O，可留空" />
          <NumField label="或直接填摩尔质量 M" unit="g/mol" value={mrA} onChange={setMrA} placeholder="18 可手填" />
        </div>
        {resultA !== null && (
          <Result>
            <div>
              n = <strong>{fmtNum(resultA.n)}</strong> mol
              <span className="cc-sub">（M = {fmtNum(resultA.mr)} g/mol）</span>
            </div>
            <div>
              粒子数 N ≈ <strong>{fmtNum(resultA.count)}</strong> 个
            </div>
            {isGas && (
              <div>
                标况气体体积 V = <strong>{fmtNum(resultA.vol)}</strong> L（22.4 L/mol）
              </div>
            )}
          </Result>
        )}
        <label className="cc-gas" style={{ marginTop: '0.375rem' }}>
          <input type="checkbox" checked={isGas} onChange={(e) => setIsGas(e.target.checked)} />
          这是气体，需要标况体积
        </label>
      </ToolCard>

      <ToolCard title="② 物质的量浓度 c = n ÷ V">
        <div className="cc-fields">
          <NumField label="物质的量 n" unit="mol" value={nb} onChange={setNb} />
          <NumField label="溶液体积 V" unit="L" value={vb} onChange={setVb} />
        </div>
        {resultB !== null && (
          <Result>
            c = <strong>{fmtNum(resultB)}</strong> mol/L
          </Result>
        )}
      </ToolCard>

      <ToolCard title="③ 质量分数 w">
        <div className="cc-fields">
          <NumField label="溶质质量" unit="g" value={soluteC} onChange={setSoluteC} />
          <NumField label="溶液总质量" unit="g" value={solutionC} onChange={setSolutionC} />
        </div>
        {resultC !== null && (
          <Result>
            w = <strong>{fmtNum(resultC * 100)}%</strong>
          </Result>
        )}
      </ToolCard>

      <ToolCard title="④ 稀释守恒 c₁V₁ = c₂V₂（留空想要求的项）">
        <div className="cc-fields cc-four">
          {(['c1', 'v1', 'c2', 'v2'] as const).map((k) => (
            <NumField
              key={k}
              label={`${k.startsWith('c') ? '浓度' : '体积'} ${k.replace(/(\d)$/, '₁₂'.charAt(Number(k.slice(1)) - 1))}`}
              unit={k.startsWith('c') ? 'mol/L' : 'L'}
              value={diluteVals[k]}
              onChange={(v) => setDiluteVals((s) => ({ ...s, [k]: v }))}
              placeholder="?"
            />
          ))}
        </div>
        {resultD !== null && (
          <Result>
            {resultD.missing.startsWith('c') ? 'c' : 'V'}
            {resultD.missing.replace(/(\d)$/, '₁₂'.charAt(Number(resultD.missing.slice(1)) - 1))} ={' '}
            <strong>{fmtNum(resultD.value)}</strong> {resultD.missing.startsWith('c') ? 'mol/L' : 'L'}
          </Result>
        )}
      </ToolCard>

      <ToolCard title="⑤ pH ↔ c(H⁺) ↔ c(OH⁻)">
        <div className="cc-fields">
          <NumField label="已知 pH，求浓度" value={phE} onChange={setPhE} placeholder="如 3" />
          <NumField label="已知 c(H⁺)，求 pH" unit="mol/L" value={hE} onChange={setHE} placeholder="如 0.001 或 1e-3" />
        </div>
        {(hFromPhField !== null || phFromHField !== null) && (
          <Result>
            {hFromPhField !== null && (
              <div>
                c(H⁺) = <strong>{fmtNum(hFromPhField)}</strong> mol/L，
                c(OH⁻) = <strong>{fmtNum(ohFromPh(Number(phE)))}</strong> mol/L
              </div>
            )}
            {phFromHField !== null && (
              <div>
                pH = <strong>{fmtNum(phFromHField)}</strong>
              </div>
            )}
          </Result>
        )}
      </ToolCard>

      <p className="calc-hint">NA 取 6.02×10²³/mol；标况气体摩尔体积取 22.4 L/mol；Kw 取 1×10⁻¹⁴（25 ℃）。</p>
    </div>
  )
}
