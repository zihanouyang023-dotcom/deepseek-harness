/**
 * The desktop's viewing store: window geometry, minimize/maximize flags,
 * z-order, and the start/details panel state, persisted across reloads.
 * Module level exports the factory only (a module-level handle would pin the
 * store identity across plugin reloads); register() receives the factory and
 * the desktop derives its PropsStore share from the return type.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import type { WindowGeometry } from './contract.ts'

/** Default window size for a workspace without stored geometry. */
export const DEFAULT_WINDOW: WindowGeometry = { x: 48, y: 36, w: 960, h: 620 }
/** Per-window cascade offset for deterministic default placement. */
export const CASCADE_STEP = 28
/** Fixed taskbar height in px (windows and the work area avoid it). */
export const TASKBAR_HEIGHT = 48
/** Minimum window size the store clamps resizes to. */
export const MIN_WINDOW = { w: 320, h: 240 }

/** Windows desktop viewing state persisted across surface remounts and reloads. */
export type DesktopState = {
  /** Per-workspace geometry, keyed by the workspace id's string form. */
  geometry: Record<string, WindowGeometry>
  /** Minimized flags per workspace (hidden from the work area, kept on the taskbar). */
  minimized: Record<string, boolean>
  /** Maximized flags per workspace (fills the work area). */
  maximized: Record<string, boolean>
  /** Back-to-front window order: the last id renders on top. */
  zOrder: string[]
  /** Start panel open (hosts the sidebar seat). */
  startOpen: boolean
  /** Details pane open inside the focused window. */
  detailsOpen: boolean
}

/** Annotation twin of the actions literal below (the export needs a declared return type). */
export type DesktopActions = {
  syncWindows: (draft: DesktopState, ids: readonly string[]) => void
  focus: (draft: DesktopState, id: string) => void
  minimize: (draft: DesktopState, id: string) => void
  restore: (draft: DesktopState, id: string) => void
  toggleMaximize: (draft: DesktopState, id: string) => void
  move: (draft: DesktopState, id: string, x: number, y: number) => void
  resize: (draft: DesktopState, id: string, w: number, h: number) => void
  toggleStart: (draft: DesktopState) => void
  setStartOpen: (draft: DesktopState, open: boolean) => void
  setDetailsOpen: (draft: DesktopState, open: boolean) => void
}

/**
 * Compute the default geometry of the n-th window (deterministic cascade from
 * the fixed start point, so a recreated workspace never lands on another).
 * @param index - position in the workspace list.
 * @returns the cascade geometry.
 */
export function defaultGeometry(index: number): WindowGeometry {
  const offset = index * CASCADE_STEP
  return { x: DEFAULT_WINDOW.x + offset, y: DEFAULT_WINDOW.y + offset, w: DEFAULT_WINDOW.w, h: DEFAULT_WINDOW.h }
}

/**
 * Create the windows desktop store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createWindowsStore(): EngineStoreHandle<DesktopState, DesktopActions> {
  return defineStore({
    init: (): DesktopState => ({
      geometry: {},
      minimized: {},
      maximized: {},
      zOrder: [],
      startOpen: false,
      detailsOpen: false,
    }),
    persist: 'dsh.windows.desktop.v1',
    actions: {
      syncWindows: (d, ids) => {
        const kept = new Set(ids)
        d.geometry = Object.fromEntries(Object.entries(d.geometry).filter(([id]) => kept.has(id)))
        d.minimized = Object.fromEntries(Object.entries(d.minimized).filter(([id]) => kept.has(id)))
        d.maximized = Object.fromEntries(Object.entries(d.maximized).filter(([id]) => kept.has(id)))
        d.zOrder = d.zOrder.filter(id => kept.has(id))
        ids.forEach((id, index) => {
          if (d.geometry[id] === undefined) d.geometry[id] = defaultGeometry(index)
          if (!d.zOrder.includes(id)) d.zOrder.push(id)
        })
      },
      focus: (d, id) => {
        if (!d.zOrder.includes(id)) return
        d.zOrder = [...d.zOrder.filter(z => z !== id), id]
      },
      minimize: (d, id) => {
        d.minimized[id] = true
      },
      restore: (d, id) => {
        d.minimized[id] = false
      },
      toggleMaximize: (d, id) => {
        d.maximized[id] = !(d.maximized[id] === true)
      },
      move: (d, id, x, y) => {
        const g = d.geometry[id]
        if (g === undefined) return
        g.x = Math.max(0, x)
        g.y = Math.max(0, y)
      },
      resize: (d, id, w, h) => {
        const g = d.geometry[id]
        if (g === undefined) return
        g.w = Math.max(MIN_WINDOW.w, w)
        g.h = Math.max(MIN_WINDOW.h, h)
      },
      toggleStart: (d) => {
        d.startOpen = !d.startOpen
      },
      setStartOpen: (d, open) => {
        d.startOpen = open
      },
      setDetailsOpen: (d, open) => {
        d.detailsOpen = open
      },
    },
  })
}
