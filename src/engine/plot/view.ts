/**
 * 绘图视口：世界坐标 ↔ 屏幕坐标变换、网格步长选择。
 * 全部为纯函数，便于单元测试。
 */

export interface Viewport {
  /** 视口中心的世界坐标 */
  cx: number
  cy: number
  /** 每个世界单位对应的像素数（两轴等比） */
  ppu: number
}

export function screenToWorld(
  v: Viewport,
  px: number,
  py: number,
  width: number,
  height: number
): { x: number; y: number } {
  return {
    x: v.cx + (px - width / 2) / v.ppu,
    y: v.cy - (py - height / 2) / v.ppu,
  }
}

export function worldToScreen(
  v: Viewport,
  x: number,
  y: number,
  width: number,
  height: number
): { sx: number; sy: number } {
  return {
    sx: width / 2 + (x - v.cx) * v.ppu,
    sy: height / 2 - (y - v.cy) * v.ppu,
  }
}

/** 以 (px,py) 为锚点缩放：保持锚点下的世界坐标不动 */
export function zoomAt(
  v: Viewport,
  anchorPx: number,
  anchorPy: number,
  factor: number,
  width: number,
  height: number
): Viewport {
  const before = screenToWorld(v, anchorPx, anchorPy, width, height)
  const ppu = Math.min(5e6, Math.max(1e-6, v.ppu * factor))
  const after: Viewport = { ...v, ppu }
  const anchorAfter = screenToWorld(after, anchorPx, anchorPy, width, height)
  // 平移使锚点世界坐标不变
  after.cx += before.x - anchorAfter.x
  after.cy += before.y - anchorAfter.y
  return after
}

/** 选择「好看」的网格步长（1-2-5 序列），目标格距约 80px */
export function niceStep(ppu: number): number {
  const target = 80 / ppu
  const mag = Math.pow(10, Math.floor(Math.log10(target)))
  for (const m of [1, 2, 5, 10]) {
    if (mag * m >= target) return mag * m
  }
  return mag * 10
}

export interface GridSpec {
  stepX: number
  stepY: number
  xs: number[]
  ys: number[]
}

/** 计算可见范围内的网格线坐标 */
export function computeGrid(v: Viewport, width: number, height: number): GridSpec {
  const halfW = width / 2 / v.ppu
  const halfH = height / 2 / v.ppu
  const mk = (center: number, half: number, step: number): number[] => {
    const out: number[] = []
    const start = Math.ceil((center - half) / step) * step
    for (let t = start; t <= center + half + step / 2; t += step) {
      out.push(Math.abs(t) < step * 1e-6 ? 0 : t)
    }
    return out
  }
  const stepX = niceStep(v.ppu)
  let stepY = stepX
  // 允许 Y 独立微调到同样好看的密度（等比缩放时通常相同）
  void stepY
  stepY = stepX
  return {
    stepX,
    stepY,
    xs: mk(v.cx, halfW, stepX),
    ys: mk(v.cy, halfH, stepY),
  }
}

/** 刻度数字格式化：去掉浮点噪声 */
export function formatTick(t: number, step: number): string {
  if (Math.abs(t) < step * 1e-6) return '0'
  const decimals = Math.max(0, Math.min(8, Math.ceil(-Math.log10(step)) + 1))
  let s = t.toFixed(decimals)
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  return s
}
