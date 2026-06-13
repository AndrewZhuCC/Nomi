/**
 * 创作助手输入的意图路由（对话驱动，用户拍板 2026-06-13 删固定 chip 后）。
 *
 * 删掉「拆镜头 / 立角色卡」执行按钮后，这两个跨面板动作只能由自然语言触发，
 * 所以 pattern 的覆盖面就是用户能不能用上功能的唯一保证——抽成纯函数单测锁死。
 * skill 端再按完整 message 判断单层/轨迹（见 SKILL.md「两种模式」）。
 */

export type CreationIntent = 'storyboard' | 'fixation' | null

// 覆盖「只要镜头图」与「要完整轨迹/视频」两类说法；命中即把正文甩给画布 agent。
const STORYBOARD_REQUEST_PATTERN = /拆镜头|分镜|拆分|拆成.{0,4}镜头|做成视频|生成视频|做成.{0,3}片|成片|镜头脚本/
const FIXATION_REQUEST_PATTERN = /立角色卡|角色卡|人物卡|定妆|角色设定|建.{0,2}角色/

/**
 * 把用户输入归类到跨面板动作。storyboard 优先（「分镜」「拆」类词更高频明确）；
 * 都不命中返回 null → 走通用创作 AI（续写/改写文稿）。
 */
export function routeCreationIntent(text: string): CreationIntent {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (STORYBOARD_REQUEST_PATTERN.test(trimmed)) return 'storyboard'
  if (FIXATION_REQUEST_PATTERN.test(trimmed)) return 'fixation'
  return null
}
