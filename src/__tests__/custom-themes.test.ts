// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import {
  validateCustomTheme,
  sanitizeTokenValue,
  buildStyleText,
  extractThemeFromZip,
  useCustomThemes,
} from '../theme/custom'
import JSZip from 'jszip'

const GOOD = {
  name: '我的暗夜',
  appearance: 'dark',
  tokens: {
    '--bg': '#0b0b10',
    '--panel': '#15151d',
    '--panel-2': '#1e1e28',
    '--border': '#2a2a36',
    '--text': '#eee',
    '--text-2': '#999',
    '--text-3': '#666',
    '--accent': '#7aa2f7',
    '--accent-text': '#0b0b10',
    '--accent-weak': '#1a2233',
    '--danger': '#ff5c5c',
    '--danger-weak': '#331a1a',
    '--ok': '#4cc38a',
    '--warn': '#e0c341',
    '--warn-weak': '#2c260e',
    '--key': '#17171f',
    '--key-hover': '#20202a',
    '--key-active': '#292934',
    '--key-fn': '#12121a',
    '--backdrop': 'rgb(0 0 0 / 0.6)',
    '--shadow-1': '0 1px 2px rgb(0 0 0 / 0.4)',
    '--shadow-2': '0 8px 28px rgb(0 0 0 / 0.55)',
    '--not-a-token': 'javascript:alert(1)',
  },
}

beforeEach(() => {
  window.localStorage.clear()
  useCustomThemes.setState({ themes: [] })
})

describe('第三方主题校验', () => {
  it('合法主题通过，未知令牌被忽略', () => {
    const t = validateCustomTheme(GOOD)
    expect(t.name).toBe('我的暗夜')
    expect(t.id).toMatch(/^custom-/)
    expect(t.tokens['--not-a-token']).toBeUndefined()
    expect(Object.keys(t.tokens).length).toBe(22)
  })

  it('缺少必填颜色时报中文错误', () => {
    expect(() =>
      validateCustomTheme({ name: 'x', appearance: 'light', tokens: { '--panel': '#fff' } })
    ).toThrow(/--bg/)
    expect(() => validateCustomTheme({ name: '', appearance: 'light', tokens: GOOD.tokens })).toThrow(
      /name/
    )
    expect(() => validateCustomTheme({ name: 'x', appearance: 'purple', tokens: GOOD.tokens })).toThrow(
      /appearance/
    )
  })

  it('注入攻击全部被拒绝', () => {
    const attacks: Array<[string, unknown]> = [
      ['--bg', 'url(javascript:alert(1))'],
      ['--bg', 'var(--accent)'],
      ['--accent', 'red; } html{display:none}'],
      ['--accent', 'expression(alert(1))'],
      ['--accent', '@import "evil.css"'],
      ['--accent', '<script>alert(1)</script>'],
      ['--accent', 'rgb(1;2;3)'],
      ['--accent', 'content:"</style><script>"'],
      ['--shadow-1', 'url(evil)'],
      ['--bg', 123],
      ['--bg', null],
      ['--bg', ''],
      ['--bg', `#${'a'.repeat(90)}`],
    ]
    for (const [k, v] of attacks) {
      expect(sanitizeTokenValue(k, v)).toBeNull()
    }
  })

  it('合法值形态放行：hex/rgb()/rgba()/hsl()/阴影复合值', () => {
    expect(sanitizeTokenValue('--bg', '#0b0b10')).toBe('#0b0b10')
    expect(sanitizeTokenValue('--bg', 'rgb(15 18 22 / 0.45)')).toBe('rgb(15 18 22 / 0.45)')
    expect(sanitizeTokenValue('--accent', 'rgba(10,20,30,0.5)')).toBe('rgba(10,20,30,0.5)')
    expect(sanitizeTokenValue('--accent', 'hsl(210 80% 50%)')).toBe('hsl(210 80% 50%)')
    expect(sanitizeTokenValue('--shadow-1', '0 8px 28px rgb(16 24 40 / 0.14)')).toBeTruthy()
  })

  it('生成的 CSS 只包含令牌声明，id 由内容决定且稳定', () => {
    const t1 = validateCustomTheme(GOOD)
    const t2 = validateCustomTheme(GOOD)
    expect(t1.id).toBe(t2.id)
    const css = buildStyleText([t1])
    expect(css.startsWith(`html[data-theme='${t1.id}']{`)).toBe(true)
    expect(css).toContain('--bg: #0b0b10;')
    expect(css).not.toContain('javascript')
    expect(css).not.toContain('<')
  })
})

describe('ZIP 导入', () => {
  it('根目录 theme.json 可读出', async () => {
    const zip = new JSZip()
    zip.file('theme.json', JSON.stringify(GOOD))
    zip.file('preview.png', 'fake-png-bytes')
    const raw = await extractThemeFromZip(await zip.generateAsync({ type: 'arraybuffer' }))
    const t = validateCustomTheme(raw)
    expect(t.name).toBe('我的暗夜')
  })

  it('子目录里的 theme.json 也兼容', async () => {
    const zip = new JSZip()
    zip.folder('my-theme')?.file('theme.json', JSON.stringify(GOOD))
    const raw = await extractThemeFromZip(await zip.generateAsync({ type: 'arraybuffer' }))
    expect(validateCustomTheme(raw).name).toBe('我的暗夜')
  })

  it('没有 theme.json 报中文错误', async () => {
    const zip = new JSZip()
    zip.file('other.txt', 'hi')
    await expect(extractThemeFromZip(await zip.generateAsync({ type: 'arraybuffer' }))).rejects.toThrow(
      /theme\.json/
    )
  })
})

describe('自定义主题存储', () => {
  it('安装后可列出、删除；同 id 覆盖不重复', async () => {
    const zip = new JSZip()
    zip.file('theme.json', JSON.stringify(GOOD))
    const t = validateCustomTheme(await extractThemeFromZip(await zip.generateAsync({ type: 'arraybuffer' })))
    useCustomThemes.getState().add(t)
    useCustomThemes.getState().add(validateCustomTheme(GOOD))
    expect(useCustomThemes.getState().themes.length).toBe(1)
    useCustomThemes.getState().remove(t.id)
    expect(useCustomThemes.getState().themes.length).toBe(0)
  })
})
