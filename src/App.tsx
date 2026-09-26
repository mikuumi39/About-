import { lazy, Suspense, useEffect, useState } from 'react'
import AppShell from './components/AppShell'
import { parseHash } from './nav'
import { applyTheme } from './theme/themes'
import {
  bootstrapCustomThemes,
  installCustomStyles,
  useCustomThemes,
} from './theme/custom'
import { syncSettingsToDom, useSettings } from './store/settings'

// 计算器是首屏主视图，直接打包；其余视图按需加载，减小首屏体积
import CalcView from './views/CalcView'
const ChemView = lazy(() => import('./views/ChemView'))
const FormulaView = lazy(() => import('./views/FormulaView'))
const PlotView = lazy(() => import('./views/PlotView'))
const SymbolsView = lazy(() => import('./views/SymbolsView'))
const LearnView = lazy(() => import('./views/LearnView'))
const SettingsView = lazy(() => import('./views/SettingsView'))
import ToastHost from './components/ToastHost'

export default function App() {
  const [view, setView] = useState(parseHash)
  const themeId = useSettings((s) => s.themeId)
  const animations = useSettings((s) => s.animations)

  useEffect(() => {
    applyTheme(themeId, animations)
  }, [themeId, animations])

  // 第三方主题：启动装载样式；增删时同步重装
  useEffect(() => {
    bootstrapCustomThemes()
    return useCustomThemes.subscribe((s) => installCustomStyles(s.themes))
  }, [])

  useEffect(() => syncSettingsToDom(), [])

  useEffect(() => {
    const onHash = () => setView(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <AppShell view={view}>
      {view === 'calc' && <CalcView />}
      <Suspense
        fallback={
          <div className="view-loading" role="status" aria-label="加载中">
            <span className="spinner" aria-hidden="true" />
          </div>
        }
      >
        {view === 'chem' && <ChemView />}
        {view === 'formula' && <FormulaView />}
        {view === 'plot' && <PlotView />}
        {view === 'symbols' && <SymbolsView />}
        {view === 'learn' && <LearnView />}
        {view === 'settings' && <SettingsView />}
      </Suspense>
      <ToastHost />
    </AppShell>
  )
}
