/**
 * The desktop's viewing store: per-session window geometry (a window = one
 * opened session), minimize/maximize flags, z-order, sidebar state, and the
 * infinite-canvas viewport, persisted across reloads. Module level exports the
 * factory only (a module-level handle would pin the store identity across
 * plugin reloads); register() receives the factory and the desktop derives its
 * PropsStore share from the return type.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import type { WindowGeometry } from './contract.ts'

/** Default window size for a session without stored geometry. */
export const DEFAULT_WINDOW: WindowGeometry = { x: 48, y: 36, w: 960, h: 620 }
/** Per-window cascade offset for deterministic default placement. */
export const CASCADE_STEP = 28
/** Fixed taskbar height in px (windows and the work area avoid it). */
export const TASKBAR_HEIGHT = 48
/** Minimum window size the store clamps resizes to. */
export const MIN_WINDOW = { w: 320, h: 240 }

/** Desktop-local viewport: the infinite canvas pan and zoom in world coordinates. */
export type Viewport = {
  /** Horizontal pan offset in world px (dragging the canvas left moves windows right). */
  panX: number
  /** Vertical pan offset in world px. */
  panY: number
  /** Zoom scale (1 = 100%); clamped by the store. */
  zoom: number
}

/** Windows desktop viewing state persisted across surface remounts and reloads. */
export type DesktopState = {
  /** Per-session geometry, keyed by the session id's string form. */
  geometry: Record<string, WindowGeometry>
  /** Minimized flags per session window. */
  minimized: Record<string, boolean>
  /** Maximized flags per session window. */
  maximized: Record<string, boolean>
  /** Back-to-front window order (session id strings); the last id renders on top. */
  zOrder: string[]
  /** Explicitly opened session windows (a user gesture adds entries; never auto-filled). */
  openedWindows: string[]
  /** Sidebar open (fixed left column; closed = no column). */
  sidebarOpen: boolean
  /** Details pane open inside the current-session window. */
  detailsOpen: boolean
  /** Infinite-canvas viewport pan/zoom. */
  viewport: Viewport
}

/** Annotation twin of the actions literal below (the export needs a declared return type). */
export type DesktopActions = {
  /** Prune windows whose session id left the live list; never adds windows. */
  syncWindows: (draft: DesktopState, ids: readonly string[]) => void
  /** Add (or focus) a opened session window by a user gesture. */
  openWindow: (draft: DesktopState, id: string) => void
  /** Remove a session window from the opened set and its geometry. */
  closeWindow: (draft: DesktopState, id: string) => void
  focus: (draft: DesktopState, id: string) => void
  minimize: (draft: DesktopState, id: string) => void
  restore: (draft: DesktopState, id: string) => void
  toggleMaximize: (draft: DesktopState, id: string) => void
  move: (draft: DesktopState, id: string, x: number, y: number) => void
  resize: (draft: DesktopState, id: string, w: number, h: number) => void
  toggleSidebar: (draft: DesktopState) => void
  setSidebarOpen: (draft: DesktopState, open: boolean) => void
  setDetailsOpen: (draft: DesktopState, open: boolean) => void
  panBy: (draft: DesktopState, dx: number, dy: number) => void
  zoomBy: (draft: DesktopState, factor: number, min: number, max: number) => void
  setViewport: (draft: DesktopState, viewport: Viewport) => void
}

/**
 * Compute the default geometry of the n-th window (deterministic cascade from
 * the fixed start point, so a recreated session never lands on another).
 * @param index - position in the opened-window order.
 * @returns the cascade geometry.
 */
export function defaultGeometry(index: number): WindowGeometry {
  const offset = index * CASCADE_STEP
  return { x: DEFAULT_WINDOW.x + offset, y: DEFAULT_WINDOW.y + offset, w: DEFAULT_WINDOW.w, h: DEFAULT_WINDOW.h }
}

/** Minimum and maximum infinite-canvas zoom, and the default. */
export const ZOOM_MIN = 0.3
export const ZOOM_MAX = 3
export const ZOOM_DEFAULT = 1

/** Default world-space viewport (no pan, 100% zoom). */
export const DEFAULT_VIEWPORT: Viewport = { panX: 0, panY: 0, zoom: ZOOM_DEFAULT }

