import { describe, expect, it } from 'vitest'
import { routeCreationIntent } from './creationIntentRouting'

describe('routeCreationIntent（删 chip 后自然语言是唯一入口，覆盖面=可用性）', () => {
  it('「只要镜头图」类说法 → storyboard', () => {
    for (const text of ['帮我拆镜头', '把这段拆成 6 个镜头', '做个分镜', '拆分一下这个故事', '生成镜头脚本']) {
      expect(routeCreationIntent(text)).toBe('storyboard')
    }
  })

  it('「要完整轨迹/视频」类说法 → storyboard（skill 端再判轨迹模式）', () => {
    for (const text of ['把这个故事做成视频', '生成视频', '做成一条片子', '我要成片']) {
      expect(routeCreationIntent(text)).toBe('storyboard')
    }
  })

  it('「立角色卡」类说法 → fixation', () => {
    for (const text of ['给主角立角色卡', '建一个角色卡', '帮人物卡定妆', '做角色设定', '建个角色']) {
      expect(routeCreationIntent(text)).toBe('fixation')
    }
  })

  it('普通创作请求 → null（走通用创作 AI，不误触发跨面板动作）', () => {
    for (const text of ['帮我把这段写得更生动', '续写下一段', '这句话怎么改', '总结一下', '']) {
      expect(routeCreationIntent(text)).toBeNull()
    }
  })
})
