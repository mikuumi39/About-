import { describe, expect, it } from 'vitest'
import {
  screenToWorld,
  worldToScreen,
  zoomAt,
  niceStep,
  computeGrid,
  formatTick,
} from './view'

const V = { cx: 0, cy: 0, ppu: 50 }
const W = 400
const H = 300

describe('绘图视口变换', () => {
  it('世界↔屏幕往返一致', () => {
    const w = screenToWorld(V, 310, 40, W, H)
    expect(w.x).toBeCloseTo(2.2, 10)
    expect(w.y).toBeCloseTo(2.2, 10)
    const s = worldToScreen(V, w.x, w.y, W, H)
    expect(s.sx).toBeCloseTo(310, 10)
    expect(s.sy).toBeCloseTo(40, 10)
  })

  it('y 轴向上为正', () => {
    expect(worldToScreen(V, 0, 1, W, H).sy).toBeLessThan(H / 2)
  })

  it('锚点缩放保持锚点不动', () => {
    const anchor = { px: 320, py: 60 }
    const before = screenToWorld(V, anchor.px, anchor.py, W, H)
    const v2 = zoomAt(V, anchor.px, anchor.py, 1.5, W, H)
    const after = screenToWorld(v2, anchor.px, anchor.py, W, H)
    expect(after.x).toBeCloseTo(before.x, 8)
    expect(after.y).toBeCloseTo(before.y, 8)
    expect(v2.ppu).toBeCloseTo(75, 8)
  })

  it('缩放限幅', () => {
    expect(zoomAt(V, 200, 150, 1e12, W, H).ppu).toBeLessThanOrEqual(5e6)
    expect(zoomAt(V, 200, 150, 1e-12, W, H).ppu).toBeGreaterThanOrEqual(1e-6)
  })

  it('好看步长', () => {
    expect(niceStep(50)).toBe(2) // 80/50=1.6 → 2
    expect(niceStep(20)).toBe(5) // 4 → 5
    expect(niceStep(100)).toBe(1)
    expect(niceStep(0.05)).toBe(2000) // 80/0.05=1600 → 2×10³
  })

  it('网格覆盖可见区域且含 0', () => {
    const g = computeGrid({ cx: 0.3, cy: -0.2, ppu: 50 }, W, H)
    expect(g.xs.some((x) => Math.abs(x) < 1e-9)).toBe(true)
    expect(g.xs[0]).toBeLessThanOrEqual(0)
    expect(g.xs[g.xs.length - 1]).toBeGreaterThanOrEqual(W / 50 / 2 - 2)
    // 步长一致性
    expect(g.xs[1] - g.xs[0]).toBeCloseTo(g.stepX, 10)
  })

  it('刻度格式化去浮点噪声', () => {
    expect(formatTick(0.30000000000000004, 0.1)).toBe('0.3')
    expect(formatTick(2, 1)).toBe('2')
    expect(formatTick(-0.5, 0.5)).toBe('-0.5')
    expect(formatTick(0, 1)).toBe('0')
  })
})
