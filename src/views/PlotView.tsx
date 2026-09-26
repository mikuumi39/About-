import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { compilePlotFunction } from '../engine/plot/numEval'
import type { CompiledPlotFn } from '../engine/plot/numEval'
import { computeGrid, formatTick, screenToWorld, zoomAt } from '../engine/plot/view'
import type { Viewport } from '../engine/plot/view'
import '../styles/plot.css'

interface FnEntry {
  id: number
  text: string
}

const FN_COLORS = ['var(--fn1)', 'var(--fn2)', 'var(--fn3)', 'var(--fn4)', 'var(--fn5)', 'var(--fn6)']
const MAX_FNS = 6

const DEFAULT_VIEW: Viewport = { cx: 0, cy: 0, ppu: 56 }

function compileEntry(text: string): { ok: true; c: CompiledPlotFn } | { ok: false; msg: string } {
  if (text.trim() === '') return { ok: false, msg: '' }
  try {
    return { ok: true, c: compilePlotFunction(text) }
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : '表达式有误喵' }
  }
}

export default function PlotView() {
  const [fns, setFns] = useState<FnEntry[]>([{ id: 1, text: 'x^2 - 2' }])
  const [view, setView] = useState<Viewport>(DEFAULT_VIEW)
  const [size, setSize] = useState({ w: 320, h: 300 })
  const [crosshair, setCrosshair] = useState<{ px: number; py: number } | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchPrev = useRef<{ dist: number; mx: number; my: number } | null>(null)

  // ---------- 尺寸自适应 ----------
  useEffect(() => {
    const el = wrapRef.current
    if (el === null) return
    if (typeof ResizeObserver === 'undefined') return // jsdom 等环境无此 API
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r !== undefined) setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ---------- 编译 ----------
  const compiledList = useMemo(
    () =>
      fns.map((f, i) => {
        const r = compileEntry(f.text)
        return r.ok
          ? { ...f, color: FN_COLORS[i % FN_COLORS.length], ok: true as const, c: r.c }
          : { ...f, color: FN_COLORS[i % FN_COLORS.length], ok: false as const, msg: r.msg }
      }),
    [fns]
  )
  const validFns = useMemo(() => compiledList.filter((c) => c.ok), [compiledList])
  const firstErrorMsg = compiledList.find(
    (c): c is (typeof compiledList)[number] & { ok: false; msg: string } =>
      c.ok === false && c.msg !== ''
  )?.msg ?? ''

  // ---------- 绘制 ----------
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(50, Math.round(size.w))
    const h = Math.max(50, Math.round(size.h))
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    const ctx = canvas.getContext('2d')
    if (ctx === null) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const styles = getComputedStyle(document.documentElement)
    const colGrid = styles.getPropertyValue('--border').trim() || '#ddd'
    const colAxis = styles.getPropertyValue('--text-3').trim() || '#888'
    const colText = styles.getPropertyValue('--text-2').trim() || '#555'

    // 网格
    const grid = computeGrid(view, w, h)
    ctx.lineWidth = 1
    ctx.strokeStyle = colGrid
    ctx.globalAlpha = 0.6
    ctx.beginPath()
    for (const gx of grid.xs) {
      const sx = Math.round(w / 2 + (gx - view.cx) * view.ppu) + 0.5
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, h)
    }
    for (const gy of grid.ys) {
      const sy = Math.round(h / 2 - (gy - view.cy) * view.ppu) + 0.5
      ctx.moveTo(0, sy)
      ctx.lineTo(w, sy)
    }
    ctx.stroke()
    ctx.globalAlpha = 1

    // 坐标轴
    const origin = {
      x: w / 2 - view.cx * view.ppu,
      y: h / 2 + view.cy * view.ppu,
    }
    ctx.strokeStyle = colAxis
    ctx.lineWidth = 1.5
    ctx.beginPath()
    if (origin.y >= 0 && origin.y <= h) {
      ctx.moveTo(0, Math.round(origin.y) + 0.5)
      ctx.lineTo(w, Math.round(origin.y) + 0.5)
    }
    if (origin.x >= 0 && origin.x <= w) {
      ctx.moveTo(Math.round(origin.x) + 0.5, 0)
      ctx.lineTo(Math.round(origin.x) + 0.5, h)
    }
    ctx.stroke()

    // 刻度数字
    ctx.fillStyle = colText
    ctx.font = '10px ui-monospace, monospace'
    const tickY = Math.min(Math.max(origin.y + 4, 4), h - 14)
    for (const gx of grid.xs) {
      if (Math.abs(gx) < grid.stepX * 1e-6) continue
      const sx = w / 2 + (gx - view.cx) * view.ppu
      ctx.fillText(formatTick(gx, grid.stepX), sx - 8, tickY)
    }
    const tickX = Math.min(Math.max(origin.x - 6, 2), w - 30)
    for (const gy of grid.ys) {
      if (Math.abs(gy) < grid.stepY * 1e-6) continue
      const sy = h / 2 - (gy - view.cy) * view.ppu
      ctx.fillText(formatTick(gy, grid.stepY), tickX, sy - 3)
    }

    // 曲线（每 2 物理像素采样）
    for (const item of validFns) {
      const fn = item.c.fn
      ctx.strokeStyle = item.color
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.beginPath()
      let penDown = false
      let prevSy = 0
      const limit = h * 8
      for (let sx = 0; sx <= w; sx += 2) {
        const wx = view.cx + (sx - w / 2) / view.ppu
        const wy = fn(wx)
        if (!Number.isFinite(wy)) {
          penDown = false
          continue
        }
        const sy = h / 2 - (wy - view.cy) * view.ppu
        if (!Number.isFinite(sy) || Math.abs(sy) > limit) {
          penDown = false
          continue
        }
        // 跳变过大视为间断（如 tan 的渐近线）
        if (penDown && Math.abs(sy - prevSy) > h * 1.5) penDown = false
        if (penDown) ctx.lineTo(sx, sy)
        else {
          ctx.moveTo(sx, sy)
          penDown = true
        }
        prevSy = sy
      }
      ctx.stroke()
    }
  }, [view, size, validFns])

  useEffect(() => {
    draw()
  }, [draw])

  // ---------- 滚轮缩放（非 passive 才能阻止页面滚动） ----------
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const factor = Math.exp(-e.deltaY * 0.0015)
      setView((v) => zoomAt(v, e.clientX - rect.left, e.clientY - rect.top, factor, rect.width, rect.height))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  // ---------- 手势 ----------
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()]
      pinchPrev.current = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        mx: (pts[0].x + pts[1].x) / 2,
        my: (pts[0].y + pts[1].y) / 2,
      }
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setCrosshair({ px: e.clientX - rect.left, py: e.clientY - rect.top })

    if (!pointers.current.has(e.pointerId)) return
    const prev = pointers.current.get(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 1 && prev !== undefined) {
      setView((v) => ({
        ...v,
        cx: v.cx - (e.clientX - prev.x) / v.ppu,
        cy: v.cy + (e.clientY - prev.y) / v.ppu,
      }))
    } else if (pointers.current.size === 2 && pinchPrev.current !== null) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const mx = (pts[0].x + pts[1].x) / 2
      const my = (pts[0].y + pts[1].y) / 2
      const p = pinchPrev.current
      if (dist > 5 && p.dist > 5) {
        setView((v) => {
          const rectL = { width: rect.width, height: rect.height }
          const lx = mx - rect.left
          const ly = my - rect.top
          let nv = zoomAt(v, lx, ly, dist / p.dist, rectL.width, rectL.height)
          nv = {
            ...nv,
            cx: nv.cx - (mx - p.mx) / nv.ppu,
            cy: nv.cy + (my - p.my) / nv.ppu,
          }
          return nv
        })
      }
      pinchPrev.current = { dist, mx, my }
    }
  }

  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchPrev.current = null
  }

  // ---------- 坐标读数 ----------
  const readout = (() => {
    if (crosshair === null || validFns.length === 0) return null
    const world = screenToWorld(view, crosshair.px, crosshair.py, size.w, size.h)
    const lines: Array<{ color: string; text: string }> = []
    for (const item of validFns.slice(0, 3)) {
      const y = item.c.fn(world.x)
      lines.push({
        color: item.color,
        text: Number.isFinite(y) ? `y = ${formatValue(y)}` : '未定义',
      })
    }
    return (
      <div className="plot-readout" aria-hidden="true">
        <div>x = {formatValue(world.x)}</div>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span className="dot" style={{ background: l.color }} />
            <span>{l.text}</span>
          </div>
        ))}
      </div>
    )
  })()

  // ---------- 函数列表编辑 ----------
  const setText = (id: number, text: string) => {
    setFns((fs) => fs.map((f) => (f.id === id ? { ...f, text } : f)))
  }
  const addFn = () => {
    if (fns.length >= MAX_FNS) return
    const id = Math.max(0, ...fns.map((f) => f.id)) + 1
    setFns((fs) => [...fs, { id, text: '' }])
    setActiveId(id)
  }
  const removeFn = (id: number) => {
    setFns((fs) => (fs.length > 1 ? fs.filter((f) => f.id !== id) : fs))
  }

  return (
    <div className="plot-wrap">
      {/* 函数列表 */}
      <div className="plot-fn-list" role="list" aria-label="函数列表">
        {compiledList.map((item, i) => (
          <div key={item.id} role="listitem" className="plot-fn-row">
            <span
              aria-hidden="true"
              onClick={() => setActiveId(item.id)}
              className={`plot-dot${activeId === item.id ? ' active' : ''}`}
              style={{ background: item.ok ? item.color : 'var(--danger)' }}
              title={item.ok ? '函数颜色' : item.msg}
            >
              {String.fromCharCode(102 + i)}
            </span>
            <input
              value={item.text}
              onChange={(e) => setText(item.id, e.target.value)}
              onFocus={() => setActiveId(item.id)}
              placeholder={i === 0 ? '输入函数，如 x^2、sin(x)、1/x' : '再写一条…'}
              aria-label={`函数 ${String.fromCharCode(102 + i)} 表达式`}
              spellCheck={false}
              autoComplete="off"
            />
            {fns.length > 1 && (
              <button type="button" className="btn" aria-label={`删除函数 ${String.fromCharCode(102 + i)}`} onClick={() => removeFn(item.id)}>
                ✕
              </button>
            )}
          </div>
        ))}
        {firstErrorMsg !== '' && <p className="fx-error plot-err">{firstErrorMsg}</p>}
        {fns.length < MAX_FNS && (
          <button type="button" className="btn plot-add" onClick={addFn}>
            ＋ 加一条函数
          </button>
        )}
      </div>

      {/* 画布 */}
      <div className="plot-canvas-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="plot-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onPointerLeave={(e) => {
            endPointer(e)
            setCrosshair(null)
          }}
          onDoubleClick={() => setView(DEFAULT_VIEW)}
          role="img"
          aria-label="函数图像画布：单指拖动平移，双指或滚轮缩放，双击复位"
          style={{ touchAction: 'none', width: `${size.w}px`, height: `${size.h}px` }}
        />
        {readout}
      </div>

      {/* 工具条 */}
      <div className="fx-actions plot-toolbar">
        <button type="button" className="btn" onClick={() => setView((v) => zoomAt(v, size.w / 2, size.h / 2, 1.25, size.w, size.h))} aria-label="放大">
          ＋
        </button>
        <button type="button" className="btn" onClick={() => setView((v) => zoomAt(v, size.w / 2, size.h / 2, 0.8, size.w, size.h))} aria-label="缩小">
          －
        </button>
        <button type="button" className="btn" onClick={() => setView(DEFAULT_VIEW)}>
          ⌂ 复位
        </button>
        <span className="calc-hint">弧度制 · 拖动平移 · 双指/滚轮缩放 · 双击复位</span>
      </div>
    </div>
  )
}

// 小工具
function formatValue(v: number): string {
  if (!Number.isFinite(v)) return '∞'
  const ax = Math.abs(v)
  if (ax !== 0 && (ax >= 1e5 || ax < 1e-4)) return v.toExponential(3)
  return String(Math.round(v * 10000) / 10000)
}
