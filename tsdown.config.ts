import { defineConfig } from 'tsdown'

// tsdown 只做转译与打包，不做类型检查（类型检查由 `pnpm typecheck` 负责）。
// prepare 脚本在 git 安装后由 pnpm 执行，因此构建必须自包含、不依赖 monorepo。
// fixedExtension: false —— 包声明 "type": "module"，保持 .js/.d.ts 扩展名，
// 与 package.json 的 exports 映射一致。
// M1 无浏览器半边（/cost 是纯 host 命令）；M2 引入账单条等 UI 时再加 client bundle。

/** Host 半边：Node 库，输出 lib/，供 cordis.yml 插件行按包名加载。 */
export default defineConfig({
  entry: ['src/index.ts', 'src/service.ts', 'src/hook.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  dts: true,
  clean: true,
  fixedExtension: false,
})
