/**
 * 模型设置抽屉——抽屉打开后看到的内容。
 *
 * 结构（v0.9 策展接入）：
 *  - 顶部：已知供应商接入卡（apimart / kie …）。填一个 key → 该家全部预置模型点亮。
 *  - 中部：「其他模型」= 用户自定义接入的长尾模型（按 kind 分组，可删）。
 *  - 底部入口：[+ 添加模型]（自定义/长尾逃生口，走 Wizard）。
 *
 * 已知供应商的模型只在卡片里展示（点亮态），不再在下方重复列出。
 * 卡片 = VendorOnboardCard 通用组件；新增一家只加 knownVendors 目录数据（P4）。
 */
import React from 'react'
import { Stack, Group, Text, ActionIcon } from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { DesignButton } from '../../design'
import { OnboardingWizard } from './OnboardingWizard'
import { VendorOnboardCard, type VendorCardModel } from './VendorOnboardCard'
import { KNOWN_VENDORS, isKnownVendor } from '../../config/knownVendors'
import { getDesktopBridge } from '../../desktop/bridge'
import { notifyModelOptionsRefresh } from '../../config/useModelOptions'

type ModelRow = {
  modelKey: string
  vendorKey: string
  labelZh: string
  kind: 'text' | 'image' | 'video' | 'audio'
}

type VendorMeta = {
  name: string
  hasApiKey: boolean
  baseUrl: string
}

const KIND_LABEL: Record<ModelRow['kind'], string> = {
  text: '文本',
  image: '图片',
  video: '视频',
  audio: '音频',
}

const KIND_ORDER: ModelRow['kind'][] = ['text', 'image', 'video', 'audio']

export function OnboardingDrawer(): JSX.Element {
  const [wizardOpen, setWizardOpen] = React.useState(false)
  const [models, setModels] = React.useState<ModelRow[]>([])
  const [vendorMeta, setVendorMeta] = React.useState<Map<string, VendorMeta>>(new Map())
  const [version, setVersion] = React.useState(0) // bump to refetch

  React.useEffect(() => {
    const bridge = getDesktopBridge()
    if (!bridge) return
    try {
      const ms = bridge.modelCatalog.listModels() as Array<Record<string, unknown>>
      const vs = bridge.modelCatalog.listVendors() as Array<Record<string, unknown>>
      const metaMap = new Map<string, VendorMeta>()
      for (const v of vs) {
        metaMap.set(String(v.key), {
          name: String(v.name || v.key),
          hasApiKey: Boolean(v.hasApiKey),
          baseUrl: String(v.baseUrlHint || ''),
        })
      }
      const rows: ModelRow[] = ms.map((m) => ({
        modelKey: String(m.modelKey),
        vendorKey: String(m.vendorKey),
        labelZh: String(m.labelZh || m.modelKey),
        kind: m.kind as ModelRow['kind'],
      }))
      setVendorMeta(metaMap)
      setModels(rows)
    } catch {
      setVendorMeta(new Map())
      setModels([])
    }
  }, [version])

  const refresh = React.useCallback(() => {
    notifyModelOptionsRefresh('all')
    setVersion((v) => v + 1)
  }, [])

  const handleDelete = React.useCallback((row: ModelRow) => {
    const bridge = getDesktopBridge()
    if (!bridge) return
    const ok = window.confirm(`删除「${row.labelZh}」？此操作不可恢复。`)
    if (!ok) return
    try {
      bridge.modelCatalog.deleteModel(row.vendorKey, row.modelKey)
      refresh()
    } catch (e) {
      window.alert(`删除失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }, [refresh])

  // 已知供应商：catalog 里存在该 vendor 才渲染卡片。
  const knownCards = KNOWN_VENDORS
    .map((directory) => {
      const meta = vendorMeta.get(directory.vendorKey)
      if (!meta) return null
      const vendorModels: VendorCardModel[] = models
        .filter((m) => m.vendorKey === directory.vendorKey)
        .map((m) => ({ modelKey: m.modelKey, labelZh: m.labelZh, kind: m.kind }))
      return { directory, meta, vendorModels }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  // 其他模型：非已知供应商的自定义接入。
  const otherModels = models.filter((m) => !isKnownVendor(m.vendorKey))
  const otherByKind: Record<ModelRow['kind'], ModelRow[]> = { text: [], image: [], video: [], audio: [] }
  for (const m of otherModels) otherByKind[m.kind].push(m)

  return (
    <Stack gap="md" p="md" style={{ height: '100%', minHeight: 0 }}>
      <Group justify="space-between" align="center">
        <Text size="sm" fw={700} c="var(--nomi-ink)">模型设置</Text>
        <DesignButton
          size="xs"
          variant="default"
          leftSection={<IconPlus size={14} />}
          onClick={() => setWizardOpen(true)}
        >
          添加模型
        </DesignButton>
      </Group>

      <Stack gap="md" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {/* 已知供应商接入卡 */}
        {knownCards.map(({ directory, meta, vendorModels }) => (
          <VendorOnboardCard
            key={directory.vendorKey}
            directory={directory}
            vendorName={meta.name}
            baseUrl={meta.baseUrl}
            hasApiKey={meta.hasApiKey}
            models={vendorModels}
            onChanged={refresh}
          />
        ))}

        {/* 其他模型（自定义/长尾） */}
        {otherModels.length > 0 ? (
          <Stack gap="sm">
            <Text size="xs" fw={600} c="var(--nomi-ink-60)">其他模型</Text>
            {KIND_ORDER.map((kind) => {
              const list = otherByKind[kind]
              if (list.length === 0) return null
              return (
                <Stack key={kind} gap={6}>
                  <Text size="xs" fw={500} c="var(--nomi-ink-40)" tt="uppercase">
                    {KIND_LABEL[kind]}
                  </Text>
                  {list.map((row) => (
                    <Group
                      key={`${row.vendorKey}-${row.modelKey}`}
                      justify="space-between"
                      align="center"
                      wrap="nowrap"
                      gap="xs"
                      px="xs"
                      py={6}
                      style={{
                        borderRadius: 'var(--nomi-radius-sm)',
                        background: 'var(--nomi-paper)',
                      }}
                    >
                      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" c="var(--nomi-ink)" truncate>{row.labelZh}</Text>
                        <Text size="xs" c="var(--nomi-ink-60)" truncate>
                          {vendorMeta.get(row.vendorKey)?.name || row.vendorKey}
                        </Text>
                      </Stack>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={() => handleDelete(row)}
                        aria-label={`删除 ${row.labelZh}`}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  ))}
                </Stack>
              )
            })}
          </Stack>
        ) : null}

        {knownCards.length === 0 && otherModels.length === 0 ? (
          <Stack align="center" justify="center" h={200} gap="xs">
            <Text size="sm" c="var(--nomi-ink-60)">还没有模型</Text>
            <Text size="xs" c="var(--nomi-ink-40)">点上方"添加模型"接入第一个</Text>
          </Stack>
        ) : null}
      </Stack>

      <OnboardingWizard
        opened={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCommitted={refresh}
      />
    </Stack>
  )
}
