import { useMemo, useRef, useState } from 'react'
import {
  parseFormula,
  analyzeFormula,
  ChemError,
} from '../engine/chem/parse'
import { formulaToLatex, formulaToUnicode } from '../engine/chem/render'
import {
  parseEquation,
  balanceEquation,
  checkConservation,
  splitSpeciesSide,
} from '../engine/chem/equation'
import type { ParsedEquation } from '../engine/chem/equation'
import { equationToLatex, equationToUnicode } from '../engine/chem/render'
import Katex from '../components/Katex'
import ChemCalculators from '../components/chem/ChemCalculators'
import ChemKeyboard from '../components/chem/ChemKeyboard'
import { copyText, useToast } from '../store/toast'
import { useSettings } from '../store/settings'
import {
  chemFormulaAIText,
  chemEquationAIText,
  COPY_OK_MSG,
} from '../engine/text/ai-text'

type ChemTab = 'editor' | 'calc'

const ARROW_RE = /(<=>|<->|⇌|->|→|=|＝)/

function buildSnippet(input: string, pos: number): string {
  const chars = Array.from(input)
  const idx = Math.min(Math.max(pos, 0), chars.length)
  return `${chars.join('')}\n${' '.repeat(idx)}^── 这里附近`
}

interface BalanceSuggestion {
  coeffs: number[]
  appliedText: string
}

/** 把配平系数写回方程式文本（替换各物种原有的前导系数） */
function applyCoeffsToRaw(eq: ParsedEquation, coeffs: number[], raw: string): string {
  const arrowMatch = raw.match(ARROW_RE)
  if (arrowMatch === null || arrowMatch.index === undefined) return raw
  let rightStr = raw.slice(arrowMatch.index + arrowMatch[0].length)
  const condMatch = rightStr.match(/^\s*\(([^)]*)\)/)
  let condPrefix = ''
  if (condMatch !== null && !/^[slgaq]$/.test(condMatch[1].trim())) {
    condPrefix = condMatch[0]
    rightStr = rightStr.slice(condMatch[0].length)
  }

  const rebuild = (side: string, startIdx: number): string =>
    splitSpeciesSide(side)
      .map((t, i) => {
        const stripped = t.replace(/^\d+/, '')
        return `${coeffs[startIdx + i]}${stripped}`
      })
      .join(' + ')

  const newLeft = rebuild(raw.slice(0, arrowMatch.index), 0)
  const newRight = rebuild(rightStr.trim(), eq.left.items.length)
  return `${newLeft} ${arrowMatch[0]}${condPrefix} ${newRight}`
}

export default function ChemView() {
  const [tab, setTab] = useState<ChemTab>('editor')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      <div className="seg" role="tablist" aria-label="化学工具">
        <button type="button" role="tab" aria-selected={tab === 'editor'} onClick={() => setTab('editor')}>
          化学式 / 方程式
        </button>
        <button type="button" role="tab" aria-selected={tab === 'calc'} onClick={() => setTab('calc')}>
          🧮 计算器
        </button>
      </div>
      {tab === 'editor' ? <ChemEditor /> : <ChemCalculators />}
    </div>
  )
}

