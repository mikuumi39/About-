import { useSymbolStore } from '../../store/symbols'
import { USABLE_SYMBOLS } from '../../data/symbols'

interface SymbolsGridProps {
  chars: string[]
  /** copy = 点击复制；insert = 点击插入（公式编辑器用） */
  mode: 'copy' | 'insert'
  onPick?: (ch: string) => void
}

const NAME_MAP = new Map(USABLE_SYMBOLS.map((s) => [s.ch, s.name]))

export default function SymbolsGrid({ chars, mode, onPick }: SymbolsGridProps) {
  const favorites = useSymbolStore((s) => s.favorites)
  const toggleFav = useSymbolStore((s) => s.toggleFav)
  const record = useSymbolStore((s) => s.record)

  return (
    <div className="sym-grid" role="listbox" aria-label="符号列表">
      {chars.map((ch) => {
        const fav = favorites.includes(ch)
        return (
          <div key={ch} className="sym-cell">
            <button
              type="button"
              role="option"
              aria-selected={false}
              className="sym-btn"
              title={NAME_MAP.get(ch) ?? ch}
              onClick={() => {
                record(ch)
                if (mode === 'insert') onPick?.(ch)
                else onPick?.(ch)
              }}
            >
              {ch}
            </button>
            <button
              type="button"
              className={`sym-fav${fav ? ' active' : ''}`}
              aria-label={fav ? `取消收藏 ${ch}` : `收藏 ${ch}`}
              aria-pressed={fav}
              onClick={(e) => {
                e.stopPropagation()
                toggleFav(ch)
              }}
            >
              ★
            </button>
          </div>
        )
      })}
      {chars.length === 0 && (
        <p className="sym-empty">这里还没有符号喵</p>
      )}
    </div>
  )
}
