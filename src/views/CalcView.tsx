import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { compute, CalcError } from '../engine/math'
import type { CalcOutcome } from '../engine/math'
import { useSettings } from '../store/settings'
import { useHistory } from '../store/history'
import { useCalcBridge } from '../store/calcBridge'
import Keypad from '../components/calc/Keypad'
import type { KeyDef } from '../components/calc/Keypad'
import { smartKey, wrapFunction, unclosedParens, autoCompleteParens } from '../components/calc/smartInsert'
import ResultCard from '../components/calc/ResultCard'
import HistorySection from '../components/calc/HistorySection'
import Katex from '../components/Katex'

interface LiveState {
  outcome?: CalcOutcome
  error?: CalcError
}

function tryCompute(input: string, angle: 'deg' | 'rad', places: number): LiveState {
  if (input.trim() === '') return {}
  try {
    return { outcome: compute(input, { angle, places }) }
  } catch (e) {
    if (e instanceof CalcError) return { error: e }
    return { error: new CalcError('这个式子暂时算不出来，请检查一下输入') }
  }
}

/** 在出错字符下方画箭头（按 Unicode 码点对齐） */
function buildSnippet(input: string, pos: number): string {
  const chars = Array.from(input)
  const idx = Math.min(Math.max(pos, 0), chars.length)
  const caret = ' '.repeat(idx) + '^── 这里附近'
  return `${chars.join('')}\n${caret}`
}

