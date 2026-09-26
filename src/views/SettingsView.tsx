import { useRef, useState } from 'react'
import { BUILTIN_THEMES } from '../theme/themes'
import {
  useCustomThemes,
  validateCustomTheme,
  extractThemeFromZip,
  ThemeImportError,
} from '../theme/custom'
import type { CustomTheme } from '../theme/custom'
import { useSettings } from '../store/settings'
import ModeToggle from '../components/ModeToggle'
import {
  collectBackup,
  downloadBackup,
  importBackup,
  BackupError,
} from '../store/backup'
import type { BackupMode } from '../store/backup'
import { useHistory } from '../store/history'
import { useSymbolStore } from '../store/symbols'
import { useToast } from '../store/toast'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: '0.9375rem',
        color: 'var(--text-2)',
        fontWeight: 600,
        margin: '1rem 0.25rem 0.5rem',
      }}
    >
      {children}
    </h2>
  )
}

const FONT_SCALES = [
  { v: 0.85, label: '小' },
  { v: 1, label: '标准' },
  { v: 1.15, label: '大' },
  { v: 1.3, label: '特大' },
]

export default function SettingsView() {
  const themeId = useSettings((s) => s.themeId)
  const setThemeId = useSettings((s) => s.setThemeId)
  const animations = useSettings((s) => s.animations)
  const setAnimations = useSettings((s) => s.setAnimations)
  const fontScale = useSettings((s) => s.fontScale)
  const setFontScale = useSettings((s) => s.setFontScale)
  const decimalPlaces = useSettings((s) => s.decimalPlaces)
  const copyMode = useSettings((s) => s.copyMode)
  const setCopyMode = useSettings((s) => s.setCopyMode)
  const setDecimalPlaces = useSettings((s) => s.setDecimalPlaces)

  const [importMode, setImportMode] = useState<BackupMode>('merge')
  const fileRef = useRef<HTMLInputElement>(null)
  const themeFileRef = useRef<HTMLInputElement>(null)
  const show = useToast((s) => s.show)

  const customThemes = useCustomThemes((s) => s.themes)
  const addCustomTheme = useCustomThemes((s) => s.add)
  const removeCustomTheme = useCustomThemes((s) => s.remove)

  // 主题网格 = 内置 + 自定义
  const allThemes = [
    ...BUILTIN_THEMES.map((t) => ({
      id: t.id,
      name: t.name,
      emoji: t.emoji,
      preview: t.preview as [string, string, string],
    })),
    ...customThemes.map((t) => ({
      id: t.id,
      name: t.name,
      emoji: '🎨',
      preview: [
        t.tokens['--bg'] ?? '#888',
        t.tokens['--panel'] ?? '#aaa',
        t.tokens['--accent'] ?? '#333',
      ] as [string, string, string],
    })),
  ]

  const onThemeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f === undefined) return
    try {
      let raw: unknown
      if (f.name.toLowerCase().endsWith('.zip')) {
        raw = await extractThemeFromZip(await f.arrayBuffer())
      } else {
        try {
          raw = JSON.parse(await f.text())
        } catch {
          throw new ThemeImportError('文件不是有效的 JSON 喵')
        }
      }
      const theme = validateCustomTheme(raw)
      addCustomTheme(theme)
      setThemeId(theme.id)
      show(`主题「${theme.name}」已安装并应用喵`)
    } catch (err) {
      show(err instanceof ThemeImportError ? err.message : '主题导入失败：文件读不出来喵')
    }
  }

  const exportCustomTheme = (t: CustomTheme) => {
    const blob = new Blob(
      [JSON.stringify({ name: t.name, appearance: t.appearance, tokens: t.tokens }, null, 2)],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${t.name}.theme.json`
    a.click()
    URL.revokeObjectURL(url)
    show('主题已导出喵')
  }

  const doExport = () => {
    downloadBackup(collectBackup())
    show('备份已开始下载喵')
  }

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = '' // 允许重复选择同一文件
    if (f === undefined) return
    try {
      const text = await f.text()
      const res = importBackup(text, importMode)
      const parts: string[] = []
      if (res.appliedSettings) parts.push('设置')
      if (res.appliedHistory > 0) parts.push(`历史 ${res.appliedHistory} 条`)
      if (res.appliedFavorites > 0 || res.appliedUsage > 0) parts.push('符号数据')
      if (res.appliedDraft) parts.push('公式草稿')
      show(parts.length > 0 ? `导入成功：${parts.join('、')}` : '文件有效，但没有可导入的数据')
    } catch (err) {
      show(err instanceof BackupError ? err.message : '导入失败：文件读不出来喵')
    }
  }

  const doWipe = () => {
    if (!window.confirm('确定清空本机全部数据吗？\n（设置 / 历史 / 符号收藏 / 公式草稿都会删除，建议先导出备份）')) return
    try {
      window.localStorage.removeItem('jiansuan.settings.v1')
      window.localStorage.removeItem('jiansuan.calc-history.v1')
      window.localStorage.removeItem('jiansuan.symbols.v1')
      window.localStorage.removeItem('jiansuan.formula-draft')
    } catch {
      /* 忽略 */
    }
    useHistory.setState({ items: [] })
    useSymbolStore.setState({ favorites: [], usage: {} })
    useSettings.setState({
      themeId: 'minimal-light',
      mode: 'simple',
      angle: 'deg',
      fontScale: 1,
      animations: true,
      decimalPlaces: 9,
    })
    show('已清空全部本地数据')
  }

  return (
    <section aria-label="设置">
      <SectionTitle>外观 · 主题（{allThemes.length} 款）</SectionTitle>
      <div className="panel" style={{ padding: '0.625rem' }}>
        <div
          role="radiogroup"
          aria-label="主题"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))', gap: '0.375rem' }}
        >
          {allThemes.map((t) => {
            const active = themeId === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setThemeId(t.id)}
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  justifyContent: 'flex-start',
                  padding: '0.4375rem 0.625rem',
                  ...(active
                    ? {
                        borderColor: 'var(--accent)',
                        background: 'var(--accent-weak)',
                        color: 'var(--accent)',
                      }
                    : {}),
                }}
              >
                {/* 色点预览 */}
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex',
                    borderRadius: '999px',
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    flexShrink: 0,
                  }}
                >
                  {t.preview.map((c) => (
                    <span key={c} style={{ width: '0.625rem', height: '0.875rem', background: c }} />
                  ))}
                </span>
                <span style={{ fontSize: '0.8438rem' }}>
                  {t.emoji} {t.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <SectionTitle>第三方主题</SectionTitle>
      <div className="panel" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        <p className="calc-hint" style={{ margin: 0 }}>
          支持 <code>.json</code> 或包含 <code>theme.json</code> 的 <code>.zip</code>。主题是纯颜色数据：
          只读取白名单内的颜色令牌，任何脚本 / 链接 / 未知字段都会被丢弃，请放心导入喵。
        </p>
        <input
          ref={themeFileRef}
          type="file"
          accept=".json,.zip,application/json,application/zip"
          onChange={onThemeFile}
          style={{ display: 'none' }}
          aria-hidden="true"
        />
        <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => themeFileRef.current?.click()}>
          🎨 导入主题文件
        </button>

        {customThemes.length > 0 && (
          <div role="list" aria-label="已安装的第三方主题">
            {customThemes.map((t) => (
              <div key={t.id} role="listitem" className="ct-row">
                <span className="ct-name">🎨 {t.name}</span>
                <span className="ct-meta">{t.appearance === 'dark' ? '深色' : '浅色'}</span>
                {themeId === t.id && <span className="ct-badge">使用中</span>}
                <button type="button" className="btn ct-btn" onClick={() => exportCustomTheme(t)}>
                  导出
                </button>
                <button type="button" className="btn ct-btn" onClick={() => removeCustomTheme(t.id)}>
                  删除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <SectionTitle>计算</SectionTitle>
      <div className="panel" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <span>计算模式</span>
          <ModeToggle />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <span id="lbl-dec">结果小数位数</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="range"
              min={2}
              max={12}
              step={1}
              value={decimalPlaces}
              onChange={(e) => setDecimalPlaces(Number(e.target.value))}
              aria-labelledby="lbl-dec"
              style={{ width: '9rem', accentColor: 'var(--accent)' }}
            />
            <output style={{ fontFamily: 'var(--font-num)', minWidth: '1.25rem', textAlign: 'right' }} aria-hidden="true">
              {decimalPlaces}
            </output>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span>
            复制格式
            <small style={{ display: 'block', color: 'var(--text-3)', fontSize: '0.7813rem' }}>
              默认 AI 纯文本：√(2) → sqrt(2)、SO₄²⁻ → SO4^2-
            </small>
          </span>
          <div role="radiogroup" aria-label="复制格式" style={{ display: 'inline-flex', gap: '0.25rem' }}>
            {([
              ['ai', 'AI 文本'],
              ['unicode', 'Unicode'],
              ['latex', 'LaTeX'],
            ] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={copyMode === v}
                onClick={() => setCopyMode(v)}
                className={`btn seg-s ${copyMode === v ? 'on' : ''}`}
                style={
                  copyMode === v
                    ? { borderColor: 'var(--accent)', color: 'var(--accent)' }
                    : undefined
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <SectionTitle>无障碍</SectionTitle>
      <div className="panel" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span>
            字号大小
            <small style={{ display: 'block', color: 'var(--text-3)', fontSize: '0.7813rem' }}>
              全站界面与结果文字一起缩放
            </small>
          </span>
          <div role="radiogroup" aria-label="字号大小" style={{ display: 'inline-flex', gap: '0.25rem' }}>
            {FONT_SCALES.map((f) => (
              <button
                key={f.v}
                type="button"
                role="radio"
                aria-checked={fontScale === f.v}
                className="btn"
                style={{ padding: '0.3125rem 0.625rem', fontSize: '0.8125rem',
                  ...(fontScale === f.v
                    ? { borderColor: 'var(--accent)', background: 'var(--accent-weak)', color: 'var(--accent)' }
                    : {}) }}
                onClick={() => setFontScale(f.v)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.25rem',
          }}
        >
          <span>
            关闭动画
            <small style={{ display: 'block', color: 'var(--text-3)', fontSize: '0.7813rem' }}>
              全站禁用过渡与动画（同时遵循系统「减少动态效果」）
            </small>
          </span>
          <input
            type="checkbox"
            checked={!animations}
            onChange={(e) => setAnimations(!e.target.checked)}
            style={{ width: '1.125rem', height: '1.125rem', accentColor: 'var(--accent)' }}
          />
        </label>
      </div>

      <SectionTitle>数据</SectionTitle>
      <div className="panel" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        <p className="calc-hint" style={{ margin: 0 }}>
          备份包含：设置、计算历史与收藏、符号使用数据、公式草稿。换手机或清理浏览器前先导出一份喵。
        </p>
        <button type="button" className="btn btn-primary" onClick={doExport}>
          ⬇ 导出备份（JSON）
        </button>

        <div
          role="radiogroup"
          aria-label="导入方式"
          style={{ display: 'inline-flex', gap: '0.25rem', alignSelf: 'flex-start' }}
        >
          <button
            type="button"
            role="radio"
            aria-checked={importMode === 'merge'}
            className="btn"
            style={importMode === 'merge' ? { borderColor: 'var(--accent)', background: 'var(--accent-weak)', color: 'var(--accent)' } : undefined}
            onClick={() => setImportMode('merge')}
          >
            合并（推荐）
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={importMode === 'replace'}
            className="btn"
            style={importMode === 'replace' ? { borderColor: 'var(--accent)', background: 'var(--accent-weak)', color: 'var(--accent)' } : undefined}
            onClick={() => setImportMode('replace')}
          >
            替换现有
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={onImportFile} style={{ display: 'none' }} aria-hidden="true" />
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          ⬆ 从备份文件导入
        </button>
      </div>

      <SectionTitle>危险操作</SectionTitle>
      <div className="panel" style={{ padding: '0.75rem', borderColor: 'var(--danger)' }}>
        <button
          type="button"
          className="btn"
          style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
          onClick={doWipe}
        >
          清空本机全部数据
        </button>
      </div>

      <p className="calc-hint" style={{ margin: '0.75rem 0.25rem' }}>
        数据只保存在本设备浏览器中，不会上传到任何服务器。
      </p>
    </section>
  )
}
