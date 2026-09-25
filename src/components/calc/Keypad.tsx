import { useRef, useState } from 'react'
import Icon from '../Icon'

export type SmartKind = 'sqrt' | 'cbrt' | 'abs' | 'square' | 'power'

export interface KeyDef {
  /** 按钮显示文本 */
  label: string
  action:
    | { t: 'ins'; text: string }
    | { t: 'smart'; kind: SmartKind }
    | { t: 'func'; name: string }
    | { t: 'eq' }
    | { t: 'clear' }
    | { t: 'back' }
    | { t: 'ans' }
    | { t: 'move'; dir: 'left' | 'right' }
  /** 样式类（num/op/fn/danger/eq，可组合） */
  cls?: string
  /** 按钮悬停提示 */
  title?: string
}

/** 简单模式顶部常用条 */
const SIMPLE_STRIP: KeyDef[] = [
  { label: 'sin', action: { t: 'func', name: 'sin' }, cls: 'fn', title: '正弦函数' },
  { label: 'cos', action: { t: 'func', name: 'cos' }, cls: 'fn', title: '余弦函数' },
  { label: 'tan', action: { t: 'func', name: 'tan' }, cls: 'fn', title: '正切函数' },
  { label: '√', action: { t: 'smart', kind: 'sqrt' }, cls: 'fn', title: '平方根' },
  { label: 'x²', action: { t: 'smart', kind: 'square' }, cls: 'fn', title: '平方' },
  { label: 'π', action: { t: 'ins', text: 'π' }, cls: 'fn', title: '圆周率' },
  { label: '°', action: { t: 'ins', text: '°' }, cls: 'fn', title: '角度符号' },
  { label: '%', action: { t: 'ins', text: '%' }, cls: 'fn', title: '百分比' },
]

/** 学科面板类型 */
export type SubjectTab = 'math' | 'physics' | 'chemistry'

/** 数学——函数分组 */
const MATH_GROUPS: Array<{ id: string; label: string; keys: KeyDef[] }> = [
  {
    id: 'trig',
    label: '三角',
    keys: [
      { label: 'sin', action: { t: 'func', name: 'sin' }, title: '正弦函数' },
      { label: 'cos', action: { t: 'func', name: 'cos' }, title: '余弦函数' },
      { label: 'tan', action: { t: 'func', name: 'tan' }, title: '正切函数' },
      { label: 'asin', action: { t: 'func', name: 'asin' }, title: '反正弦' },
      { label: 'acos', action: { t: 'func', name: 'acos' }, title: '反余弦' },
      { label: 'atan', action: { t: 'func', name: 'atan' }, title: '反正切' },
      { label: '°', action: { t: 'ins', text: '°' }, title: '角度符号' },
      { label: 'π', action: { t: 'ins', text: 'π' }, title: '圆周率' },
    ],
  },
  {
    id: 'expo',
    label: '指数·对数',
    keys: [
      { label: '√', action: { t: 'smart', kind: 'sqrt' }, title: '平方根' },
      { label: '∛', action: { t: 'smart', kind: 'cbrt' }, title: '立方根' },
      { label: 'x²', action: { t: 'smart', kind: 'square' }, title: '平方' },
      { label: 'xʸ', action: { t: 'smart', kind: 'power' }, title: '幂运算' },
      { label: 'ln', action: { t: 'func', name: 'ln' }, title: '自然对数' },
      { label: 'log', action: { t: 'func', name: 'log' }, title: '常用对数' },
      { label: '|x|', action: { t: 'smart', kind: 'abs' }, title: '绝对值' },
      { label: '%', action: { t: 'ins', text: '%' }, title: '百分比' },
    ],
  },
  {
    id: 'const',
    label: '常数·其他',
    keys: [
      { label: 'e', action: { t: 'ins', text: 'e' }, title: '自然常数 ≈ 2.718' },
      { label: 'i', action: { t: 'ins', text: 'i' }, title: '虚数单位' },
      { label: 'x', action: { t: 'ins', text: 'x' }, title: '未知数 x' },
      { label: 'y', action: { t: 'ins', text: 'y' }, title: '未知数 y' },
      { label: '!', action: { t: 'ins', text: '!' }, title: '阶乘' },
      { label: 'C(n,r)', action: { t: 'func', name: 'ncr' }, title: '组合数' },
      { label: 'A(n,r)', action: { t: 'func', name: 'npr' }, title: '排列数' },
      { label: '(', action: { t: 'ins', text: '(' }, title: '左括号' },
      { label: ')', action: { t: 'ins', text: ')' }, title: '右括号' },
    ],
  },
  {
    id: 'func',
    label: '更多函数',
    keys: [
      { label: 'sinh', action: { t: 'func', name: 'sinh' }, title: '双曲正弦' },
      { label: 'cosh', action: { t: 'func', name: 'cosh' }, title: '双曲余弦' },
      { label: 'tanh', action: { t: 'func', name: 'tanh' }, title: '双曲正切' },
      { label: 'eˣ', action: { t: 'func', name: 'exp' }, title: '指数函数' },
      { label: 'floor', action: { t: 'func', name: 'floor' }, title: '向下取整' },
      { label: 'ceil', action: { t: 'func', name: 'ceil' }, title: '向上取整' },
      { label: 'round', action: { t: 'func', name: 'round' }, title: '四舍五入' },
      { label: 'sign', action: { t: 'func', name: 'sign' }, title: '符号函数' },
    ],
  },
]

