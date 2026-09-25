import { useState } from 'react'
import { useHistory } from '../../store/history'
import Icon from '../Icon'

/** 计算历史（点击条目重新使用该算式；★ 收藏不被挤掉） */
export default function HistorySection({ onPick }: { onPick: (expr: string) => void }) {
  const items = useHistory((s) => s.items)
  const remove = useHistory((s) => s.remove)
  const toggleFav = useHistory((s) => s.toggleFav)
  const clear = useHistory((s) => s.clear)
  const [open, setOpen] = useState(false)
  const [onlyFav, setOnlyFav] = useState(false)

  const shown = onlyFav ? items.filter((i) => i.fav === true) : items

  if (items.length === 0) return null

  return (
    <div className="calc-history" data-testid="calc-history">
      <button
        type="button"
        className="calc-history-head"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>
          历史（{items.length}）
          <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> · 点击条目可再次使用</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
          <Icon name={open ? 'chevron-down' : 'chevron-down'} size={16} />
        </span>
      </button>
      {open && (
        <>
          <div className="seg seg-s" role="tablist" aria-label="历史筛选">
            <button type="button" role="tab" aria-selected={!onlyFav} onClick={() => setOnlyFav(false)}>
              全部
            </button>
            <button type="button" role="tab" aria-selected={onlyFav} onClick={() => setOnlyFav(true)}>
              ★ 收藏{items.some((i) => i.fav === true) ? '' : '（空）'}
            </button>
          </div>
          <div role="list">
            {shown.map((it) => (
              <div key={it.id} role="listitem" style={{ display: 'flex' }}>
                <button
                  type="button"
                  className={`calc-history-item${it.fav === true ? ' fav' : ''}`}
                  style={{ flex: 1, minWidth: 0 }}
                  onClick={() => onPick(it.expr)}
                >
                  <span className="expr">{it.expr}</span>
                  <span className="res">{it.main ?? it.summary}</span>
                </button>
                <button
                  type="button"
                  className={`del calc-history-item star${it.fav === true ? ' active' : ''}`}
                  style={{ width: '2.25rem', flexShrink: 0 }}
                  aria-label={it.fav === true ? `取消收藏：${it.expr}` : `收藏：${it.expr}`}
                  aria-pressed={it.fav === true}
                  onClick={() => toggleFav(it.id)}
                >
                  ★
                </button>
                <button
                  type="button"
                  className="del calc-history-item"
                  style={{ width: '2.25rem', flexShrink: 0 }}
                  aria-label={`删除：${it.expr}`}
                  onClick={() => remove(it.id)}
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            ))}
            {shown.length === 0 && (
              <p className="calc-hint" style={{ padding: '0.5rem 0.75rem' }}>
                还没有收藏的记录，点条目右侧 ★ 收藏常用算式喵
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn calc-clear-btn"
            onClick={clear}
            style={{ margin: '0.25rem 0.5rem 0.5rem' }}
          >
            清空全部历史
          </button>
        </>
      )}
    </div>
  )
}
