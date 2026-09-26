/** 学习工具页：常用参考数据 */

export interface RefItem {
  label: string
  value: string
  note?: string
}

export interface RefSection {
  id: string
  title: string
  emoji?: string
  items: RefItem[]
}

export const REFERENCE_SECTIONS: RefSection[] = [
  {
    id: 'math-const',
    title: '数学常数',
    emoji: 'π',
    items: [
      { label: '圆周率 π', value: '3.14159 26535 89793', note: '≈3.14' },
      { label: '自然常数 e', value: '2.71828 18284 59045', note: '≈2.72' },
      { label: 'ln 2', value: '0.693147', },
      { label: 'lg 2', value: '0.301030' },
      { label: '1 rad', value: '≈57.2958°' },
      { label: '1°', value: '≈0.017453 rad' },
    ],
  },
  {
    id: 'phys-chem-const',
    title: '物理 · 化学常数',
    emoji: '⚛',
    items: [
      { label: '阿伏加德罗常数 Nₐ', value: '6.02×10²³ /mol' },
      { label: '标准状况气体摩尔体积 Vₘ', value: '22.4 L/mol', note: '0 ℃，101 kPa' },
      { label: '重力加速度 g', value: '9.8 m/s²', note: '估算取 10' },
      { label: '水的离子积 K_w', value: '1×10⁻¹⁴', note: '25 ℃' },
      { label: '光速 c', value: '3×10⁸ m/s' },
      { label: '法拉第常数 F', value: '96485 C/mol', note: '估算取 96500' },
      { label: '理想气体常数 R', value: '8.314 J/(mol·K)' },
    ],
  },
  {
    id: 'greek',
    title: '希腊字母速查',
    emoji: 'α',
    items: [
      { label: 'α αlpha', value: '阿尔法' },
      { label: 'β βeta', value: '贝塔' },
      { label: 'γ γamma', value: '伽马' },
      { label: 'δ Δ delta', value: '德尔塔（Δ=变化量）' },
      { label: 'θ θeta', value: '西塔（常表角度）' },
      { label: 'λ λambda', value: '兰姆达（波长）' },
      { label: 'μ mu', value: '缪（摩擦因数/微）' },
      { label: 'ν nu', value: '纽（频率）' },
      { label: 'ρ rho', value: '肉（密度/电阻率）' },
      { label: 'σ Σ sigma', value: '西格马（Σ=求和）' },
      { label: 'φ Φ phi', value: '斐（磁通量/相位）' },
      { label: 'ω Ω omega', value: '欧米伽（角速度/Ω电阻）' },
    ],
  },
  {
    id: 'units',
    title: '常用单位换算',
    emoji: '📏',
    items: [
      { label: '浓度', value: '1 mol/L = 1000 mmol/L' },
      { label: '压强', value: '1 atm ≈ 101.325 kPa = 760 mmHg' },
      { label: '温度', value: 'T(K) = t(℃) + 273.15' },
      { label: '能量', value: '1 eV ≈ 1.6×10⁻¹⁹ J' },
      { label: '角度', value: '周角 = 360° = 2π rad' },
    ],
  },
]