/** 物理——函数分组 */
const PHYSICS_GROUPS: Array<{ id: string; label: string; keys: KeyDef[] }> = [
  {
    id: 'mech',
    label: '力学',
    keys: [
      { label: 'F', action: { t: 'ins', text: 'F' }, title: '力' },
      { label: 'a', action: { t: 'ins', text: 'a' }, title: '加速度' },
      { label: 'v', action: { t: 'ins', text: 'v' }, title: '速度' },
      { label: 't', action: { t: 'ins', text: 't' }, title: '时间' },
      { label: 'x', action: { t: 'ins', text: 'x' }, title: '位移' },
      { label: 's', action: { t: 'ins', text: 's' }, title: '路程' },
      { label: 'g', action: { t: 'ins', text: 'g' }, title: '重力加速度' },
      { label: 'm', action: { t: 'ins', text: 'm' }, title: '质量' },
    ],
  },
  {
    id: 'elec',
    label: '电学',
    keys: [
      { label: 'I', action: { t: 'ins', text: 'I' }, title: '电流' },
      { label: 'U', action: { t: 'ins', text: 'U' }, title: '电压' },
      { label: 'R', action: { t: 'ins', text: 'R' }, title: '电阻' },
      { label: 'P', action: { t: 'ins', text: 'P' }, title: '功率' },
      { label: 'Q', action: { t: 'ins', text: 'Q' }, title: '电荷量/热量' },
      { label: 'W', action: { t: 'ins', text: 'W' }, title: '功' },
      { label: 'E', action: { t: 'ins', text: 'E' }, title: '电动势/能量' },
      { label: 'T', action: { t: 'ins', text: 'T' }, title: '周期/温度' },
    ],
  },
  {
    id: 'thermo',
    label: '热学·光',
    keys: [
      { label: 'c', action: { t: 'ins', text: 'c' }, title: '比热容/光速' },
      { label: 'm', action: { t: 'ins', text: 'm' }, title: '质量' },
      { label: 't', action: { t: 'ins', text: 't' }, title: '时间/温度变化' },
      { label: 'T', action: { t: 'ins', text: 'T' }, title: '温度' },
      { label: 'L', action: { t: 'ins', text: 'L' }, title: '长度/比热' },
      { label: 'k', action: { t: 'ins', text: 'k' }, title: '劲度系数/常数' },
      { label: 'f', action: { t: 'ins', text: 'f' }, title: '频率' },
      { label: 'h', action: { t: 'ins', text: 'h' }, title: '高度/普朗克常数' },
    ],
  },
  {
    id: 'formula',
    label: '常用公式',
    keys: [
      { label: 'F=ma', action: { t: 'ins', text: 'F=ma' }, cls: 'fn', title: '牛顿第二定律' },
      { label: 'v=at', action: { t: 'ins', text: 'v=at' }, cls: 'fn', title: '匀变速速度公式' },
      { label: 'x=vt', action: { t: 'ins', text: 'x=vt' }, cls: 'fn', title: '匀速位移公式' },
      { label: 'I=U/R', action: { t: 'ins', text: 'I=U/R' }, cls: 'fn', title: '欧姆定律' },
      { label: 'P=UI', action: { t: 'ins', text: 'P=UI' }, cls: 'fn', title: '电功率公式' },
      { label: 'W=Fs', action: { t: 'ins', text: 'W=Fs' }, cls: 'fn', title: '做功公式' },
      { label: 'Q=cmt', action: { t: 'ins', text: 'Q=cmt' }, cls: 'fn', title: '热量公式 Q=cmΔt' },
      { label: 'g≈9.8', action: { t: 'ins', text: '9.8' }, cls: 'fn', title: '重力加速度' },
    ],
  },
]

