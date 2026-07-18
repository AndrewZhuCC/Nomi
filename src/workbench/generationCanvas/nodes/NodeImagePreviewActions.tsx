import React from 'react'
import { IconInfoCircle, IconMaximize } from '@tabler/icons-react'
import { cn } from '../../../utils/cn'
import { NodeImageLightbox } from './NodeImageLightbox'
import { EditableNodeTitle } from './render/EditableNodeTitle'

export function NodeImagePreviewButton({ src, title }: { src: string; title?: string }): JSX.Element {
  const [open, setOpen] = React.useState(false)
  const close = React.useCallback(() => setOpen(false), [])
  const label = title || '图片'
  return (
    <>
      <button
        type="button"
        className={cn(
          'inline-grid place-items-center w-6 h-6 rounded-full border-0',
          'bg-nomi-paper/[0.82] text-nomi-ink-60 hover:text-nomi-ink',
          'backdrop-blur-[8px] cursor-pointer pointer-events-auto',
          'transition-colors duration-150',
          'focus-visible:outline-2 focus-visible:outline-nomi-accent focus-visible:outline-offset-2',
        )}
        aria-label={`放大预览：${label}`}
        title="放大预览"
        data-node-image-preview-open="true"
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <IconMaximize size={14} stroke={1.6} aria-hidden="true" />
      </button>
      <NodeImageLightbox open={open} src={src} title={title} onClose={close} />
    </>
  )
}

export function NodeResultHeaderActions({
  imageSrc,
  title,
  onOpenProvenance,
}: {
  imageSrc?: string
  title?: string
  onOpenProvenance: () => void
}): JSX.Element {
  return (
    <span className="ml-auto inline-flex items-center gap-1">
      {imageSrc ? <NodeImagePreviewButton src={imageSrc} title={title} /> : null}
      <button
        type="button"
        className={cn(
          'inline-grid place-items-center w-6 h-6 rounded-full border-0',
          'bg-nomi-paper/[0.82] text-nomi-ink-60 hover:text-nomi-ink',
          'backdrop-blur-[8px] cursor-pointer pointer-events-auto',
          'transition-colors duration-150',
          'focus-visible:outline-2 focus-visible:outline-nomi-accent focus-visible:outline-offset-2',
        )}
        aria-label="查看生成记录"
        title="生成记录 / Provenance"
        onClick={(event) => {
          event.stopPropagation()
          onOpenProvenance()
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <IconInfoCircle size={14} stroke={1.6} aria-hidden="true" />
      </button>
    </span>
  )
}

export function NodeInlineImageTitle({
  nodeId,
  value,
  selected,
}: {
  nodeId: string
  value: string
  selected: boolean
}): JSX.Element {
  return (
    <div
      className={cn(
        'absolute bottom-2 left-2 z-[4] max-w-[calc(100%-72px)] rounded-nomi-sm px-2 py-1',
        'bg-nomi-ink/85 text-nomi-paper shadow-nomi-sm backdrop-blur-[8px] pointer-events-auto',
        'transition-opacity duration-[var(--nomi-transition-fast)]',
        selected ? 'opacity-100' : 'opacity-0 group-hover/node:opacity-100 focus-within:opacity-100',
      )}
      data-node-inline-title="true"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <EditableNodeTitle
        nodeId={nodeId}
        value={value}
        placeholder="未命名图片"
        className="max-w-full text-caption font-semibold text-nomi-paper"
      />
    </div>
  )
}
