import Icon from './Icon'
import type { IconName } from './Icon'

interface EmptyStateProps {
  icon: IconName
  title: string
  desc: string
}

/** 模块占位（开发阶段使用，随阶段推进逐个替换为真实实现） */
export default function EmptyState({ icon, title, desc }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={40} strokeWidth={1.4} />
      <h2>{title}</h2>
      <p>{desc}</p>
    </div>
  )
}
