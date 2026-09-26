import { useState } from 'react'
import { REFERENCE_SECTIONS } from '../data/reference'

type Filter = 'all' | 'math-const' | 'phys-chem-const' | 'greek' | 'units'

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'math-const', label: '数学常数' },
  { id: 'phys-chem-const', label: '理化常数' },
  { id: 'greek', label: '希腊字母' },
  { id: 'units', label: '单位换算' },
]

/** 学习工具：速查参考数据（全部离线内置） */
export default function LearnView() {
  const [filter, setFilter] = useState<Filter>('all')
  const sections =
    filter === 'all' ? REFERENCE_SECTIONS : REFERENCE_SECTIONS.filter((s) => s.id === filter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      <div className="sym-cats" role="tablist" aria-label="参考分类">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className="sym-cat-chip"
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {sections.map((sec) => (
        <section key={sec.id} className="panel learn-card">
          <h3 className="learn-title">
            {sec.emoji !== undefined && <span aria-hidden="true">{sec.emoji} </span>}
            {sec.title}
          </h3>
          <table className="chem-table">
            <tbody>
              {sec.items.map((it, i) => (
                <tr key={i}>
                  <td className="learn-label">{it.label}</td>
                  <td className="learn-value">
                    {it.value}
                    {it.note !== undefined && <small className="cc-sub">　{it.note}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <p className="calc-hint" style={{ padding: '0.125rem 0.25rem 0.5rem' }}>
        这些速查数据完全离线，考试前翻一翻喵。需要更系统的教程？公式库（公式页）里有按章节整理的常用公式。
      </p>
    </div>
  )
}
