import { copyText } from '../../store/toast'
import { useSettings } from '../../store/settings'
import { mathAIText, COPY_OK_MSG } from '../../engine/text/ai-text'
import type { CalcOutcome } from '../../engine/math'
import Katex from '../Katex'

/**
 * 已确认的结果卡片（视觉第一层）：
 * - 主显示直观小数，一键复制（按设置输出 AI 纯文本 / Unicode / LaTeX）
 * - 「精确形式」折叠展示
 * - 结果可接回输入框继续计算
 */
export default function ResultCard({
  outcome,
  onContinue,
}: {
  outcome: CalcOutcome
  onContinue: (text: string) => void
}) {
  const copyMode = useSettings((s) => s.copyMode)

  const copyValue = (value: string, latex: string | null) => {
    if (copyMode === 'latex' && latex !== null && latex !== '') {
      void copyText(latex, '已复制 LaTeX')
    } else if (copyMode === 'unicode') {
      void copyText(value, '已复制文本')
    } else {
      void copyText(mathAIText(value), COPY_OK_MSG)
    }
  }

  if (outcome.kind === 'value') {
    const { display } = outcome
    return (
      <div className="calc-result" role="status" aria-live="polite" data-testid="result-card">
        <div className="calc-result-label">结果 · 点数值直接复制</div>
        <div
          className="calc-result-main"
          title="点击复制"
          style={{ cursor: 'pointer' }}
          onClick={() => copyValue(display.main, outcome.latex)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') copyValue(display.main, outcome.latex)
          }}
        >
          {display.main}
        </div>

        {display.exact !== undefined && (
          <div className="calc-exact">
            <span>精确形式：</span>
            <span className="val">{display.exact}</span>
            <button
              type="button"
              className="btn"
              style={{ marginInlineStart: '0.375rem', padding: '0.1875rem 0.5rem', fontSize: '0.75rem' }}
              onClick={() => copyValue(display.exact ?? '', outcome.latex)}
            >
              复制
            </button>
          </div>
        )}

        {outcome.latex !== null && (
          <div className="calc-preview" aria-hidden="true">
            <Katex latex={outcome.latex} />
          </div>
        )}

        <div className="calc-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onContinue(display.exact ?? display.main)}
          >
            继续计算
          </button>
          <button type="button" className="btn" onClick={() => copyValue(display.main, outcome.latex)}>
            复制结果
          </button>
        </div>
      </div>
    )
  }

  // 求解结果
  const solveLatex = outcome.latex
  const copyRoot = (v: string) => {
    if (copyMode === 'latex' && solveLatex !== null && solveLatex !== '') {
      void copyText(solveLatex, '已复制 LaTeX')
    } else if (copyMode === 'unicode') {
      void copyText(v, '已复制文本')
    } else {
      void copyText(mathAIText(v), COPY_OK_MSG)
    }
  }
  const firstPlain = outcome.rows[0]?.plain

  return (
    <div className="calc-result" role="status" aria-live="polite" data-testid="result-card">
      <div className="calc-result-label">求解结果</div>
      {outcome.rows.length > 0 ? (
        <div className="calc-solve-rows">
          {outcome.rows.map((r, i) => (
            <div key={i} className="calc-solve-row">
              <span className="label">{r.label}</span>
              <span
                className="value"
                title="点击复制"
                style={{ cursor: 'pointer' }}
                onClick={() => copyRoot(r.plain.replace(/^[^=]*=\s*/, ''))}
              >
                {r.main}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="calc-note">{outcome.note}</div>
      )}
      {outcome.rows.length > 0 && outcome.note !== undefined && (
        <div className="calc-note">{outcome.note}</div>
      )}
      {firstPlain !== undefined && (
        <div className="calc-actions">
          <button type="button" className="btn btn-primary" onClick={() => copyRoot(firstPlain)}>
            复制完整方程与解
          </button>
        </div>
      )}
      {outcome.latex !== null && (
        <div className="calc-preview" aria-hidden="true">
          <Katex latex={outcome.latex} />
        </div>
      )}
    </div>
  )
}
