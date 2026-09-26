/** 特殊符号库：带名称（可搜索）与所属分类 */

export type SymbolCat =
  | 'common'
  | 'math'
  | 'greek'
  | 'chem'
  | 'physics'
  | 'set'
  | 'logic'
  | 'calculus'
  | 'other'

export interface SymbolItem {
  ch: string
  name: string
  cats: SymbolCat[]
}

export const SYMBOL_CATS: Array<{ id: SymbolCat; label: string; emoji?: string }> = [
  { id: 'common', label: '常用', emoji: '⭐' },
  { id: 'math', label: '数学' },
  { id: 'greek', label: '希腊字母', emoji: 'α' },
  { id: 'chem', label: '化学', emoji: '🧪' },
  { id: 'physics', label: '物理', emoji: '⚛' },
  { id: 'set', label: '集合' },
  { id: 'logic', label: '逻辑' },
  { id: 'calculus', label: '微积分', emoji: '∫' },
  { id: 'other', label: '其他' },
]

export const SYMBOLS: SymbolItem[] = [
  // ---- 数学高频 ----
  { ch: '±', name: '正负号', cats: ['math', 'physics'] },
  { ch: '×', name: '乘号', cats: ['math'] },
  { ch: '÷', name: '除号', cats: ['math'] },
  { ch: '≠', name: '不等于', cats: ['math'] },
  { ch: '≤', name: '小于等于', cats: ['math'] },
  { ch: '≥', name: '大于等于', cats: ['math'] },
  { ch: '≈', name: '约等于', cats: ['math'] },
  { ch: '∼', name: '相似于', cats: ['math'] },
  { ch: '≌', name: '全等于', cats: ['math'] },
  { ch: '°', name: '度', cats: ['math', 'other'] },
  { ch: '′', name: '分/撇 导数', cats: ['math', 'calculus'] },
  { ch: '″', name: '秒/双撇 二阶导数', cats: ['math'] },
  { ch: '√', name: '根号 平方根', cats: ['math'] },
  { ch: '∛', name: '立方根', cats: ['math'] },
  { ch: '∞', name: '无穷大', cats: ['math', 'calculus'] },
  { ch: '∠', name: '角', cats: ['math'] },
  { ch: '⊥', name: '垂直', cats: ['math'] },
  { ch: '∥', name: '平行', cats: ['math'] },
  { ch: '∝', name: '成正比', cats: ['math', 'physics'] },
  { ch: '∵', name: '因为', cats: ['math'] },
  { ch: '∴', name: '所以', cats: ['math'] },
  { ch: '△', name: '三角形/加热', cats: ['math', 'chem'] },
  { ch: '⊙', name: '圆', cats: ['math'] },

  // ---- 希腊字母 ----
  { ch: 'α', name: 'alpha 阿尔法', cats: ['greek', 'physics'] },
  { ch: 'β', name: 'beta 贝塔', cats: ['greek', 'physics'] },
  { ch: 'γ', name: 'gamma 伽马', cats: ['greek', 'physics'] },
  { ch: 'δ', name: 'delta 德尔塔', cats: ['greek', 'math'] },
  { ch: 'ε', name: 'epsilon 艾普西隆', cats: ['greek', 'physics'] },
  { ch: 'ζ', name: 'zeta 截塔', cats: ['greek'] },
  { ch: 'η', name: 'eta 伊塔', cats: ['greek', 'physics'] },
  { ch: 'θ', name: 'theta 西塔 角度', cats: ['greek', 'math'] },
  { ch: 'ι', name: 'iota 约塔', cats: ['greek'] },
  { ch: 'κ', name: 'kappa 卡帕', cats: ['greek'] },
  { ch: 'λ', name: 'lambda 兰姆达 波长', cats: ['greek', 'physics'] },
  { ch: 'μ', name: 'mu 缪 摩擦系数 微', cats: ['greek', 'physics'] },
  { ch: 'ν', name: 'nu 纽 频率', cats: ['greek', 'physics'] },
  { ch: 'ξ', name: 'xi 克西', cats: ['greek'] },
  { ch: 'π', name: 'pi 派 圆周率', cats: ['greek', 'math'] },
  { ch: 'ρ', name: 'rho 肉 密度 电阻率', cats: ['greek', 'physics'] },
  { ch: 'σ', name: 'sigma 西格马', cats: ['greek'] },
  { ch: 'τ', name: 'tau 套', cats: ['greek'] },
  { ch: 'υ', name: 'upsilon 宇普西隆', cats: ['greek'] },
  { ch: 'φ', name: 'phi 斐 磁通量 相位', cats: ['greek', 'physics'] },
  { ch: 'χ', name: 'chi 喜', cats: ['greek'] },
  { ch: 'ψ', name: 'psi 普西', cats: ['greek'] },
  { ch: 'ω', name: 'omega 欧米伽 角速度', cats: ['greek', 'physics'] },
  { ch: 'Γ', name: 'Gamma 大伽马', cats: ['greek'] },
  { ch: 'Δ', name: 'Delta 大德尔塔 变化量', cats: ['greek', 'math', 'physics'] },
  { ch: 'Θ', name: 'Theta 大西塔', cats: ['greek'] },
  { ch: 'Λ', name: 'Lambda 大兰姆达', cats: ['greek'] },
  { ch: 'Ξ', name: 'Xi 大克西', cats: ['greek'] },
  { ch: 'Π', name: 'Pi 大派 连乘', cats: ['greek', 'calculus'] },
  { ch: 'Σ', name: 'Sigma 大西格马 求和', cats: ['greek', 'calculus'] },
  { ch: 'Υ', name: 'Upsilon 大宇普西隆', cats: ['greek'] },
  { ch: 'Φ', name: 'Phi 大斐 磁通量', cats: ['greek', 'physics'] },
  { ch: 'Ψ', name: 'Psi 大普西', cats: ['greek'] },
  { ch: 'Ω', name: 'Omega 大欧米伽 电阻 欧姆', cats: ['greek', 'physics'] },

  // ---- 化学 ----
  { ch: '→', name: '生成 箭头', cats: ['chem', 'other'] },
  { ch: '⇌', name: '可逆反应 双向箭头', cats: ['chem'] },
  { ch: '↑', name: '气体上升 上箭头', cats: ['chem', 'other'] },
  { ch: '↓', name: '沉淀 下箭头', cats: ['chem', 'other'] },
  { ch: '⁺', name: '上标正电荷', cats: ['chem'] },
  { ch: '⁻', name: '上标负电荷', cats: ['chem'] },
  { ch: '·', name: '点乘 中点', cats: ['math', 'chem'] },
  { ch: '℃', name: '摄氏度', cats: ['chem', 'physics'] },
  { ch: 'Ⓐ', name: '电流表A', cats: ['physics'] },
  { ch: 'Ⓥ', name: '电压表V', cats: ['physics'] },

  // ---- 物理 ----
  { ch: 'Å', name: '埃 长度单位', cats: ['physics'] },

  // ---- 集合与数集 ----
  { ch: '∈', name: '属于', cats: ['set', 'math'] },
  { ch: '∉', name: '不属于', cats: ['set'] },
  { ch: '⊆', name: '子集', cats: ['set'] },
  { ch: '⊇', name: '包含', cats: ['set'] },
  { ch: '⊂', name: '真子集', cats: ['set'] },
  { ch: '⊃', name: '真包含', cats: ['set'] },
  { ch: '∪', name: '并集', cats: ['set', 'logic'] },
  { ch: '∩', name: '交集', cats: ['set', 'logic'] },
  { ch: '∅', name: '空集', cats: ['set'] },
  { ch: 'ℕ', name: '自然数集', cats: ['set'] },
  { ch: 'ℤ', name: '整数集', cats: ['set'] },
  { ch: 'ℚ', name: '有理数集', cats: ['set'] },
  { ch: 'ℝ', name: '实数集', cats: ['set'] },
  { ch: '∁', name: '补集', cats: ['set'] },

  // ---- 逻辑 ----
  { ch: '⇒', name: '推出 充分必要', cats: ['logic', 'math'] },
  { ch: '⇐', name: '被推出', cats: ['logic'] },
  { ch: '⇔', name: '等价 充要条件', cats: ['logic', 'math'] },
  { ch: '↔', name: '双箭头 互推', cats: ['logic'] },
  { ch: '∀', name: '任意 全称量词', cats: ['logic'] },
  { ch: '∃', name: '存在 存在量词', cats: ['logic'] },
  { ch: '¬', name: '非 否定', cats: ['logic'] },
  { ch: '∧', name: '且 合取', cats: ['logic'] },
  { ch: '∨', name: '或 析取', cats: ['logic'] },

  // ---- 微积分 / 数列 ----
  { ch: '∑', name: '求和号 西格马', cats: ['calculus', 'math'] },
  { ch: '∏', name: '连乘号', cats: ['calculus'] },
  { ch: '∫', name: '积分号', cats: ['calculus'] },
  { ch: '∬', name: '二重积分', cats: ['calculus'] },
  { ch: '∂', name: '偏导数', cats: ['calculus'] },
  { ch: '∇', name: '梯度 哈密顿算子', cats: ['calculus'] },

  // ---- 其他常用 ----
  { ch: '★', name: '实星 收藏', cats: ['other'] },
  { ch: '☆', name: '空心星', cats: ['other'] },
  { ch: '✓', name: '对勾 正确', cats: ['other'] },
  { ch: '✗', name: '叉 错误', cats: ['other'] },
  { ch: '‰', name: '千分号', cats: ['other', 'math'] },
  { ch: '‱', name: '万分号', cats: ['other'] },
  { ch: '§', name: '章节号', cats: ['other'] },
  { ch: '№', name: '编号', cats: ['other'] },
]

export const USABLE_SYMBOLS = SYMBOLS.filter((s) => s.cats.length > 0)

export function searchSymbols(query: string): SymbolItem[] {
  const q = query.trim().toLowerCase()
  if (q === '') return []
  return USABLE_SYMBOLS.filter(
    (s) => s.ch.includes(q) || s.name.toLowerCase().includes(q)
  )
}
