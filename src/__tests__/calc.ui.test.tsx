// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../App'

// 计算器 UI 冒烟测试（jsdom）
// 覆盖规格第四十七节的完整场景：找键 → 输入 → 计算 → 看结果

beforeEach(() => {
  cleanup()
  window.localStorage.clear()
  window.location.hash = '#/calc'
})

function press(label: string) {
  const btn = screen.getAllByRole('button', { name: label })[0]
  if (btn === undefined) throw new Error(`找不到按键：${label}`)
  fireEvent.click(btn)
}

function inputEl(): HTMLInputElement {
  return screen.getByLabelText('计算器输入框') as HTMLInputElement
}

async function resultCard() {
  await waitFor(() => {
    expect(screen.getByTestId('result-card')).toBeTruthy()
  })
  return within(screen.getByTestId('result-card'))
}

describe('计算器界面', () => {
  it('渲染计算视图与键盘', () => {
    render(<App />)
    expect(screen.getByLabelText('计算器输入框')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.getAllByText('÷').length).toBeGreaterThan(0)
  })

  it('点击数字与运算符组成算式，等号得到结果', async () => {
    render(<App />)
    press('2')
    press('+')
    press('3')
    expect(inputEl().value).toBe('2+3')
    press('=')
    const card = await resultCard()
    expect(card.getByText('5', { exact: true })).toBeTruthy()
  })

  it('「=」后按运算符接在结果之后', async () => {
    render(<App />)
    press('2')
    press('+')
    press('3')
    press('=')
    await resultCard()
    press('×')
    press('4')
    expect(inputEl().value).toBe('5*4')
  })

  it('分数显示精确形式', async () => {
    render(<App />)
    fireEvent.change(inputEl(), { target: { value: '1/2+1/3' } })
    press('=')
    const card = await resultCard()
    expect(card.getByText(/精确形式/)).toBeTruthy()
    expect(card.getByText('5/6', { exact: true }).textContent).toContain('5/6')
  })

  it('输入方程并求解', async () => {
    render(<App />)
    fireEvent.change(inputEl(), { target: { value: '2x+3=7' } })
    press('=')
    const card = await resultCard()
    expect(screen.getByText('求解结果')).toBeTruthy()
    // 解的数值出现在 .value 节点中（KaTeX 预览也会渲染出「2」，需区分）
    const valueNodes = card
      .getAllByText('2', { exact: true })
      .filter((el) => el.className === 'value')
    expect(valueNodes.length).toBeGreaterThanOrEqual(1)
  })

  it('除零给出中文错误提示而不是 NaN', () => {
    render(<App />)
    fireEvent.change(inputEl(), { target: { value: '1/0' } })
    expect(screen.getByText(/除数不能为 0/)).toBeTruthy()
  })

  it('退格删除最后一个字符', () => {
    render(<App />)
    press('7')
    press('8')
    press('9')
    press('退格')
    expect(inputEl().value).toBe('78')
  })

  it('AC 清空输入', () => {
    render(<App />)
    press('7')
    press('8')
    press('AC')
    expect(inputEl().value).toBe('')
  })

  it('历史记录出现并可回填', async () => {
    render(<App />)
    fireEvent.change(inputEl(), { target: { value: '√25' } })
    press('=')
    await waitFor(() => {
      expect(screen.getByTestId('calc-history')).toBeTruthy()
    })
    const history = within(screen.getByTestId('calc-history'))
    // 展开历史
    fireEvent.click(history.getByRole('button', { name: /历史/ }))
    // 点击条目按钮（排除「删除：…」按钮，用锚定正则）
    fireEvent.click(history.getByRole('button', { name: /^√25/ }))
    expect(inputEl().value).toBe('√25')
  })

  it('度模式下 sin30° 实时预览出 0.5', () => {
    render(<App />)
    fireEvent.change(inputEl(), { target: { value: 'sin(30°)' } })
    expect(screen.getByText('0.5').textContent).toBe('0.5')
  })
})
