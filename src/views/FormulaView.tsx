import { useEffect, useRef, useState } from 'react'
import Katex from '../components/Katex'
import { latexToUnicode } from '../engine/text/latex-unicode'
import { FORMULA_LIBRARY } from '../data/formulas'
import { useCalcBridge } from '../store/calcBridge'
import { copyText, useToast } from '../store/toast'
import { useSettings } from '../store/settings'
import { mathAIText, COPY_OK_MSG } from '../engine/text/ai-text'
import { navigate } from '../nav'
import '../styles/formula.css'

/** 空格触发的快捷词（可预测：只有「完整单词 + 空格」才会替换） */
const WORD_SHORTCUTS: Record<string, string> = {
  sqrt: '\\sqrt{}',
  pi: '\\pi',
  alpha: '\\alpha',
  beta: '\\beta',
  gamma: '\\gamma',
  delta: '\\delta',
  theta: '\\theta',
  lambda: '\\lambda',
  mu: '\\mu',
  sigma: '\\sigma',
  phi: '\\phi',
  omega: '\\omega',
  Delta: '\\Delta',
  oo: '\\infty',
  deg: '^{\\circ}',
  sum: '\\sum_{i=1}^{n}',
  int: '\\int_{a}^{b}',
  lim: '\\lim_{n \\to \\infty}',
  vec: '\\vec{}',
}

interface StructChip {
  label: string
  latex: string
  title?: string
}

const STRUCT_ROW1: StructChip[] = [
  { label: 'a/b', latex: '\\frac{}{}', title: '分数' },
  { label: '√', latex: '\\sqrt{}', title: '根号' },
  { label: 'xⁿ', latex: '^{}', title: '上标' },
  { label: 'xₙ', latex: '_{}', title: '下标' },
  { label: '|x|', latex: '\\left|\\right|', title: '绝对值' },
  { label: '∑', latex: '\\sum_{i=1}^{n}', title: '求和' },
  { label: '∫', latex: '\\int_{a}^{b}', title: '积分' },
  { label: 'lim', latex: '\\lim_{n \\to \\infty}', title: '极限' },
]

const STRUCT_ROW2: StructChip[] = [
  { label: '( )', latex: '\\left(\\right)', title: '自适应括号' },
  { label: 'vec→', latex: '\\vec{}', title: '向量箭头' },
  { label: '矩阵', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', title: '2×2 矩阵' },
  { label: '°', latex: '^{\\circ}', title: '角度' },
  { label: '±', latex: '\\pm', title: '正负' },
  { label: '×', latex: '\\times', title: '乘' },
  { label: '÷', latex: '\\div', title: '除' },
  { label: '≤', latex: '\\leq' },
  { label: '≥', latex: '\\geq' },
  { label: '≠', latex: '\\neq' },
  { label: '∈', latex: '\\in' },
  { label: '∪', latex: '\\cup' },
  { label: '∩', latex: '\\cap' },
  { label: '⊆', latex: '\\subseteq' },
  { label: '⇒', latex: '\\Rightarrow' },
  { label: '⇔', latex: '\\Leftrightarrow' },
  { label: 'α β γ', latex: '\\alpha\\beta\\gamma' },
]

function useDraft() {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem('jiansuan.formula-draft') ?? ''
    } catch {
      return ''
    }
  })
  const timer = useRef<number>(0)
  const setDraft = (v: string) => {
    setValue(v)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      try {
        localStorage.setItem('jiansuan.formula-draft', v)
      } catch {
        /* 忽略存储失败 */
      }
    }, 300)
  }
  return [value, setDraft] as const
}