/** 化学——函数分组 */
const CHEMISTRY_GROUPS: Array<{ id: string; label: string; keys: KeyDef[] }> = [
  {
    id: 'mole',
    label: '物质的量',
    keys: [
      { label: 'n', action: { t: 'ins', text: 'n' }, title: '物质的量 (mol)' },
      { label: 'N', action: { t: 'ins', text: 'N' }, title: '微粒数' },
      { label: 'm', action: { t: 'ins', text: 'm' }, title: '质量 (g)' },
      { label: 'M', action: { t: 'ins', text: 'M' }, title: '摩尔质量 (g/mol)' },
      { label: 'V', action: { t: 'ins', text: 'V' }, title: '体积 (L)' },
      { label: 'c', action: { t: 'ins', text: 'c' }, title: '浓度 (mol/L)' },
      { label: 'T', action: { t: 'ins', text: 'T' }, title: '温度 (K)' },
      { label: 'P', action: { t: 'ins', text: 'P' }, title: '压强' },
    ],
  },
  {
    id: 'symbol',
    label: '单位·符号',
    keys: [
      { label: 'mol', action: { t: 'ins', text: 'mol' }, title: '摩尔' },
      { label: 'L', action: { t: 'ins', text: 'L' }, title: '升' },
      { label: 'g', action: { t: 'ins', text: 'g' }, title: '克' },
      { label: 'π', action: { t: 'ins', text: 'π' }, title: '圆周率' },
      { label: '°', action: { t: 'ins', text: '°' }, title: '角度符号' },
      { label: '=', action: { t: 'ins', text: '=' }, title: '等号' },
      { label: '%', action: { t: 'ins', text: '%' }, title: '百分比' },
      { label: '^', action: { t: 'ins', text: '^' }, title: '幂符号' },
    ],
  },
  {
    id: 'element',
    label: '常见元素',
    keys: [
      { label: 'H', action: { t: 'ins', text: 'H' }, title: '氢' },
      { label: 'C', action: { t: 'ins', text: 'C' }, title: '碳' },
      { label: 'N', action: { t: 'ins', text: 'N' }, title: '氮' },
      { label: 'O', action: { t: 'ins', text: 'O' }, title: '氧' },
      { label: 'S', action: { t: 'ins', text: 'S' }, title: '硫' },
      { label: 'P', action: { t: 'ins', text: 'P' }, title: '磷' },
      { label: 'Cl', action: { t: 'ins', text: 'Cl' }, title: '氯' },
      { label: 'Na', action: { t: 'ins', text: 'Na' }, title: '钠' },
      { label: 'Fe', action: { t: 'ins', text: 'Fe' }, title: '铁' },
      { label: 'Cu', action: { t: 'ins', text: 'Cu' }, title: '铜' },
      { label: 'Zn', action: { t: 'ins', text: 'Zn' }, title: '锌' },
      { label: 'Al', action: { t: 'ins', text: 'Al' }, title: '铝' },
    ],
  },
  {
    id: 'formula',
    label: '常用公式',
    keys: [
      { label: 'n=m/M', action: { t: 'ins', text: 'n=m/M' }, cls: 'fn', title: '物质的量 = 质量/摩尔质量' },
      { label: 'n=N/6.02e23', action: { t: 'ins', text: 'n=N/6.02e23' }, cls: 'fn', title: '物质的量 = 微粒数/阿伏伽德罗常数' },
      { label: 'c=n/V', action: { t: 'ins', text: 'c=n/V' }, cls: 'fn', title: '浓度 = 物质的量/体积' },
      { label: 'PV=nRT', action: { t: 'ins', text: 'PV=nRT' }, cls: 'fn', title: '理想气体状态方程' },
      { label: '+', action: { t: 'ins', text: '+' }, cls: 'op', title: '加' },
      { label: '×', action: { t: 'ins', text: '*' }, cls: 'op', title: '乘' },
      { label: '²', action: { t: 'ins', text: '²' }, title: '平方' },
      { label: '³', action: { t: 'ins', text: '³' }, title: '立方' },
    ],
  },
]

/**
 * 主键盘：4 列 × 5 行，经典计算器布局 + 左右光标移动键。
 */
const GRID: KeyDef[] = [
  { label: 'AC', action: { t: 'clear' }, cls: 'danger', title: '全部清除' },
  { label: '⌫', action: { t: 'back' }, cls: 'op', title: '退格' },
  { label: '←', action: { t: 'move', dir: 'left' }, cls: 'op key-move', title: '光标左移' },
  { label: '→', action: { t: 'move', dir: 'right' }, cls: 'op key-move', title: '光标右移' },

  { label: '7', action: { t: 'ins', text: '7' } },
  { label: '8', action: { t: 'ins', text: '8' } },
  { label: '9', action: { t: 'ins', text: '9' } },
  { label: '÷', action: { t: 'ins', text: '/' }, cls: 'op' },

  { label: '4', action: { t: 'ins', text: '4' } },
  { label: '5', action: { t: 'ins', text: '5' } },
  { label: '6', action: { t: 'ins', text: '6' } },
  { label: '×', action: { t: 'ins', text: '*' }, cls: 'op' },

  { label: '1', action: { t: 'ins', text: '1' } },
  { label: '2', action: { t: 'ins', text: '2' } },
  { label: '3', action: { t: 'ins', text: '3' } },
  { label: '−', action: { t: 'ins', text: '-' }, cls: 'op' },

  { label: '0', action: { t: 'ins', text: '0' } },
  { label: '.', action: { t: 'ins', text: '.' } },
  { label: 'Ans', action: { t: 'ans' }, cls: 'op', title: '使用上次结果' },
  { label: '=', action: { t: 'eq' }, cls: 'eq', title: '计算' },
]

