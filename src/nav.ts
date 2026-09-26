import type { IconName } from './components/Icon'

export interface ViewDef {
  id: string
  label: string
  icon: IconName
  /** true = 移动端底部标签栏直显；false = 收进“更多” */
  primary: boolean
}

export const VIEWS: ViewDef[] = [
  { id: 'calc', label: '计算', icon: 'calc', primary: true },
  { id: 'chem', label: '化学', icon: 'flask', primary: true },
  { id: 'formula', label: '公式', icon: 'sigma', primary: true },
  { id: 'plot', label: '函数', icon: 'plot', primary: true },
  { id: 'symbols', label: '符号', icon: 'sqrt', primary: false },
  { id: 'learn', label: '教程', icon: 'book', primary: false },
  { id: 'settings', label: '设置', icon: 'sliders', primary: false },
]

const VIEW_IDS = new Set(VIEWS.map((v) => v.id))

export function parseHash(hash: string = location.hash): string {
  const m = hash.match(/^#\/([a-z]+)/)
  return m !== null && VIEW_IDS.has(m[1]) ? m[1] : 'calc'
}

export function navigate(id: string): void {
  location.hash = `#/${id}`
}
