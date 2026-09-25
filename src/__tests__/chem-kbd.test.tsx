// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ChemView from '../views/ChemView'

beforeEach(() => {
  cleanup()
  window.localStorage.clear()
})

function type(text: string) {
  const ta = screen.getByLabelText('化学式输入') as HTMLTextAreaElement
  fireEvent.change(ta, { target: { value: text } })
  return ta
}

describe('化学输入键盘', () => {
  it('渲染常用元素、下标数字、电荷与方程式按键', () => {
    render(<ChemView />)
    expect(screen.getByRole('button', { name: 'Fe' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Na' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '²⁻' })).toBeTruthy()
    expect(screen.getByText('条件')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: '+' }).length).toBeGreaterThan(0)
  })

  it('点元素 → 点下标：插入 H2SO4 且大预览渲染', async () => {
    render(<ChemView />)
    for (const k of ['H', '2', 'S', 'O', '4']) {
      fireEvent.click(screen.getByRole('button', { name: k }))
    }
    const ta = screen.getByLabelText('化学式输入') as HTMLTextAreaElement
    expect(ta.value).toBe('H2SO4')
    // KaTeX 懒加载，等预览出现
    await waitFor(() => {
      expect(screen.getByTestId('chem-preview').textContent).toContain('H')
    })
  })

  it('点离子基团插入显式电荷形式', () => {
    render(<ChemView />)
    fireEvent.click(screen.getByRole('button', { name: 'SO₄²⁻' }))
    const ta = screen.getByLabelText('化学式输入') as HTMLTextAreaElement
    expect(ta.value).toBe('SO4^2-')
    // 预览应显示带电荷的形式（KaTeX 上标）
    expect(screen.queryByText(/先在下面/)).toBeNull()
  })

  it('条件自动吸附到箭头之后', () => {
    render(<ChemView />)
    type('CH4 + O2 -> CO2 + H2O')
    fireEvent.click(screen.getByRole('button', { name: '条件' }))
    fireEvent.click(screen.getByRole('button', { name: '点燃' }))
    const ta = screen.getByLabelText('化学式输入') as HTMLTextAreaElement
    expect(ta.value).toContain('->(点燃)')
  })

  it('没有箭头时点条件会补一个标准箭头', () => {
    render(<ChemView />)
    type('')
    fireEvent.click(screen.getByRole('button', { name: '条件' }))
    fireEvent.click(screen.getByRole('button', { name: '高温' }))
    const ta = screen.getByLabelText('化学式输入') as HTMLTextAreaElement
    expect(ta.value).toContain('->')
    expect(ta.value).toContain('(高温)')
  })

  it('全部元素展开后可插入稀土等冷门元素', () => {
    render(<ChemView />)
    fireEvent.click(screen.getByRole('button', { name: '全部' }))
    fireEvent.click(screen.getByTitle('铈'))
    const ta = screen.getByLabelText('化学式输入') as HTMLTextAreaElement
    expect(ta.value).toBe('Ce')
  })
})
