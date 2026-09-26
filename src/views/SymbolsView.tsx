import { useMemo, useState } from 'react'
import SymbolsGrid from '../components/symbols/SymbolsGrid'
import { SYMBOL_CATS, USABLE_SYMBOLS, searchSymbols } from '../data/symbols'
import type { SymbolCat } from '../data/symbols'
import { commonSymbols, useSymbolStore } from '../store/symbols'
import { copyText } from '../store/toast'
import '../styles/symbols.css'

interface Chip {
  id: SymbolCat | 'fav'
  label: string
}

const CHIPS: Chip[] = [
  ...SYMBOL_CATS.map((c) => ({ id: c.id as SymbolCat | 'fav', label: c.emoji ? `${c.emoji} ${c.label}` : c.label })),
  { id: 'fav', label: '★ 我的收藏' },
]

export default function SymbolsView() {
  const [cat, setCat] = useState<SymbolCat | 'fav'>('common')
  const [query, setQuery] = useState('')
  const favorites = useSymbolStore((s) => s.favorites)

  const searching = query.trim() !== ''

  const chars = useMemo(() => {
    if (searching) return searchSymbols(query).map((s) => s.ch)
    if (cat === 'common') return commonSymbols(60)
    if (cat === 'fav') return favorites
    return USABLE_SYMBOLS.filter((s) => s.cats.includes(cat)).map((s) => s.ch)
  }, [cat, query, favorites, searching])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      <input
        className="sym-search"
        type="search"
        placeholder="搜索符号或名称，如「约等于」、π、alpha"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="搜索符号"
      />

      {!searching && (
        <div className="sym-cats" role="tablist" aria-label="符号分类">
          {CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={cat === c.id}
              className="sym-cat-chip"
              onClick={() => setCat(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {searching ? (
        <>
          <p className="sym-section-title">搜索结果（{chars.length}）</p>
          <SymbolsGrid chars={chars} mode="copy" onPick={(ch) => copyText(ch, `已复制 ${ch}`)} />
        </>
      ) : cat === 'common' ? (
        <>
          <p className="sym-section-title">
            ⭐ 常用 —— 按使用频率自动排序，点右上角 ★ 可收藏
          </p>
          <SymbolsGrid chars={chars} mode="copy" onPick={(ch) => copyText(ch, `已复制 ${ch}`)} />
        </>
      ) : cat === 'fav' ? (
        <>
          <p className="sym-section-title">★ 我的收藏</p>
          <SymbolsGrid chars={chars} mode="copy" onPick={(ch) => copyText(ch, `已复制 ${ch}`)} />
        </>
      ) : (
        <>
          <p className="sym-section-title">{CHIPS.find((c) => c.id === cat)?.label}</p>
          <SymbolsGrid chars={chars} mode="copy" onPick={(ch) => copyText(ch, `已复制 ${ch}`)} />
        </>
      )}

      <p className="calc-hint" style={{ padding: '0.25rem 0.125rem 0.5rem' }}>
        点击符号即复制，可直接粘贴到微信 / 文档 / AI。使用越多，「常用」里排得越靠前。
      </p>
    </div>
  )
}
