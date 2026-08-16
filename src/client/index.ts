/**
 * 客户端半边入口：组装 M2 的 UI 面——设置页（settings.section）、账单条
 * （composer.dock）、花费徽标（header.utilities）、预算提示（shell.overlay）。
 * 每个 UI 面一个独立模块，注册函数在 apply 里按序调用。
 *
 * 数据源：settingsScope 绑定命名空间 `dsh-plugin-cost-insight`（host 半边
 * installSettingsSection 注册，cordis.yml 配置是 base 层）；设置页写入用户层，
 * 其余组件惰性读取。命名空间未对 Web 暴露时（WEB_SETTINGS_NAMESPACES 白名单）
 * 各组件渲染说明状态而不是消失。
 * @module dsh-plugin-cost-insight/client
 */

import type { Context } from '@deepseek-ai/cordis'
import { NAMESPACE } from './constants.ts'
import { injectStyles } from './styles.ts'
import type { SettingsScopeBinderLike } from './types.ts'
import { registerSettingsPage } from './settings-page.ts'
import { registerBillStrip } from './bill-strip.ts'
import { registerHeaderBadge } from './header-badge.ts'
import { registerBudgetToast } from './budget-toast.ts'

/** 依赖的服务：slots 就绪后本插件才会加载。 */
export const inject = ['slots']

/**
 * 客户端插件主体：注入样式，绑定 settings 命名空间，注册各 UI 面。
 * settingsScope 是设置界面的可选能力；缺失时跳过（设置页/账单条等都无法取数）。
 * @param ctx - 客户端根上下文。
 */
export function apply(ctx: Context): void {
  injectStyles()
  const settingsScope = ctx.get('settingsScope') as SettingsScopeBinderLike | undefined
  if (settingsScope === undefined) return
  const scope = settingsScope.bind({ namespace: NAMESPACE })
  registerSettingsPage(ctx, scope)
  registerBillStrip(ctx, scope)
  registerHeaderBadge(ctx, scope)
  registerBudgetToast(ctx, scope)
}
