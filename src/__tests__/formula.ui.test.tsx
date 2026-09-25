// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import FormulaView from '../views/FormulaView'

beforeEach(() => {
  cleanup()
  window.localStorage.clear()
})

function ta(): HTMLTextAreaElement {
  return screen.getByLabelText('公式源码输入') as HTMLTextAreaElement
}

describe('公式编辑器', () => {
  it('渲染编辑器、预览与公式库', async () => {
    render(<FormulaView />)
    expect(ta()).toBeTruthy()
    expect(screen.getByText(/公式库/)).toBeTruthy()
    expect(screen.getByText('等差数列求和')).toBeTruthy()
  })

  it('输入 LaTeX 出现 KaTeX 预览', async () => {
    render(<FormulaView />)
    fireEvent.change(ta(), { target: { value: '\\frac{a+b}{c}' } })
    await waitFor(() => {
      expect(document.querySelector('.fx-preview-box .katex')).toBeTruthy()
    })
  })

  it('错误 LaTeX 给出中文错误提示', async () => {
    render(<FormulaView />)
    fireEvent.change(ta(), { target: { value: '\\frac{a{' } })
    await waitFor(() => {
      expect(screen.getByText(/写错的地方/)).toBeTruthy()
    })
  })

  it('点击分数按钮插入 \\frac{}{} 模板', () => {
    render(<FormulaView />)
    fireEvent.click(screen.getByTitle('分数'))
    expect(ta().value).toBe('\\frac{}{}')
  })

  it('按 / 键把选中内容包成分数', () => {
    render(<FormulaView />)
    const el = ta()
    fireEvent.change(el, { target: { value: 'a+b' } })
    el.setSelectionRange(0, 3)
    fireEvent.keyDown(el, { key: '/' })
    expect(el.value).toBe('\\frac{a+b}{}')
  })

  it('^ 键插入上标结构', () => {
    render(<FormulaView />)
    const el = ta()
    fireEvent.keyDown(el, { key: '^' })
    expect(el.value).toBe('^{}')
  })

  it('快捷词 sqrt+空格 自动展开（可预测）', () => {
    render(<FormulaView />)
    const el = ta()
    fireEvent.change(el, { target: { value: 'sqrt ' } })
    expect(el.value).toBe('\\sqrt{}')
  })

  it('已有反斜杠的命令不会被二次展开', () => {
    render(<FormulaView />)
    const el = ta()
    fireEvent.change(el, { target: { value: '\\pi ' } })
    expect(el.value).toBe('\\pi ')
  })

  it('公式库点击载入', async () => {
    render(<FormulaView />)
    fireEvent.click(screen.getByText('等差数列通项'))
    await waitFor(() => {
      expect(ta().value).toContain('a_1')
    })
  })

  it('一键复制与发送到计算器按钮存在（不实际触发剪贴板）', () => {
    render(<FormulaView />)
    expect(screen.getByText(/复制（AI 可读）/)).toBeTruthy()
    expect(screen.getByText('发送到计算器')).toBeTruthy()
  })
})
