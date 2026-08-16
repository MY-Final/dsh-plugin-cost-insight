# dsh-plugin-cost-insight 设计

消费洞察插件：查各中转站/厂商余额，估算每次会话花费，超预算提醒，可导出报销。基于 dsh-plugin-template（starter template，github.com/kun2-5code/dsh-plugin-template）骨架开发。

## 模块拆解

| 模块 | 需求 | 状态 |
|---|---|---|
| A. 余额查询 | cc-switch 式通用模板（request + extractor JS），支持 newapi/sub2api/one-api 系与 DeepSeek 官方 | ✅ M1 |
| B. 会话费用 | token-meter 投影 × 价格表（模型单价 4 桶 + 中转站倍率），估算并标注 | ✅ M2（估算，见下） |
| C. /cost 命令 | 余额查询 | ✅ M1；会话花费/导出 M3 |
| D. 预算提醒 | 账单条警示（session 级）+ 可关闭提示 pill（shell.overlay，root 级展示预算配置） | ✅ M2 |
| E. 报销导出 | 会话结算落本地 JSONL，/cost report 出 CSV | M3 |

## M2 已交付

- **设置页（settings.section）**：设置 → 消费洞察，在线编辑 provider / 价格表 / 预算，保存按字段写入 settings 命名空间（schema 校验 + revision 围栏）。命名空间未对 Web 暴露时渲染说明卡。
- **账单条（composer.dock）**：本次会话估算花费，超预算警示色。
- **花费徽标（header.utilities）**：会话标题旁花费 pill，超预算警示色。
- **预算提示（shell.overlay）**：root 级可关闭提示（展示预算配置；超限实时警示由 session 级账单条承担——root 无会话数据）。
- **费用估算**：`src/cost.ts` 纯函数（共享导出），价格按每 1M token、乘以倍率、按 defaultModel 计价；投影不含模型信息，界面按"估算"处理。
- **浏览器设置页需要白名单**：命名空间 `dsh-plugin-cost-insight` 需加入 harness 的 WEB_SETTINGS_NAMESPACES 才能可编辑。

## 已确认决策（2026-08-16）

1. "致谢" = 计费方式/价格表（即模块 B 要解决的）。
2. 第一版 = M1：改名 + 余额查询 + `/cost balance`。
3. extractor = **纯通用 JS 模板**（cc-switch 同款：每个 provider 都是 request + extractor）。

## 与插件模板共存（重要）

本插件与 dsh-plugin-template 可能同装进一个 profile，因此**不注册模板的演示内容**：
`greet` 工具、`/hello`、`/dsh-demo` 命令全部移除（工具名/命令名必须唯一，重复注册会加载报错）。
M1 无浏览器半边，client 目录整体移除；M2 起按需从模板取回账单条 / 花费徽标 / 预算 toast 等组件。

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
            ? Number(response.balance_infos[0].total_balance)
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
- 失败（HTTP 非 2xx / JSON 解析失败 / extractor 抛错 / 超时）返回 error 分支，命令层展示；非 2xx 附带响应体摘要，401 可看到厂商鉴权原文。
- `remaining` 先经 `Number()` 归一：厂商把余额返回成字符串（DeepSeek 的 `"110.00"`）也能通过校验。

### /cost 命令（src/commands.ts）

- `/cost`：各 provider 余额列表（会话费用在 UI 账单条/徽标展示）。
- `/cost balance`：仅余额。
- API Key 为空或占位符 `sk-xxx` 时，失败行追加"到 设置 → 消费洞察 填真实 Key"的提示。

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
