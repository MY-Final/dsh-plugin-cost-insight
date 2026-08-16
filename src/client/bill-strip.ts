/**
 * 账单条（conversation.composer.dock 插槽）：输入卡片下方实时显示本次会话
 * 估算花费；超过单会话预算时变警示色。session 级——inject 工厂经 ctx.sessions
 * 拿到本会话的 tokenUsage 投影（ObservableSnapshot），组件用
 * useSyncExternalStore 订阅；配置经 settingsScope 惰性读取，改配置立即生效。
 * @module dsh-plugin-cost-insight/client/bill-strip
 */

import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { NAMESPACE } from './constants.ts'
import type { ProjectionFaceLike, SessionsLike, SettingsScopeLike } from './types.ts'
import type { BudgetConfig, PricingConfig, TokenUsageLike } from '../cost.ts'
import { estimateCost, formatCost } from '../cost.ts'

/** 命名空间解析值的结构子集（Config）。 */
interface ConfigLike {
  pricing?: PricingConfig
  budget?: BudgetConfig
}

/** 在 `conversation.composer.dock` 插槽注册账单条。 */
export function registerBillStrip(ctx: Context, scope: SettingsScopeLike): void {
  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register(
    {
      name: 'conversation.composer.dock',
      id: NAMESPACE,
      order: 30,
      inject: (sessionId) => {
        const sessions = ctx.get('sessions') as SessionsLike | undefined
        const tokens = sessions?.binding(sessionId)?.session.projections.faceOf('tokenUsage')
        return { scope, tokens }
      },
    },
    BillStrip,
  ))
}

/** 账单条：本次会话估算花费 + 预算警示。 */
function BillStrip(props: {
  scope: SettingsScopeLike
  tokens?: ProjectionFaceLike
}): React.ReactElement | null {
  const subscribeScope = React.useMemo(() => props.scope.subscribe.bind(props.scope), [props.scope])
  const snapshot = React.useSyncExternalStore(subscribeScope, props.scope.getSnapshot.bind(props.scope))
  const subscribeTokens = React.useMemo(
    () => props.tokens === undefined ? (): (() => void) => () => {} : props.tokens.subscribe.bind(props.tokens),
    [props.tokens],
  )
  const getTokens = React.useMemo(
    () => props.tokens === undefined ? (): unknown => undefined : (): unknown => props.tokens!.getSnapshot(),
    [props.tokens],
  )
  const tokens = React.useSyncExternalStore(subscribeTokens, getTokens)

  const config = snapshot.value as ConfigLike | undefined
  const pricing = config?.pricing
  const usage = tokens as TokenUsageLike | undefined
  if (pricing === undefined || usage === undefined) return null

  const cost = estimateCost(usage, pricing)
  const over = config?.budget?.perSession !== undefined && cost > config.budget.perSession
  return React.createElement(
    'div',
    { className: over ? 'dtpl-strip dtpl-strip-warn' : 'dtpl-strip' },
    React.createElement('span', null, '本次会话'),
    React.createElement('span', { className: 'dtpl-strip-strong' }, formatCost(cost, pricing.currency)),
    over
      ? React.createElement('span', { className: 'dtpl-strip-warn' }, `⚠ 超预算（${formatCost(config.budget!.perSession!, pricing.currency)}）`)
      : null,
  )
}