export default function CalcView() {
  const angle = useSettings((s) => s.angle)
  const setAngle = useSettings((s) => s.setAngle)
  const mode = useSettings((s) => s.mode)
  const places = useSettings((s) => s.decimalPlaces)

  const [input, setInput] = useState('')
  const [committed, setCommitted] = useState<CalcOutcome | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const justEvaluated = useRef(false)
  const undoStack = useRef<string[]>([])
  const redoStack = useRef<string[]>([])

  const live = useMemo(() => tryCompute(input, angle, places), [input, angle, places])

  // ---------- 输入编辑 ----------
  const applyInput = useCallback((next: string, caret?: number) => {
    setInput(next)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (el !== null) {
        const pos = caret ?? next.length
        el.setSelectionRange(pos, pos)
      }
    })
  }, [])

  // 虚拟键盘固定在计算界面下方常驻显示，不随点击空白处收起
  // 接收公式编辑器「发送到计算器」的内容（仅挂载时消费一次）
  useEffect(() => {
    const pending = useCalcBridge.getState().consume()
    if (pending !== null && pending.trim() !== '') {
      justEvaluated.current = false
      applyInput(pending)
    }
  }, [applyInput])

  const pushUndo = useCallback(
    (prev: string) => {
      if (undoStack.current[undoStack.current.length - 1] === prev) return
      undoStack.current.push(prev)
      if (undoStack.current.length > 100) undoStack.current.shift()
      redoStack.current = []
    },
    []
  )

  const insertText = useCallback(
    (text: string) => {
      pushUndo(input)

      if (justEvaluated.current) {
        justEvaluated.current = false
        const continues = /^[+\-*/^!%°)]/.test(text)
        if (!continues) {
          // 数字 / 函数 / 左括号：开启全新算式
          setCommitted(null)
          applyInput(text, text.length)
          inputRef.current?.focus()
          return
        }
        // 运算符：接在上一个结果之后（经典计算器行为）
        const base = lastAns.current !== '' ? lastAns.current : input
        const next = base + text
        applyInput(next, next.length)
        inputRef.current?.focus()
        return
      }

      const start = inputRef.current?.selectionStart ?? input.length
      const end = inputRef.current?.selectionEnd ?? input.length
      // 右括号防呆：没有未闭合的左括号时忽略，避免打出一串多余 ")"
      if (text === ')' && !justEvaluated.current && unclosedParens(input, start) === 0) {
        return
      }
      const next = input.slice(0, start) + text + input.slice(end)
      applyInput(next, start + text.length)
      inputRef.current?.focus()
    },
    [input, applyInput, pushUndo]
  )

  const backspace = useCallback(() => {
    const curStart = inputRef.current?.selectionStart ?? input.length
    const curEnd = inputRef.current?.selectionEnd ?? input.length
    if (!justEvaluated.current && curStart === curEnd && curStart === 0) return
    pushUndo(input)
    justEvaluated.current = false
    setCommitted(null)
    if (curStart !== curEnd) {
      applyInput(input.slice(0, curStart) + input.slice(curEnd), curStart)
      return
    }
    const chars = Array.from(input.slice(0, curStart))
    const removed = chars.pop() ?? ''
    applyInput(chars.join('') + input.slice(curEnd), Math.max(0, curStart - removed.length))
  }, [input, applyInput, pushUndo])

  const clearAll = useCallback(() => {
    pushUndo(input)
    justEvaluated.current = false
    setCommitted(null)
    applyInput('')
    inputRef.current?.focus()
  }, [input, applyInput, pushUndo])

  const doUndo = useCallback(() => {
    const prev = undoStack.current.pop()
    if (prev === undefined) return
    redoStack.current.push(input)
    justEvaluated.current = false
    setCommitted(null)
    applyInput(prev)
  }, [input, applyInput])

  const doRedo = useCallback(() => {
    const next = redoStack.current.pop()
    if (next === undefined) return
    undoStack.current.push(input)
    justEvaluated.current = false
    setCommitted(null)
    applyInput(next)
  }, [input, applyInput])

  // ---------- 「=」提交与 Ans ----------
  const lastAns = useRef('')

  const commit = useCallback(() => {
    // 自动闭合未完成的括号：sin(30 + 2 直接按 = 也能算
    const balanced = autoCompleteParens(input)
    if (balanced !== input) {
      pushUndo(input)
      applyInput(balanced)
    }
    const outcome =
      balanced === input
        ? live.outcome
        : tryCompute(balanced, angle, places).outcome
    if (outcome === undefined) return
    setCommitted(outcome)
    justEvaluated.current = true
  }, [live, input, applyInput, pushUndo, angle, places])

  useEffect(() => {
    // 提交历史：放在 effect 里避免渲染期写 store
    if (committed === null) return
    const addHistory = useHistory.getState().add
    const o = committed
    if (o.kind === 'value') {
      lastAns.current = o.display.exact ?? o.display.main
      addHistory({
        expr: input,
        kind: 'value',
        main: o.display.main,
        exact: o.display.exact,
      })
    } else if (o.rows.length > 0) {
      const first = o.rows[0]
      if (first !== undefined) {
        lastAns.current = first.plain.replace(/^[^=]*=\s*/, '')
        addHistory({
          expr: input,
          kind: 'solve',
          summary: o.rows.map((r) => `${r.label} ${r.main}`).join('，'),
        })
      }
    }
    // 注意：依赖仅 committed —— 历史只在每次提交时记录一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committed])

  const handleKey = useCallback(
    (k: KeyDef) => {
      switch (k.action.t) {
        case 'ins':
          insertText(k.action.text)
          break
        case 'smart': {
          const el = inputRef.current
          pushUndo(input)
          justEvaluated.current = false
          setCommitted(null)
          const r = smartKey(
            input,
            el?.selectionStart ?? input.length,
            el?.selectionEnd ?? input.length,
            k.action.kind
          )
          applyInput(r.next, r.caret)
          el?.focus()
          break
        }
        case 'func': {
          const el = inputRef.current
          pushUndo(input)
          justEvaluated.current = false
          setCommitted(null)
          const r = wrapFunction(
            input,
            el?.selectionStart ?? input.length,
            el?.selectionEnd ?? input.length,
            k.action.name
          )
          applyInput(r.next, r.caret)
          el?.focus()
          break
        }
        case 'back':
          backspace()
          break
        case 'clear':
          clearAll()
          break
        case 'eq':
          commit()
          break
        case 'ans': {
          if (lastAns.current !== '') {
            const t = lastAns.current
            pushUndo(input)
            justEvaluated.current = false
            setCommitted(null)
            const start = inputRef.current?.selectionStart ?? input.length
            const end = inputRef.current?.selectionEnd ?? input.length
            applyInput(input.slice(0, start) + t + input.slice(end), start + t.length)
            inputRef.current?.focus()
          }
          break
        }
        case 'move': {
          const el = inputRef.current
          const start = el?.selectionStart ?? input.length
          const end = el?.selectionEnd ?? start
          const hasSel = start !== end
          justEvaluated.current = false
          if (k.action.dir === 'left') {
            const pos = hasSel ? start : Math.max(0, start - 1)
            el?.focus()
            el?.setSelectionRange(pos, pos)
          } else {
            const pos = hasSel ? end : Math.min(input.length, end + 1)
            el?.focus()
            el?.setSelectionRange(pos, pos)
          }
          break
        }
      }
    },
    [insertText, backspace, clearAll, commit, input, applyInput, pushUndo]
  )

  // ---------- 桌面键盘 ----------
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) doRedo()
      else doUndo()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
      return
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      justEvaluated.current = false
      const el = inputRef.current
      const start = el?.selectionStart ?? input.length
      const end = el?.selectionEnd ?? start
      const pos = start !== end ? start : Math.max(0, start - 1)
      el?.setSelectionRange(pos, pos)
      return
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      justEvaluated.current = false
      const el = inputRef.current
      const start = el?.selectionStart ?? input.length
      const end = el?.selectionEnd ?? start
      const pos = start !== end ? end : Math.min(input.length, end + 1)
      el?.setSelectionRange(pos, pos)
      return
    }
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    pushUndo(input)
    justEvaluated.current = false
    setCommitted(null)
    setInput(e.target.value)
  }

  return (
    <div className="calc-wrap">
      {/* 视觉优先级：结果 → 表达式 → 键盘 */}
      {committed !== null && (
        <ResultCard
          outcome={committed}
          onContinue={(t) => {
            // 「继续计算」：把输入替换为结果值，用户可直接接着输入运算符或数字
            pushUndo(input)
            justEvaluated.current = false
            applyInput(t, t.length)
            inputRef.current?.focus()
          }}
        />
      )}

      {/* 输入区 */}
      <div className="calc-input-box">
        <div className="calc-input-meta">
          <div className="calc-angle-chip" role="group" aria-label="角度单位">
            <button
              type="button"
              aria-pressed={angle === 'deg'}
              onClick={() => setAngle('deg')}
              title="三角函数按角度计算"
            >
              度
            </button>
            <button
              type="button"
              aria-pressed={angle === 'rad'}
              onClick={() => setAngle('rad')}
              title="三角函数按弧度计算"
            >
              弧度
            </button>
          </div>
          <span className="calc-hint">
            {mode === 'pro' ? '专业模式 · 数学/物理/化学键盘' : '试试 √25 或 sin30°'}
          </span>
        </div>
        <input
          ref={inputRef}
          className="calc-input"
          value={input}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          onFocus={(e) => {
            // 软键盘弹起时确保输入框可见（jsdom 等环境无此 API）
            e.target.scrollIntoView?.({ block: 'nearest' })
          }}
          placeholder="输入算式，如 1/2+1/3、√25、2x+3=7"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="计算器输入框"
        />

        {live.error !== undefined ? (
          <div className="calc-error" role="alert">
            {live.error.message}
            {live.error.pos !== undefined && (
              <span className="calc-error-snippet" aria-hidden="true">
                {buildSnippet(input, live.error.pos)}
              </span>
            )}
          </div>
        ) : live.outcome !== undefined ? (
          <div className="calc-preview" aria-live="polite">
            {live.outcome.kind === 'value' ? (
              <span>
                <Katex latex={live.outcome.latex} />
                <span style={{ margin: '0 0.5rem', color: 'var(--text-3)' }}>=</span>
                <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-num)' }}>
                  {live.outcome.display.main}
                </strong>
              </span>
            ) : (
              <span style={{ color: 'var(--text-2)' }}>
                检测到方程，按「=」或回车查看求解结果 ↓
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/* 键盘 */}
      <div className="keypad-pop keypad-visible">
        <Keypad pro={mode === 'pro'} onKey={handleKey} />
      </div>

      <HistorySection
        onPick={(expr) => {
          pushUndo(input)
          justEvaluated.current = false
          setCommitted(null)
          applyInput(expr)
          inputRef.current?.focus()
        }}
      />
    </div>
  )
}
