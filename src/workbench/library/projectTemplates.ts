import { cloneBuiltinCategories, type ProjectCategory } from '../project/projectCategories'

export type ProjectTemplateId = 'manga-short' | 'product-demo' | 'free-form'

export type ProjectTemplate = {
  id: ProjectTemplateId
  name: string
  description: string
  enabledCategories: string[]
  seedDocument: string
  /** Suggested first-active category when the project opens. */
  defaultCategoryId: string
}

export const PROJECT_TEMPLATES: Record<ProjectTemplateId, ProjectTemplate> = {
  'manga-short': {
    id: 'manga-short',
    name: 'AI 漫剧短片',
    description: '5 分钟二次元短剧，预设故事 / 角色 / 场景 / 分镜 / 声音 / 资源池 / 导出',
    enabledCategories: ['story', 'characters', 'scenes', 'shots', 'audio', 'inbox', 'exports'],
    seedDocument: '# 第一幕\n\n@角色 主角 { 简述外观 / 性格 / 目标 }\n\n# 第二幕\n\n# 第三幕\n',
    defaultCategoryId: 'story',
  },
  'product-demo': {
    id: 'product-demo',
    name: '产品 Demo',
    description: '30-60 秒 SaaS 产品介绍，预设故事 / 风格 / 分镜 / 资源池 / 导出',
    enabledCategories: ['story', 'style', 'shots', 'inbox', 'exports'],
    seedDocument: '# 30 秒产品 Demo 脚本\n\n1. 问题（5s）：\n2. 方案（10s）：\n3. 演示（10s）：\n4. CTA（5s）：\n',
    defaultCategoryId: 'story',
  },
  'free-form': {
    id: 'free-form',
    name: '自由创作',
    description: '8 分类全开，无预设内容',
    enabledCategories: ['story', 'characters', 'scenes', 'style', 'shots', 'audio', 'inbox', 'exports'],
    seedDocument: '',
    defaultCategoryId: 'shots',
  },
}

export const PROJECT_TEMPLATE_LIST: ProjectTemplate[] = [
  PROJECT_TEMPLATES['manga-short'],
  PROJECT_TEMPLATES['product-demo'],
  PROJECT_TEMPLATES['free-form'],
]

export function getProjectTemplate(id: string | null | undefined): ProjectTemplate {
  if (id && (id in PROJECT_TEMPLATES)) return PROJECT_TEMPLATES[id as ProjectTemplateId]
  return PROJECT_TEMPLATES['free-form']
}

/** Builds the categories array for a template: builtins, with non-enabled marked hidden. */
export function buildTemplateCategories(template: ProjectTemplate): ProjectCategory[] {
  const enabled = new Set(template.enabledCategories)
  return cloneBuiltinCategories().map((cat) => ({
    ...cat,
    isHidden: !enabled.has(cat.id),
  }))
}
