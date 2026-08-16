# dsh-plugin-cost-insight 设计

消费洞察插件：查各中转站/厂商余额，估算每次会话花费，超预算提醒，可导出报销。基于 dsh-plugin-template（starter template，github.com/kun2-5code/dsh-plugin-template）骨架开发。

## 模块拆解

| 模块 | 需求 | 状态 |
|---|---|---|
| A. 余额查询 | cc-switch 式通用模板（request + extractor JS），支持 newapi/sub2api/one-api 系与 DeepSeek 官方 | **M1（本期）** |
| B. 会话费用 | token-meter 投影 × 价格表（模型单价 4 桶 + 中转站倍率），估算并标注 | M2 |
| C. /cost 命令 | 余额查询（本期）+ 会话花费/导出 | M1 余额 / M2 扩展 |
| D. 超预算 toast | client 侧算费用 + 阈值判断 → shell.overlay 浮动提醒（可关闭） | M2 |
| E. 报销导出 | 会话结算落本地 JSONL，/cost report 出 CSV | M3 |

## 已确认决策（2026-08-16）

1. "致谢" = 计费方式/价格表（即模块 B 要解决的）。
2. 第一版 = M1：改名 + 余额查询 + `/cost balance`。
3. extractor = **纯通用 JS 模板**（cc-switch 同款：每个 provider 都是 request + extractor）。

## 与插件模板共存（重要）

本插件与 dsh-plugin-template 可能同装进一个 profile，因此**不注册模板的演示内容**：
`greet` 工具、`/hello`、`/dsh-demo` 命令全部移除（工具名/命令名必须唯一，重复注册会加载报错）。
浏览器半边的 UI 插槽条目 id 用本插件自己的 NAMESPACE，不与模板冲突，可保留（M2 再按需清理）。

## M1 设计

### Config（cordis.yml / settings 命名空间 `dsh-plugin-cost-insight`）

```yaml
providers:
  - name: deepseek-official
    baseUrl: https://api.deepseek.com
    apiKey: sk-xxx
    request:
      url: '{{baseUrl}}/user/balance'
      method: GET
      headers:
        Authorization: 'Bearer {{apiKey}}'
    extractor: |
      function(response) {
        return {
          isValid: response.is_active || true,
          remaining: response.balance_infos && response.balance_infos[0]
            ? response.balance_infos[0].total_balance
            : 0,
          unit: 'CNY'
        };
      }
    unit: CNY
```

- `{{baseUrl}}` / `{{apiKey}}` 占位符在请求 URL 与 header 值里替换（cc-switch 约定）。
- extractor 是 JS 函数源码，`new Function('response', ...)` 执行，返回 `{ isValid, remaining, unit }`。
- token plan 厂商（火山/智谱/MiniMax/Qwen/Kimi/opencode go 等）第一版走通用模板自行配置；后续按需加 preset。

### src/balance.ts

- `queryBalance(provider, timeoutMs)`：拼请求 → fetch（Node 全局，零依赖）→ 跑 extractor → 归一化 `{ provider, isValid, remaining, unit, error? }`。
- 失败（HTTP 非 2xx / JSON 解析失败 / extractor 抛错 / 超时）返回 error 分支，命令层展示。

### /cost 命令（src/commands.ts）

- `/cost`：各 provider 余额列表 + "会话费用统计将在 M2 提供"。
- `/cost balance`：仅余额。

### 安全（extractor = 配置即代码）

- extractor 用 `new Function` 在插件进程内执行，拥有用户自身权限——**只应放信任来源的 extractor**（与 cc-switch 同立场）。
- M1 防护：AbortController 超时（覆盖 async 分支）；同步死循环无法中断，文档明示。
- M2 迭代：接入 harness 代码沙箱（cordis-host-runner / sandbox）再放开。

## M2 设计（预留）

- 价格表：Config 增加 `pricing`（模型名 → { input, cacheRead, cacheWrite, output } 单价）+ `multiplier`（倍率），内置主流模型预设、用户可覆盖。
- 数据：`TokenUsageProjection`（uncachedInputTokens / cacheReadTokens / cacheWriteTokens / outputTokens，按会话持久累积）。
- 精度：按会话最后使用模型计价，界面标注"估算"（TokenUsageProjection 不含模型信息，切模型是已知缺口）。
- UI：`conversation.composer.dock` 账单条（本次会话 ¥0.35 · 较上次 −12%）、`conversation.session.header.utilities` 花费徽标、超预算 `shell.overlay` toast。
- 清理：浏览器半边演示插槽按需移除，配置卡片换成 providers 配置页（settings.section）。

## M3 设计（预留）

- `conversation.view` 成本报表 tab：按天/按会话/按工具。
- 报销：会话结算落本地 JSONL，`/cost report` 导出 CSV。
