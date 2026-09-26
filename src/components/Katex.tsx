import { useEffect, useState } from 'react'
// 样式引入一次即可；KaTeX 字体文件会在首次渲染时按需加载
import 'katex/dist/katex.min.css'

/**
 * KaTeX 懒加载渲染组件。
 * katex.renderToString 的输出是库自身生成的受控 HTML（不含脚本），
 * 通过 dangerouslySetInnerHTML 注入是 KaTeX 官方推荐用法。
 */
export default function Katex({
  latex,
  displayMode = false,
}: {
  latex: string | null
  displayMode?: boolean
}) {
  const [html, setHtml] = useState<string>('')

  useEffect(() => {
    let alive = true
    if (latex === null || latex === '') {
      setHtml('')
      return
    }
    import('katex').then((katex) => {
      if (!alive) return
      try {
        setHtml(
          katex.default.renderToString(latex, {
            throwOnError: false,
            displayMode,
            output: 'html',
          })
        )
      } catch {
        setHtml('')
      }
    })
    return () => {
      alive = false
    }
  }, [latex, displayMode])

  if (latex === null || latex === '') return null
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}
