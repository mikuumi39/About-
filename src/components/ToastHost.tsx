import { useToast } from '../store/toast'

/** 全局 Toast 宿主：挂在 App 根部 */
export default function ToastHost() {
  const toasts = useToast((s) => s.toasts)
  if (toasts.length === 0) return null
  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.text}
        </div>
      ))}
    </div>
  )
}
