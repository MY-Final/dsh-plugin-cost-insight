/**
 * 花费徽标（conversation.session.header.utilities 插槽）：会话标题右侧显示
 * 本会话估算花费的 pill，超预算时警示色。session 级——数据链路与账单条相同
 * （tokenUsage 投影 × 价格表）。
 * @module dsh-plugin-cost-insight/client/header-badge
 */

import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { NAMESPACE } from './constants.ts'
import type { ProjectionFaceLike, SessionsLike, SettingsScopeLike } from './types.ts'
import type { BudgetConfig, PricingConfig, TokenUsageLike } from '../cost.ts'
import { estimateCost, formatCost } from '../cost.ts'

interface ConfigLike {
  pricing?: PricingConfig
  budget?: BudgetConfig
}

/** 在 `conversation.session.header.utilities` 插槽注册花费徽标。 */
export function registerHeaderBadge(ctx: Context, scope: SettingsScopeLike): void {
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register(
    {
      name: 'conversation.session.header.utilities',
      id: NAMESPACE,
      order: 30,
      inject: (sessionId) => {
        const sessions = ctx.get('sessions') as SessionsLike | undefined
        const tokens = sessions?.binding(sessionId)?.session.projections.faceOf('tokenUsage')
        return { scope, tokens }
      },
    },
    HeaderBadge,
  ))
}

/** 会话花费 pill。 */
function HeaderBadge(props: {
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
    'span',
    { className: over ? 'cis-badge cis-badge-warn' : 'cis-badge', title: '本次会话估算花费' },
    formatCost(cost, pricing.currency),
  )
}