/** 学科面板配置 */
const SUBJECT_PANELS: Record<SubjectTab, Array<{ id: string; label: string; keys: KeyDef[] }>> = {
  math: MATH_GROUPS,
  physics: PHYSICS_GROUPS,
  chemistry: CHEMISTRY_GROUPS,
}

const SUBJECT_TABS: Array<{ id: SubjectTab; label: string; icon: string }> = [
  { id: 'math', label: '数学', icon: '∑' },
  { id: 'physics', label: '物理', icon: '⚛' },
  { id: 'chemistry', label: '化学', icon: '⚗' },
]

export default function Keypad({
  pro,
  onKey,
}: {
  pro: boolean
  onKey: (k: KeyDef) => void
}) {
  const [subject, setSubject] = useState<SubjectTab>('math')
  const [group, setGroup] = useState('trig')
  const backTimer = useRef<number>(0)
  const backFired = useRef(false)

  const startBackRepeat = (k: KeyDef) => {
    backFired.current = false
    backTimer.current = window.setTimeout(function rep() {
      backFired.current = true
      onKey(k)
      backTimer.current = window.setTimeout(rep, 70)
    }, 400)
  }
  const stopBackRepeat = () => {
    window.clearTimeout(backTimer.current)
  }

  const renderKey = (k: KeyDef, keyId: string, extraCls = '') => (
    <button
      key={keyId}
      type="button"
      className={`key ${k.cls ?? ''} ${extraCls}`}
      title={k.title}
      onClick={() => onKey(k)}
    >
      {k.label}
    </button>
  )

  const activePanel = SUBJECT_PANELS[subject]
  const activeGroup = activePanel.find((g) => g.id === group) ?? activePanel[0]

  const handleSubjectChange = (s: SubjectTab) => {
    setSubject(s)
    const first = SUBJECT_PANELS[s][0]
    if (first) setGroup(first.id)
  }

  return (
    <div className="keypad-host" role="group" aria-label="计算器键盘">
      {/* 简单模式：一行高频函数；专业模式：分组工具面板 */}
      {!pro ? (
        <div className="kbd-strip" role="toolbar" aria-label="常用函数">
          {SIMPLE_STRIP.map((k, i) => (
            <button key={`s${i}`} type="button" className="k-chip" title={k.title} onClick={() => onKey(k)}>
              {k.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="pro-panel" role="toolbar" aria-label="专业函数面板">
          {/* 学科选择：数学 / 物理 / 化学 */}
          <div className="seg pro-subjects" role="tablist" aria-label="学科选择">
            {SUBJECT_TABS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={subject === s.id}
                onClick={() => handleSubjectChange(s.id)}
              >
                <span className="subj-icon" aria-hidden="true">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
          {/* 功能分组 */}
          <div className="seg seg-s pro-tabs" role="tablist" aria-label="函数分组">
            {(activePanel ?? MATH_GROUPS).map((g) => (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={group === g.id}
                onClick={() => setGroup(g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="pro-grid">
            {(activeGroup ?? MATH_GROUPS[0]).keys.map((k, i) =>
              renderKey(k, `p${subject}-${group}-${i}`, 'key-fn key-sm')
            )}
          </div>
        </div>
      )}

      {/* 主键盘 */}
      <div className="keypad">
        {GRID.map((k, i) => {
          if (k.action.t === 'back' || k.action.t === 'move') {
            return (
              <button
                key={`g${i}`}
                type="button"
                className={`key ${k.cls ?? ''}`}
                title={k.title}
                aria-label={k.action.t === 'move' ? k.action.dir === 'left' ? '光标左移' : '光标右移' : '退格'}
                onClick={() => {
                  if (!backFired.current) onKey(k)
                  backFired.current = false
                }}
                onPointerDown={() => startBackRepeat(k)}
                onPointerUp={stopBackRepeat}
                onPointerLeave={stopBackRepeat}
                onContextMenu={(e) => e.preventDefault()}
              >
                {k.action.t === 'back' ? <Icon name="backspace" size={24} /> : k.label}
              </button>
            )
          }
          return renderKey(k, `g${i}`)
        })}
      </div>
    </div>
  )
}
