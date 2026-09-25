import { useState } from 'react'
import { ELEMENTS } from '../../data/elements'

/**
 * 专业化学输入键盘：
 * 常用元素 → 全部元素 → 下标数字 → 电荷/括号结构 → 方程式符号与条件 → 高频基团。
 * 所有按键只负责「往光标处插入机器文本」，所见即所得渲染交给上层。
 */

const COMMON = ['H', 'C', 'N', 'O', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'K', 'Ca', 'Fe', 'Cu', 'Zn']

const CHARGES: Array<{ label: string; ins: string }> = [
  { label: '⁻', ins: '^-' },
  { label: '⁺', ins: '^+' },
  { label: '²⁻', ins: '^2-' },
  { label: '³⁻', ins: '^3-' },
  { label: '²⁺', ins: '^2+' },
  { label: '³⁺', ins: '^3+' },
]

const IONS: Array<{ label: string; ins: string }> = [
  { label: 'OH⁻', ins: 'OH^-' },
  { label: 'NH₄⁺', ins: 'NH4^+' },
  { label: 'NO₃⁻', ins: 'NO3^-' },
  { label: 'SO₄²⁻', ins: 'SO4^2-' },
  { label: 'CO₃²⁻', ins: 'CO3^2-' },
  { label: 'HCO₃⁻', ins: 'HCO3^-' },
  { label: 'Cl⁻', ins: 'Cl^-' },
  { label: 'Na⁺', ins: 'Na^+' },
  { label: 'K⁺', ins: 'K^+' },
  { label: 'Ca²⁺', ins: 'Ca^2+' },
  { label: 'Mg²⁺', ins: 'Mg^2+' },
  { label: 'Fe²⁺', ins: 'Fe^2+' },
  { label: 'Fe³⁺', ins: 'Fe^3+' },
  { label: 'Cu²⁺', ins: 'Cu^2+' },
]

const CONDITIONS = ['点燃', '加热', 'Δ', '高温', '催化剂', '电解', '通电', 'MnO2']

export default function ChemKeyboard({
  onInsert,
  onCondition,
}: {
  /** 插入普通文本到光标处 */
  onInsert: (text: string) => void
  /** 插入反应条件：自动吸附到最近箭头之后 */
  onCondition: (word: string) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const [showCond, setShowCond] = useState(false)

  return (
    <div className="chem-kbd" role="group" aria-label="化学输入键盘">
      {/* 元素 */}
      <div className="ck-section">
        <span className="ck-label">元素</span>
        <div className="ck-row ck-elems">
          {COMMON.map((s) => (
            <button key={s} type="button" className="ck-key ck-el" onClick={() => onInsert(s)}>
              {s}
            </button>
          ))}
          <button
            type="button"
            className={`ck-key ck-toggle ${showAll ? 'on' : ''}`}
            aria-expanded={showAll}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? '收起' : '全部'}
          </button>
        </div>
        {showAll && (
          <div className="ck-row ck-elems ck-all" role="list" aria-label="全部元素">
            {ELEMENTS.map((e) => (
              <button
                key={e.symbol}
                type="button"
                className="ck-key ck-el ck-el-sm"
                title={e.zh}
                onClick={() => onInsert(e.symbol)}
              >
                {e.symbol}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 下标数字 */}
      <div className="ck-section">
        <span className="ck-label">下标</span>
        <div className="ck-row">
          {'0123456789'.split('').map((d) => (
            <button key={d} type="button" className="ck-key" onClick={() => onInsert(d)}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* 电荷 / 结构 */}
      <div className="ck-section">
        <span className="ck-label">电荷 · 括号</span>
        <div className="ck-row">
          {CHARGES.map((c) => (
            <button key={c.ins} type="button" className="ck-key ck-charge" onClick={() => onInsert(c.ins)}>
              {c.label}
            </button>
          ))}
          <button type="button" className="ck-key" aria-label="左括号" onClick={() => onInsert('(')}>
            (
          </button>
          <button type="button" className="ck-key" aria-label="右括号" onClick={() => onInsert(')')}>
            )
          </button>
          <button type="button" className="ck-key" title="结晶水" onClick={() => onInsert('·')}>
            ·
          </button>
        </div>
      </div>

      {/* 方程式 */}
      <div className="ck-section">
        <span className="ck-label">方程式</span>
        <div className="ck-row">
          <button type="button" className="ck-key ck-wide" title="生成箭头" onClick={() => onInsert(' -> ')}>
            →
          </button>
          <button type="button" className="ck-key ck-wide" title="可逆反应" onClick={() => onInsert(' <=> ')}>
            ⇌
          </button>
          <button type="button" className="ck-key" title="气体符号" onClick={() => onInsert('(g)')}>
            ↑
          </button>
          <button type="button" className="ck-key" title="沉淀符号" onClick={() => onInsert('(s)')}>
            ↓
          </button>
          <button type="button" className="ck-key" onClick={() => onInsert(' + ')}>
            +
          </button>
          <button
            type="button"
            className={`ck-key ck-wide ${showCond ? 'on' : ''}`}
            aria-expanded={showCond}
            onClick={() => setShowCond((v) => !v)}
          >
            条件
          </button>
        </div>
        {showCond && (
          <div className="ck-row ck-cond">
            {CONDITIONS.map((w) => (
              <button key={w} type="button" className="ck-key ck-cond-btn" onClick={() => onCondition(w)}>
                {w}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 高频基团 / 离子 */}
      <div className="ck-section">
        <span className="ck-label">常用离子</span>
        <div className="ck-row ck-ions">
          {IONS.map((ion) => (
            <button key={ion.ins} type="button" className="ck-key ck-ion" title={ion.ins} onClick={() => onInsert(ion.ins)}>
              {ion.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
