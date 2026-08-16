/**
 * 预算提示（shell.overlay 插槽）：右下角一枚可关闭的提示 pill。root 级——
 * 拿不到具体会话的 token 数据，因此提示预算配置本身（"已设置单会话上限，
 * 超限时账单条会警示"），超限的实时警示由 session 级的账单条承担。
 * @module dsh-plugin-cost-insight/client/budget-toast
 */

import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { NAMESPACE } from './constants.ts'
import type { SettingsScopeLike } from './types.ts'

interface ConfigLike {
  budget?: { perSession?: number }
}

/** 在 `shell.overlay` 插槽注册预算提示 pill。 */
export function registerBudgetToast(ctx: Context, scope: SettingsScopeLike): void {
  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: NAMESPACE, order: 30 },
    () => React.createElement(BudgetToast, { scope }),
  ))
}

/** 可关闭的预算提示 pill；未配置预算时不渲染。 */
function BudgetToast({ scope }: { scope: SettingsScopeLike }): React.ReactElement | null {
  const subscribe = React.useMemo(() => scope.subscribe.bind(scope), [scope])
  const snapshot = React.useSyncExternalStore(subscribe, scope.getSnapshot.bind(scope))
  const [dismissed, setDismissed] = React.useState(false)
  const budget = (snapshot.value as ConfigLike | undefined)?.budget?.perSession
  if (dismissed || budget === undefined) return null
  return React.createElement(
    'div',
    { className: 'dtpl-overlay', role: 'status' },
    React.createElement('span', null, `已设置单会话预算 ${budget}；超限时输入框下方账单条会警示。`),
    React.createElement(
      'button',
      {
        type: 'button',
        className: 'dtpl-overlay-close',
        'aria-label': '关闭预算提示',
        onClick: () => setDismissed(true),
      },
      '×',
    ),
  )
}
