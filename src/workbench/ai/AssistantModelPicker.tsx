// 助手模型选择器：让用户指定创作/画布 agent 用哪个 text 模型（根治「盲选第一个=撞到不响应的就全卡」）。
// 写偏好到 localStorage（assistantModelPref），runWorkbenchAgent 自动带进 payload，两个面板都生效。
import React from 'react'
import { listWorkbenchModelCatalogModels, type ModelCatalogModelDto } from '../api/modelCatalogApi'
import { getAssistantModelPref, setAssistantModelPref } from './assistantModelPref'
import { NomiSelect } from '../../design'

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

  const handleChange = (next: string) => {
    setModelKey(next)
    const picked = models.find((m) => m.modelKey === next)
    setAssistantModelPref(picked ? { vendorKey: picked.vendorKey, modelKey: picked.modelKey } : null)
  }

  return (
    <NomiSelect
      ariaLabel="助手模型"
      title="助手用哪个模型（选一个能响应的；留空＝自动选第一个可用）"
      size="xs"
      triggerMaxWidth={160}
      value={modelKey}
      options={[{ value: '', label: '自动选模型' }, ...models.map((m) => ({ value: m.modelKey, label: m.labelZh || m.modelKey }))]}
      onChange={handleChange}
    />
  )
}
