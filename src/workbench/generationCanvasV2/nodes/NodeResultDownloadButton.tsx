import React from 'react'
import { IconDownload } from '@tabler/icons-react'
import { cn } from '../../../utils/cn'
import { getDesktopBridge } from '../../../desktop/bridge'
import { toast } from '../../../ui/toast'
import type { GenerationCanvasNode } from '../model/generationCanvasTypes'

// 下载结果到本地：图片/视频/素材统一一条路径——把 result.url（本地 nomi-local 或远端 http）另存到用户选定位置。
// 从 BaseGenerationNode 抽出（规则 12 巨壳净减）。文件名由节点标题 derive，扩展名由主进程按 url/类型补全。
// 节点头部右上角圆形图标钮，与「查看生成记录」同形态；只在有可下载结果（非纯文本）时渲染。

type Props = {
  node: GenerationCanvasNode
}

export default function NodeResultDownloadButton({ node }: Props): JSX.Element | null {
  const [downloading, setDownloading] = React.useState(false)
  const url = node.result?.url
  const type = node.result?.type
  if (!url || type === 'text') return null

  const handleDownload = async () => {
    const bridge = getDesktopBridge()
    if (!bridge) return
    const base = (node.title || '').trim() || (type === 'video' ? '视频' : '图片')
    // url 已带扩展名就让主进程沿用；否则按类型补一个合理默认（不在这里钉死最终名）。
    const urlExt = /\.[a-z0-9]{1,5}(?:$|\?)/i.test(url) ? '' : type === 'video' ? '.mp4' : '.png'
    setDownloading(true)
    try {
      const res = await bridge.assets.download({ url, suggestedName: base + urlExt })
      if (res.ok) toast('已保存到本地', 'success')
      else if (!res.canceled) toast('下载失败', 'error')
    } catch (error) {
      toast(error instanceof Error ? error.message : '下载失败', 'error')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <button
      type="button"
      className={cn(
        'inline-grid place-items-center w-6 h-6 rounded-full',
        'bg-nomi-paper/[0.82] text-nomi-ink-60 hover:text-nomi-ink',
        'backdrop-blur-[8px] cursor-pointer pointer-events-auto',
        'transition-colors duration-150',
        'disabled:opacity-50 disabled:cursor-wait',
      )}
      aria-label="下载到本地"
      title="下载 / 另存到本地"
      disabled={downloading}
      onClick={(event) => {
        event.stopPropagation()
        void handleDownload()
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <IconDownload size={14} stroke={1.6} />
    </button>
  )
}
