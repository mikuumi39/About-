// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import SettingsView from '../views/SettingsView'
import { collectBackup } from '../store/backup'

beforeEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('设置页数据区', () => {
  it('渲染导出/导入/清空按钮', () => {
    render(<SettingsView />)
    expect(screen.getByText(/导出备份/)).toBeTruthy()
    expect(screen.getByText(/从备份文件导入/)).toBeTruthy()
    expect(screen.getByText('清空本机全部数据')).toBeTruthy()
    expect(screen.getByText('合并（推荐）')).toBeTruthy()
  })

  it('导出产生有效 JSON（通过 collectBackup 校验）', () => {
    render(<SettingsView />)
    const file = collectBackup()
    expect(file.app).toBe('jiansuan')
    expect(file.version).toBeGreaterThan(0)
    expect(typeof file.data.settings).toBe('object')
  })

  it('清空前有确认弹窗', () => {
    render(<SettingsView />)
    let confirmCalled = false
    window.confirm = () => {
      confirmCalled = true
      return false
    }
    fireEvent.click(screen.getByText('清空本机全部数据'))
    expect(confirmCalled).toBe(true)
  })
})
