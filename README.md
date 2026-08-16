# dsh-plugin-cost-insight

**English** | [简体中文](README.zh.md)

Cost insight for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`): query provider balances through cc-switch-style templates, estimate per-session spend, get over-budget alerts, and export records for reimbursement.

Built on the [dsh-plugin-template](https://github.com/kun2-5code/dsh-plugin-template) skeleton. It deliberately does **not** register the template's demo content (the `greet` tool, `/hello`, `/dsh-demo`), so it can coexist with the template in one profile without duplicate tool/command names.

## M1 (current): balance query

Every provider is described by a cc-switch-style generic template — a request plus a small JS extractor — so any station or vendor with a balance API fits without waiting for a preset:

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

- `{{baseUrl}}` / `{{apiKey}}` placeholders are substituted into the URL and header values.
- The extractor receives the JSON response and returns `{ isValid, remaining, unit }`.
- Works for DeepSeek official, newapi / sub2api / one-api style relays, and token-plan vendors (Volcano, Zhipu, MiniMax, Qwen, Kimi, opencode go) — configure each through the same template.

Query balances from any session:

```
/cost           # per-provider balances (M2 note appended)
/cost balance   # balances only
```

> ⚠️ **The extractor is configuration-as-code**: it runs with `new Function` inside the plugin process. Only use extractors from sources you trust; M1 guards with a request timeout only.

## Roadmap

- **M2** — per-session cost estimate: a price table (model prices × relay multiplier) × the harness's `token-meter` projection; a composer bill strip, a session-header spend badge, and an over-budget toast (`shell.overlay`).
- **M3** — a cost report view (`conversation.view`) and CSV export for reimbursement (`/cost report`).

Design details: [docs/PLAN.md](docs/PLAN.md).

## Install & configure

```sh
dsh plugin --profile web add /path/to/dsh-plugin-cost-insight   # or github:MY-Final/dsh-plugin-cost-insight
```

The shipped `cordis.patch.yml` carries a DeepSeek example — set a real `apiKey`, or override the whole row by `id: dsh-plugin-cost-insight` in your profile's `cordis.patch.yml`. Then type `/cost` in a session.

## Local development

From a [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) source checkout, load the host half directly:

```sh
pnpm dsh web --patch /absolute/path/to/dsh-plugin-cost-insight/dev/cordis.yml
```

To test the browser half, install into a profile instead. Inside this repo:

```sh
pnpm install --ignore-workspace   # required when the repo sits inside a harness checkout
pnpm typecheck
pnpm build
node test/smoke.mjs
```

## Directory structure

```
src/
├── index.ts        # plugin entry: Config (providers) + settings-namespace wiring
├── balance.ts      # cc-switch-style balance query (request + extractor, timeout)
├── commands.ts     # /cost command
├── service.ts      # optional example Service (disabled by default)
├── hook.ts         # optional example hook permission gate (disabled by default)
└── client/         # browser half (slot demos kept from the template; M2 prunes)
docs/PLAN.md        # design doc (modules, decisions, M1/M2/M3)
```