function ChemEditor() {
  const [input, setInput] = useState('')
  const [suggestion, setSuggestion] = useState<BalanceSuggestion | null>(null)
  const [keypadVisible, setKeypadVisible] = useState(true)
  const undoRef = useRef<string | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const showToast = useToast((s) => s.show)
  const copyMode = useSettings((s) => s.copyMode)

  // ---------- 解析 ----------
  const parsed = useMemo(() => {
    if (input.trim() === '') return { kind: 'empty' as const }
    try {
      if (ARROW_RE.test(input)) {
        const eq = parseEquation(input)
        return { kind: 'equation' as const, eq }
      }
      const f = parseFormula(input)
      const { tally, mr } = analyzeFormula(f)
      return { kind: 'formula' as const, f, tally, mr }
    } catch (e) {
      if (e instanceof ChemError) return { kind: 'error' as const, error: e }
      return { kind: 'error' as const, error: new ChemError('这个化学式暂时解析不了喵') }
    }
  }, [input])

  // ---------- 编辑 ----------
  const applyEdit = (next: string, caret?: number) => {
    setInput(next)
    requestAnimationFrame(() => {
      const pos = caret ?? next.length
      taRef.current?.setSelectionRange(pos, pos)
    })
  }

  const insert = (text: string) => {
    setSuggestion(null)
    const el = taRef.current
    const start = el?.selectionStart ?? input.length
    const end = el?.selectionEnd ?? input.length
    applyEdit(input.slice(0, start) + text + input.slice(end), start + text.length)
  }

  /** 反应条件：自动吸附到最近一个箭头之后（替换旧条件） */
  const insertCondition = (word: string) => {
    setSuggestion(null)
    const m = input.match(ARROW_RE)
    if (m === null || m.index === undefined) {
      // 还没有箭头：先补一个标准箭头再挂条件
      insert(` -> (${word}) `)
      return
    }
    const after = m.index + m[0].length
    const rest = input.slice(after)
    const cm = rest.match(/^\s*\(([^)]*)\)/)
    const isState = cm !== null && /^[slgaq]$/.test(cm[1].trim())
    const tail = cm !== null && !isState ? rest.slice(cm[0].length) : rest
    const next = input.slice(0, after) + `(${word})` + tail
    applyEdit(next, after + word.length + 2)
  }

  // ---------- 配平建议（仅建议，应用后可撤销） ----------
  const makeSuggestion = () => {
    if (parsed.kind !== 'equation') return
    try {
      const { coeffs } = balanceEquation(parsed.eq)
      const ok = checkConservation(parsed.eq, coeffs)
      if (!ok) throw new ChemError('配平结果没有通过守恒校验，先检查输入喵')
      const applied = applyCoeffsToRaw(parsed.eq, coeffs, input)
      setSuggestion({ coeffs, appliedText: applied })
    } catch (e) {
      if (e instanceof ChemError) {
        setSuggestion(null)
        showToast(e.message)
      }
    }
  }

  const applySuggestion = () => {
    if (suggestion === null) return
    undoRef.current = input
    setInput(suggestion.appliedText)
    setSuggestion(null)
  }

  const undoApply = () => {
    if (undoRef.current !== null) {
      setInput(undoRef.current)
      undoRef.current = null
    }
  }

  // ---------- 三层表示 ----------
  const unicode =
    parsed.kind === 'formula'
      ? formulaToUnicode(parsed.f)
      : parsed.kind === 'equation'
        ? equationToUnicode(parsed.eq)
        : ''
  const latex =
    parsed.kind === 'formula'
      ? formulaToLatex(parsed.f)
      : parsed.kind === 'equation'
        ? equationToLatex(parsed.eq)
        : ''

  const doCopy = () => {
    let text: string
    if (copyMode === 'latex') {
      text = latex
    } else if (copyMode === 'unicode') {
      text = unicode
    } else {
      text =
        parsed.kind === 'equation'
          ? chemEquationAIText(input)
          : chemFormulaAIText(input)
    }
    void copyText(text, copyMode === 'ai' ? COPY_OK_MSG : '已复制')
  }

  const hasResult = parsed.kind === 'formula' || parsed.kind === 'equation'

  return (
    <div className="fx-wrap">
      {/* 所见即所得大预览（核心对象永远是正常化学式） */}
      <div className={`fx-preview-box fx-hero ${hasResult ? '' : 'fx-hero-empty'}`} data-testid="chem-preview">
        {hasResult ? (
          <Katex latex={latex} />
        ) : parsed.kind === 'error' ? (
          <span className="fx-hero-hint">↑ 先在下面把化学式写对喵</span>
        ) : (
          <span className="fx-hero-hint">H₂SO₄、Fe³⁺、CH₄ + O₂ → CO₂…点下面键盘，或直接打字</span>
        )}
      </div>

      {/* 源码输入（保留普通键盘通道） */}
      <div className="fx-editor-box">
        <textarea
          ref={taRef}
          className="fx-textarea"
          rows={2}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setSuggestion(null)
          }}
          placeholder={'直接打字也可以：H2SO4、SO42-、Al2(SO4)3\n方程式：CH4 + O2 ->(点燃) CO2 + H2O'}
          aria-label="化学式输入"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          onFocus={() => setKeypadVisible(true)}
        />
      </div>

      {/* 解析错误 */}
      {parsed.kind === 'error' && input.trim() !== '' && (
        <div className="fx-error" role="alert">
          {parsed.error.message}
          {parsed.error.pos !== undefined && (
            <pre className="calc-error-snippet">{buildSnippet(input, parsed.error.pos)}</pre>
          )}
        </div>
      )}

      {/* 专业化学键盘 */}
      <div className={`keypad-pop ${keypadVisible ? 'keypad-visible' : ''}`}>
        <ChemKeyboard onInsert={insert} onCondition={insertCondition} />
      </div>

      {/* 化学式信息 */}
      {parsed.kind === 'formula' && (
        <div className="panel chem-panel">
          <div className="chem-mr">
            相对分子质量 Mr ={' '}
            <strong style={{ fontFamily: 'var(--font-num)' }}>
              {Number.isInteger(parsed.mr) ? String(parsed.mr) : parsed.mr.toFixed(2)}
            </strong>
          </div>
          <table className="chem-table">
            <thead>
              <tr>
                <th scope="col">元素</th>
                <th scope="col">个数</th>
                <th scope="col">质量分数</th>
              </tr>
            </thead>
            <tbody>
              {parsed.tally.map((t) => (
                <tr key={t.symbol}>
                  <td>{t.symbol}</td>
                  <td style={{ fontFamily: 'var(--font-num)' }}>{t.count}</td>
                  <td>
                    <span className="chem-bar-wrap">
                      <span
                        className="chem-bar"
                        style={{ width: `${Math.max(3, Math.round(t.massShare * 100))}%` }}
                      />
                      <span className="chem-bar-label">{(t.massShare * 100).toFixed(1)}%</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 配平建议 */}
      {parsed.kind === 'equation' &&
        (suggestion !== null ? (
          <div className="panel chem-suggest" role="status">
            <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>
              ⚖ 配平建议（{suggestion.coeffs.join(' : ')}）
            </p>
            <div className="fx-preview-box" style={{ marginBottom: '0.625rem' }}>
              <Katex latex={(() => {
                try {
                  return equationToLatex(parseEquation(suggestion.appliedText))
                } catch {
                  return ''
                }
              })()} />
            </div>
            <p className="chem-ok" style={{ margin: '0 0 0.625rem' }}>
              ✓ 已校验：元素与电荷守恒
            </p>
            <div className="fx-actions">
              <button type="button" className="btn btn-primary" onClick={applySuggestion}>
                应用到输入框
              </button>
              <button type="button" className="btn" onClick={() => setSuggestion(null)}>
                忽略
              </button>
            </div>
          </div>
        ) : (
          <div className="fx-actions">
            <button type="button" className="btn btn-primary" onClick={makeSuggestion}>
              ⚖ 给我配平建议
            </button>
          </div>
        ))}

      {undoRef.current !== null && suggestion === null && parsed.kind === 'equation' && (
        <button type="button" className="btn" onClick={undoApply} style={{ alignSelf: 'flex-start' }}>
          ↶ 撤销刚才的配平应用
        </button>
      )}

      {/* 一键复制 */}
      {hasResult && (
        <div className="fx-actions">
          <button type="button" className="btn btn-primary ck-copy" onClick={doCopy}>
            📋 复制{copyMode === 'latex' ? ' LaTeX' : copyMode === 'unicode' ? ' 文本' : '（AI 可读）'}
          </button>
        </div>
      )}
    </div>
  )
}
