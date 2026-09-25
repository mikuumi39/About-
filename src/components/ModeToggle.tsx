import { useSettings } from '../store/settings'

/** 全局「简单 / 专业」模式切换（顶栏常驻） */
export default function ModeToggle() {
  const mode = useSettings((s) => s.mode)
  const setMode = useSettings((s) => s.setMode)

  return (
    <div className="seg" role="group" aria-label="界面模式">
      <button
        type="button"
        aria-pressed={mode === 'simple'}
        onClick={() => setMode('simple')}
      >
        简单
      </button>
      <button
        type="button"
        aria-pressed={mode === 'pro'}
        onClick={() => setMode('pro')}
      >
        专业
      </button>
    </div>
  )
}