export default function FormulaView() {
  const [value, setValue] = useDraft()
  const taRef = useRef<HTMLTextAreaElement>(null)
  const undoStack = useRef<string[]>([])
  const redoStack = useRef<string[]>([])
  const [render, setRender] = useState<{ html: string; error: boolean }>({ html: '', error: false })
  const show = useToast((s) => s.show)
  const copyFmt = useSettings((s) => s.copyMode)

  // ---------- 渲染 ----------
  useEffect(() => {
    let alive = true
    if (value.trim() === '') {
      setRender({ html: '', error: false })
      return
    }
    import('katex').then((katex) => {
      if (!alive) return
      try {
        const html = katex.default.renderToString(value, {
          displayMode: true,
          throwOnError: true,
        })
        setRender({ html, error: false })
      } catch {
        setRender({ html: '', error: true })
      }
    })
    return () => {
      alive = false
    }
  }, [value])

  // ---------- 编辑原语 ----------
  const applyValue = (next: string, caret: number) => {
    setValue(next)
    requestAnimationFrame(() => {
      taRef.current?.setSelectionRange(caret, caret)
    })
  }

  const pushUndo = () => {
    undoStack.current.push(value)
    if (undoStack.current.length > 150) undoStack.current.shift()
    redoStack.current = []
  }

  const insertLatex = (snippet: string) => {
    const el = taRef.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    pushUndo()
    const sel = value.slice(start, end)
    // 模板中的第一对空 {} 放置选中内容或光标
    const emptyIdx = snippet.indexOf('{}')
    let next: string
    let caret: number
    if (emptyIdx >= 0 && sel !== '') {
      // 把选中内容填进第一对花括号内（保留两侧括号）
      const fillAt = emptyIdx + 1
      const filled = snippet.slice(0, fillAt) + sel + snippet.slice(fillAt)
      next = value.slice(0, start) + filled + value.slice(end)
      caret = start + fillAt + sel.length
    } else if (emptyIdx >= 0) {
      next = value.slice(0, start) + snippet + value.slice(end)
      caret = start + emptyIdx + 1
    } else {
      next = value.slice(0, start) + snippet + value.slice(end)
      caret = start + snippet.length
    }
    applyValue(next, caret)
    taRef.current?.focus()
  }

  /** 键盘快捷输入：/ ^ _ 变结构（有选中内容则包裹，行为完全可预测） */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      const prev = undoStack.current.pop()
      if (prev !== undefined) {
        redoStack.current.push(value)
        applyValue(prev, prev.length)
      }
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault()
      const next = redoStack.current.pop()
      if (next !== undefined) {
        undoStack.current.push(value)
        applyValue(next, next.length)
      }
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return

    if (e.key === '/') {
      e.preventDefault()
      insertLatex('\\frac{}{}')
      return
    }
    if (e.key === '^') {
      e.preventDefault()
      insertLatex('^{}')
      return
    }
    if (e.key === '_') {
      e.preventDefault()
      insertLatex('_{}')
      return
    }
  }

  /** 空格触发快捷词替换 */
  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    pushUndo()
    const caret = e.target.selectionStart ?? v.length
    // 仅当刚敲的是空格时检查快捷词
    if (caret > 0 && v[caret - 1] === ' ') {
      let wordStart = caret - 1
      while (wordStart > 0 && /[a-zA-Z]/.test(v[wordStart - 1])) wordStart--
      // 前面是反斜杠说明用户在写 LaTeX 命令（如 \pi），不替换
      if (v[wordStart - 1] !== '\\') {
        const word = v.slice(wordStart, caret - 1)
        const expansion = WORD_SHORTCUTS[word]
        if (expansion !== undefined && word !== '') {
          const next = v.slice(0, wordStart) + expansion + v.slice(caret)
          const emptyIdx = expansion.indexOf('{}')
          const newCaret =
            emptyIdx >= 0 ? wordStart + emptyIdx + 1 : wordStart + expansion.length
          applyValue(next, newCaret)
          return
        }
      }
    }
    setValue(v)
  }

  // ---------- 工具动作 ----------
  const doUndoBtn = () => {
    const prev = undoStack.current.pop()
    if (prev !== undefined) {
      redoStack.current.push(value)
      applyValue(prev, prev.length)
    }
  }
  const doRedoBtn = () => {
    const next = redoStack.current.pop()
    if (next !== undefined) {
      undoStack.current.push(value)
      applyValue(next, next.length)
    }
  }

  const sendToCalc = () => {
    if (value.trim() === '') return
    useCalcBridge.getState().send(latexToUnicode(value))
    navigate('calc')
  }

  return (
    <div className="fx-wrap">
      {/* 结构插入工具条 */}
      <div className="fx-toolbar" role="toolbar" aria-label="公式结构插入">
        <div className="fx-row">
          {STRUCT_ROW1.map((c) => (
            <button key={c.label} type="button" className="fx-chip" title={c.title} onClick={() => insertLatex(c.latex)}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="fx-row">
          {STRUCT_ROW2.map((c) => (
            <button key={c.title ?? c.label} type="button" className="fx-chip" title={c.title} onClick={() => insertLatex(c.latex)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* 输入区 */}
      <div className="fx-editor-box">
        <textarea
          ref={taRef}
          className="fx-textarea"
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={'直接写 LaTeX 公式，例如 \\frac{a+b}{c}\n快捷词后加空格自动展开：sqrt pi alpha sum int lim …'}
          aria-label="公式源码输入"
          spellCheck={false}
        />
        <div className="fx-meta-row">
          <span className="fx-hint">
            快捷键：<code>/</code> 分数 · <code>^</code> 上标 · <code>_</code> 下标（选中内容会被包进去）
            · Ctrl+Z 撤销
          </span>
          <div className="fx-actions">
            <button type="button" className="btn" onClick={doUndoBtn} aria-label="撤销">
              ↶
            </button>
            <button type="button" className="btn" onClick={doRedoBtn} aria-label="重做">
              ↷
            </button>
            <button type="button" className="btn" onClick={() => { pushUndo(); setValue('') }}>
              清空
            </button>
          </div>
        </div>
      </div>

      {/* 预览 */}
      {render.error ? (
        <div className="fx-error" role="alert">
          公式里有写错的地方喵：检查一下花括号 {'{ }'} 是否配对、命令拼写是否正确。
        </div>
      ) : render.html !== '' ? (
        <div className="fx-preview-box" aria-label="公式预览">
          <span dangerouslySetInnerHTML={{ __html: render.html }} />
        </div>
      ) : null}

      {/* 导出：一键复制为主，格式跟随设置的复制偏好 */}
      <div className="fx-actions">
        <button type="button" className="btn btn-primary" disabled={value.trim() === ''}
          style={value.trim() === '' ? { opacity: 0.5, cursor: 'default' } : undefined}
          onClick={() => {
            if (copyFmt === 'latex') void copyText(value, '已复制 LaTeX')
            else if (copyFmt === 'unicode') void copyText(latexToUnicode(value), '已复制文本')
            else void copyText(mathAIText(latexToUnicode(value)), COPY_OK_MSG)
          }}>
          📋 复制{copyFmt === 'latex' ? ' LaTeX' : copyFmt === 'unicode' ? ' 文本' : '（AI 可读）'}
        </button>
        <button type="button" className="btn" disabled={value.trim() === ''}
          style={value.trim() === '' ? { opacity: 0.5, cursor: 'default' } : undefined}
          onClick={sendToCalc}>
          发送到计算器
        </button>
      </div>

      {/* 公式库 */}
      <p className="sym-section-title">📚 公式库 —— 点击载入编辑器（可再修改）</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {FORMULA_LIBRARY.map((cat) => (
          <section key={cat.id}>
            <h3 style={{ margin: '0 0.25rem 0.375rem', fontSize: '0.8125rem', color: 'var(--text-3)', fontWeight: 600 }}>
              {cat.label}
            </h3>
            <div className="fx-grid">
              {cat.items.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  className="fx-card"
                  onClick={() => {
                    pushUndo()
                    setValue(item.latex)
                    show(`已载入「${item.name}」，可继续修改`)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  <span className="name">
                    {item.name}
                  </span>
                  <span className="body">
                    <Katex latex={item.latex} />
                  </span>
                  {item.note !== undefined && <span className="note">{item.note}</span>}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
