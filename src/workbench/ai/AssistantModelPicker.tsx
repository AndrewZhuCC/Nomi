// 助手模型选择器：让用户指定创作/画布 agent 用哪个 text 模型（根治「盲选第一个=撞到不响应的就全卡」）。
// 写偏好到 localStorage（assistantModelPref），runWorkbenchAgent 自动带进 payload，两个面板都生效。
import React from 'react'
import { cn } from '../../utils/cn'
import { listWorkbenchModelCatalogModels, type ModelCatalogModelDto } from '../api/modelCatalogApi'
import { getAssistantModelPref, setAssistantModelPref } from './assistantModelPref'

export default function AssistantModelPicker(): JSX.Element | null {
  const [models, setModels] = React.useState<ModelCatalogModelDto[]>([])
  const [modelKey, setModelKey] = React.useState<string>(() => getAssistantModelPref()?.modelKey || '')

  React.useEffect(() => {
    let alive = true
    listWorkbenchModelCatalogModels({ kind: 'text', enabled: true })
      .then((rows) => { if (alive) setModels(rows) })
      .catch(() => { if (alive) setModels([]) })
    const sync = () => setModelKey(getAssistantModelPref()?.modelKey || '')
    window.addEventListener('nomi:assistant-model-changed', sync)
    return () => { alive = false; window.removeEventListener('nomi:assistant-model-changed', sync) }
  }, [])

  // 没有可选 text 模型时不渲染（无意义）。
  if (models.length === 0) return null

  const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value
    setModelKey(next)
    const picked = models.find((m) => m.modelKey === next)
    setAssistantModelPref(picked ? { vendorKey: picked.vendorKey, modelKey: picked.modelKey } : null)
  }

  return (
    <select
      aria-label="助手模型"
      title="助手用哪个模型（选一个能响应的；留空＝自动选第一个可用）"
      value={modelKey}
      onChange={onChange}
      className={cn(
        'h-[26px] max-w-[160px] rounded-full border border-nomi-line bg-nomi-paper',
        'px-2 text-[12px] text-nomi-ink-80 cursor-pointer',
        'hover:border-nomi-ink-20 focus:outline-none focus:border-nomi-accent',
      )}
    >
      <option value="">自动选模型</option>
      {models.map((m) => (
        <option key={`${m.vendorKey}:${m.modelKey}`} value={m.modelKey}>
          {m.labelZh || m.modelKey}
        </option>
      ))}
    </select>
  )
}