/** World-space bounding box of the open, restored windows (the canvas content). */
export interface ContentBounds {
  /** Left edge in world px. */
  x0: number
  /** Top edge in world px. */
  y0: number
  /** Right edge in world px. */
  x1: number
  /** Bottom edge in world px. */
  y1: number
}

/**
 * Clamp a viewport to the content, per axis: when the content fits the view it
 * stays fully on-canvas; when zoomed content outgrows the view, the view stays
 * inside the content (no blank ocean past the edges). Without this, a zoom-out
 * or far pan can strand every window off-screen with no way back.
 * @param vp - the candidate viewport.
 * @param content - the content bounds in world px; undefined skips clamping.
 * @param viewW - visible canvas width in px.
 * @param viewH - visible canvas height in px.
 * @returns the clamped viewport.
 */
export function clampViewportToContent(
  vp: Viewport, content: ContentBounds | undefined, viewW: number, viewH: number,
): Viewport {
  if (content === undefined || viewW <= 0 || viewH <= 0) return vp
  const axis = (pan: number, z: number, a: number, b: number, view: number): number => {
    // pan must lie between the fits-inside and covers-view bounds (order
    // depends on which of content/view is wider).
    const edgeA = -z * a
    const edgeB = view - z * b
    const lo = Math.min(edgeA, edgeB)
    const hi = Math.max(edgeA, edgeB)
    return Math.min(hi, Math.max(lo, pan))
  }
  return {
    zoom: vp.zoom,
    panX: axis(vp.panX, vp.zoom, content.x0, content.x1, viewW),
    panY: axis(vp.panY, vp.zoom, content.y0, content.y1, viewH),
  }
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
      openedWindows: [],
      sidebarOpen: true,
      detailsOpen: false,
      viewport: { ...DEFAULT_VIEWPORT },
    }),
    // v5: reset once-stranded viewports (pre-clamp pans could hide all windows).
    persist: 'dsh.windows.desktop.v5',
    actions: {
      // Prune only: windows whose session left the live list drop their
      // geometry/flags/order; the opened set is user-driven, never auto-filled.
      syncWindows: (d, ids) => {
        const kept = new Set(ids)
        d.openedWindows = d.openedWindows.filter(id => kept.has(id))
        d.geometry = Object.fromEntries(Object.entries(d.geometry).filter(([id]) => kept.has(id)))
        d.minimized = Object.fromEntries(Object.entries(d.minimized).filter(([id]) => kept.has(id)))
        d.maximized = Object.fromEntries(Object.entries(d.maximized).filter(([id]) => kept.has(id)))
        d.zOrder = d.zOrder.filter(id => d.openedWindows.includes(id))
      },
      openWindow: (d, id) => {
        if (!d.openedWindows.includes(id)) {
          d.openedWindows = [...d.openedWindows, id]
          d.geometry[id] = defaultGeometry(d.openedWindows.length - 1)
          d.minimized[id] = false
          // New windows open maximized; restore returns to the stored geometry.
          d.maximized[id] = true
        }
        if (!d.zOrder.includes(id)) d.zOrder.push(id)
      },
      closeWindow: (d, id) => {
        d.openedWindows = d.openedWindows.filter(w => w !== id)
        d.zOrder = d.zOrder.filter(w => w !== id)
        d.geometry = Object.fromEntries(Object.entries(d.geometry).filter(([k]) => k !== id))
        d.minimized = Object.fromEntries(Object.entries(d.minimized).filter(([k]) => k !== id))
        d.maximized = Object.fromEntries(Object.entries(d.maximized).filter(([k]) => k !== id))
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
      toggleSidebar: (d) => {
        d.sidebarOpen = !d.sidebarOpen
      },
      setSidebarOpen: (d, open) => {
        d.sidebarOpen = open
      },
      setDetailsOpen: (d, open) => {
        d.detailsOpen = open
      },
      panBy: (d, dx, dy) => {
        d.viewport.panX += dx
        d.viewport.panY += dy
      },
      zoomBy: (d, factor, min, max) => {
        const next = Math.min(max, Math.max(min, d.viewport.zoom * factor))
        d.viewport.zoom = next
      },
      setViewport: (d, viewport) => {
        d.viewport = { panX: viewport.panX, panY: viewport.panY, zoom: viewport.zoom }
      },
    },
  })
}
