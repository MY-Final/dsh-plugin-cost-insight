# dsh-plugin-cost-insight

[English](README.md) | **简体中文**

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）消费洞察插件：按 cc-switch 式通用模板查询各中转站/厂商余额，估算每次会话花费，超预算提醒，可导出报销记录。

基于 [dsh-plugin-template](https://github.com/kun2-5code/dsh-plugin-template) 骨架开发，但**刻意不注册模板的演示内容**（`greet` 工具、`/hello`、`/dsh-demo` 命令），因此可以和模板同装一个 profile，不会重复注册工具/命令名。

## M1（当前）：余额查询

每个 provider 用 cc-switch 式通用模板描述——一段请求配置 + 一段 JS extractor——任何有余额接口的中转站/厂商都能适配，不用等预置：

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
        var info = response && response.balance_infos && response.balance_infos[0];
        return {
          isValid: !!(response && response.is_available),
          remaining: info ? info.total_balance : 0,
          unit: 'CNY'
        };
      }
    unit: CNY
```

- `{{baseUrl}}` / `{{apiKey}}` 占位符在 URL 与 header 值里替换。
- extractor 接收 JSON 响应，返回 `{ isValid, remaining, unit }`。
- 适配 DeepSeek 官方、newapi / sub2api / one-api 系中转，以及 token plan 厂商（火山、智谱、MiniMax、Qwen、Kimi、opencode go）——都走同一个模板。

在任意会话里查询：

```
/cost           # 各 provider 余额（附 M2 预告）
/cost balance   # 仅余额
```

> ⚠️ **extractor 是"配置即代码"**：它用 `new Function` 在插件进程内执行。只放信任来源的 extractor；M1 仅有请求超时防护。

## Roadmap

- **M2** —— 会话费用估算：价格表（模型单价 × 中转倍率）× harness 的 `token-meter` 投影；输入框账单条、会话头花费徽标、超预算 toast（`shell.overlay`）。
- **M3** —— 成本报表视图（`conversation.view`）与报销 CSV 导出（`/cost report`）。

设计细节见 [docs/PLAN.md](docs/PLAN.md)。

## 安装与配置

```sh
dsh plugin --profile web add /path/to/dsh-plugin-cost-insight   # 或 github:MY-Final/dsh-plugin-cost-insight
```

随包 `cordis.patch.yml` 自带 DeepSeek 示例——填上真实 `apiKey`，或在 profile 的 `cordis.patch.yml` 里按 `id: dsh-plugin-cost-insight` 覆盖整行。然后在会话里输入 `/cost`。

## 本地开发

在 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 源码根目录直接加载 host 半边：

```sh
pnpm dsh web --patch /absolute/path/to/dsh-plugin-cost-insight/dev/cordis.yml
```

要测浏览器半边则安装进 profile。本仓库内：

```sh
pnpm install --ignore-workspace   # 仓库嵌在 harness checkout 里时必须
pnpm typecheck
pnpm build
node test/smoke.mjs
```

## 目录结构

```
src/
├── index.ts        # 插件入口：Config（providers）+ settings 命名空间接线
├── balance.ts      # cc-switch 式余额查询（request + extractor，超时）
├── commands.ts     # /cost 命令
├── service.ts      # 可选示例 Service（默认注释启用）
├── hook.ts         # 可选示例 hook 权限门（默认注释启用）
└── client/         # 浏览器半边（保留模板插槽演示，M2 清理）
docs/PLAN.md        # 设计文档（模块拆解、决策、M1/M2/M3）
```
