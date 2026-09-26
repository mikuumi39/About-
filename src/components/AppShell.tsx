import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Icon, { BrandMark } from './Icon'
import { VIEWS, navigate } from '../nav'
import ModeToggle from './ModeToggle'

interface AppShellProps {
  view: string
  children: ReactNode
}

/**
 * 应用外壳：桌面侧边栏 / 移动端底部标签栏 + “更多” Bottom Sheet。
 */
export default function AppShell({ view, children }: AppShellProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const moreTriggerRef = useRef<HTMLButtonElement>(null)

  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0]
  const primaryViews = VIEWS.filter((v) => v.primary)
  const secondaryViews = VIEWS.filter((v) => !v.primary)

  const go = (id: string) => {
    setMoreOpen(false)
    navigate(id)
  }

  // Sheet 打开时：Esc 关闭 + 焦点移入；关闭时焦点还给触发按钮
  useEffect(() => {
    if (moreOpen) {
      closeBtnRef.current?.focus()
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setMoreOpen(false)
      }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }
    return undefined
  }, [moreOpen])

  useEffect(() => {
    if (!moreOpen && document.contains(moreTriggerRef.current)) {
      moreTriggerRef.current?.focus()
    }
  }, [moreOpen])

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>

      {/* 桌面侧边栏 */}
      <aside className="side-nav">
        <div className="brand">
          <BrandMark />
          <span>
            我的计算器喵
            <small>高中数学·化学工具</small>
          </span>
        </div>
        <nav aria-label="主导航">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className="nav-btn"
              aria-current={v.id === view ? 'page' : undefined}
              onClick={() => go(v.id)}
            >
              <Icon name={v.icon} />
              {v.label}
            </button>
          ))}
        </nav>
        <div className="side-foot">我的计算器喵 v0.2.0</div>
      </aside>

      <div className="content">
        <header className="topbar">
          <h1 className="topbar-title">{current.label}</h1>
          <ModeToggle />
        </header>

        <main id="main" className="main" tabIndex={-1}>
          <div className="page">
            <div className="view-enter" key={view}>
              {children}
            </div>
          </div>
        </main>

        {/* 移动端底部标签栏 */}
        <nav className="tabbar" aria-label="主导航">
          {primaryViews.map((v) => (
            <button
              key={v.id}
              type="button"
              className="tab"
              aria-current={v.id === view ? 'page' : undefined}
              onClick={() => go(v.id)}
            >
              <Icon name={v.icon} size={22} />
              {v.label}
            </button>
          ))}
          <button
            ref={moreTriggerRef}
            type="button"
            className="tab"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
          >
            <Icon name="more" size={22} />
            更多
          </button>
        </nav>
      </div>

      {moreOpen && (
        <>
          <div
            className="sheet-backdrop"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="更多功能"
          >
            <div className="sheet-handle" />
            <p className="sheet-title">更多功能</p>
            {secondaryViews.map((v) => (
              <button
                key={v.id}
                type="button"
                className="sheet-item"
                onClick={() => go(v.id)}
              >
                <Icon name={v.icon} />
                {v.label}
                {v.id === view && (
                  <span style={{ marginInlineStart: 'auto' }}>
                    <Icon name="check" size={18} />
                  </span>
                )}
              </button>
            ))}
            <button
              ref={closeBtnRef}
              type="button"
              className="sheet-item"
              onClick={() => setMoreOpen(false)}
            >
              <Icon name="close" />
              收起
            </button>
          </div>
        </>
      )}
    </div>
  )
}
