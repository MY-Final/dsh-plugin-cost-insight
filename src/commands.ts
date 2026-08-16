/**
 * /cost 命令（host 半边）：查询各 provider 余额。
 * 注意：本插件不注册模板演示命令（/hello、/dsh-demo），避免与已安装的
 * dsh-plugin-template 重复注册（命令名必须唯一）。
 *
 * 零新增依赖：ctx.commands 是 @deepseek-ai/dsh-commands 服务；本模块用最小
 * 结构类型 + 本地声明合并，通过 ctx.inject(['commands']) 可选子插件注册
 * （服务未组合时静默跳过，不影响插件加载）。完整契约见
 * @deepseek-ai/dsh-commands 的 CommandDefinition / CommandInvocation /
 * CommandResult。
 * @module dsh-plugin-cost-insight/commands
 */

import type { Context } from '@deepseek-ai/cordis'
import { queryBalance, type BalanceProviderConfig } from './balance.ts'

/** 命令调用参数的最小结构（dsh-commands CommandInvocation 的结构子集）。 */
interface CostCommandInvocation {
  /** 命令名之后的原文（含分隔空白）。 */
  readonly rawInput: string
}

/** 命令结果的最小结构（dsh-commands CommandResult 的结构子集）。 */
interface CostCommandResult {
  kind: 'success' | 'error'
  text?: string
}

/** 命令定义的最小结构（dsh-commands CommandDefinition 的结构子集）。 */
interface CostCommandDefinition {
  readonly name: string
  readonly description: string
  readonly handler: (invocation: CostCommandInvocation) => CostCommandResult | Promise<CostCommandResult>
}

/** 命令注册表的最小面（dsh-commands CommandRuntime 的结构子集）。 */
interface CommandsLike {
  register(definition: CostCommandDefinition): unknown
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** 命令注册表（运行时由 @deepseek-ai/dsh-commands 提供）。 */
    commands: CommandsLike
  }
}

/**
 * 注册 /cost 命令：查询各 provider 余额（M2 起追加会话费用统计与导出）。
 * @param ctx - 插件上下文。
 * @param getProviders - 惰性读取当前配置的 providers（settings 命名空间解析值）。
 */
export function registerCostCommand(
  ctx: Context,
  getProviders: () => BalanceProviderConfig[],
): void {
  ctx.inject(['commands'], (commandCtx) => {
    commandCtx.commands.register({
      name: 'cost',
      description: '查询各 provider 余额（M2 起含会话费用统计）。',
      handler: async ({ rawInput }) => {
        const providers = getProviders()
        if (providers.length === 0) {
          return {
            kind: 'success',
            text: '未配置任何 provider：在 cordis.yml 的 dsh-plugin-cost-insight.providers 里添加（模板见 docs/PLAN.md）。',
          }
        }
        const lines = (await Promise.all(providers.map((provider) => queryBalance(provider))))
          .map((result) => result.error !== undefined
            ? `- ${result.provider}: 查询失败（${result.error}）`
            : `- ${result.provider}: ${result.remaining} ${result.unit}${result.isValid ? '' : '（标记无效）'}`)
        const bare = rawInput.trim().length === 0
        return {
          kind: 'success',
          text: bare
            ? `【余额】\n${lines.join('\n')}\n\n会话费用统计将在 M2 提供。`
            : lines.join('\n'),
        }
      },
    })
  })
}
