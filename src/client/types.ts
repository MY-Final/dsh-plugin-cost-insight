/**
 * 客户端半边的最小结构类型：运行时实例全部来自 ctx 服务（cordis 的 ctx.get /
 * 声明合并），不 import 任何 @deepseek-ai 客户端包，避免跨插件值导入与版本分裂。
 * 完整契约见 dsh-client-runtime / dsh-client-ui-slots / dsh-client-ui-settings。
 * @module dsh-plugin-cost-insight/client/types
 */

/** 一个 settings 命名空间在浏览器侧的同步快照（SettingsScopeSnapshot 的结构子集）。 */
export interface SettingsSnapshot {
  status: 'loading' | 'ready' | 'unavailable'
  /** 最近一次 schema 解析后的值（schema 默认 → base → 用户层）。 */
  value: unknown
  /** 原始用户层（已存储）；字段在此出现即视为"用户覆盖"。 */
  user: unknown
  /** Host 文档是否可写（memory 模式永远不可写）。 */
  writable: boolean
}

/** 浏览器侧 settings scope 的最小面（SettingsScope 的结构子集）。 */
export interface SettingsScopeLike {
  getSnapshot(): SettingsSnapshot
  /** 观察快照替换；返回移除监听器的 disposer。 */
  subscribe(listener: () => void): () => void
  /** 写一个字段（整体替换该字段的用户层值，自带 revision 围栏）。 */
  set(field: string, value: unknown): Promise<void>
  /** 清除一个字段，让它重新继承 composition base 层。 */
  unset(field: string): Promise<void>
}

/** settingsScope 服务的最小面（SettingsScopeBinder）。 */
export interface SettingsScopeBinderLike {
  bind(spec: { namespace: string }): SettingsScopeLike
}

/** 一次 slots.register 的最小选项（ErasedOptions 结构子集）。 */
export interface SlotOptions {
  name: string
  /** keyed 插槽的键。 */
  key?: string
  /** list 插槽的条目标识。 */
  id?: string
  /** 渲染顺序。 */
  order?: number
  /** 列表条目显示标签（如设置页导航文字）。 */
  label?: string
  /** session 级插槽的注入工厂：收到 sessionId，返回注入给组件的面。 */
  inject?: (sessionId: string) => Record<string, unknown>
}

/** 浏览器插槽服务的最小面（ui-slots 的结构子集）。 */
export interface SlotsLike {
  inject(name: string, register: () => unknown): void
  register(options: SlotOptions, component: unknown): unknown
}

/** 会话投影面（ObservableSnapshot 的结构子集）。 */
export interface ProjectionFaceLike {
  getSnapshot(): unknown
  subscribe(listener: () => void): () => void
}

/** 客户端会话投影入口（Session.projections 的结构子集）。 */
export interface SessionLike {
  projections: {
    faceOf(key: string): ProjectionFaceLike
  }
}

/** 客户端 sessions 服务的最小面。 */
export interface SessionsLike {
  binding(sessionId: string): { session: SessionLike } | undefined
}

// 'slots' 是 inject 声明的必选依赖，按约定通过 ctx.slots 使用；cordis 原生
// Context 没有 slots 成员，因此用本地最小结构类型做声明合并，运行时实例来自 ctx。
declare module '@deepseek-ai/cordis' {
  interface Context {
    /** 浏览器插槽服务（运行时由 client-ui-slots 提供）。 */
    slots: SlotsLike
  }
}
