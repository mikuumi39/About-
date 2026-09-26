// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import PlotView from '../views/PlotView'

beforeEach(() => {
  cleanup()
})

describe('函数绘图界面', () => {
  it('渲染函数列表与画布', () => {
    render(<PlotView />)
    expect(screen.getByLabelText('函数 f 表达式')).toBeTruthy()
    expect(screen.getByLabelText(/函数图像画布/)).toBeTruthy()
    expect(screen.getByText('⌂ 复位')).toBeTruthy()
  })

  it('输入非法表达式显示中文错误', () => {
    render(<PlotView />)
    const input = screen.getByLabelText('函数 f 表达式') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'y + 1' } })
    expect(screen.getByText(/只支持自变量 x/)).toBeTruthy()
  })

  it('合法表达式不报错且可加第二条', () => {
    render(<PlotView />)
    const input = screen.getByLabelText('函数 f 表达式') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'x^2' } })
    expect(screen.queryByText(/只支持自变量 x/)).toBeNull()
    fireEvent.click(screen.getByText('＋ 加一条函数'))
    expect(screen.getByLabelText(/函数 g 表达式/)).toBeTruthy()
  })
})
