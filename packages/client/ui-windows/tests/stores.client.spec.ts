import { describe, expect, it } from 'vitest'
import {
  CASCADE_STEP, DEFAULT_WINDOW, MIN_WINDOW, clampViewportToContent, createWindowsStore,
  defaultGeometry, type ContentBounds,
} from '../src/client/stores.ts'

const bench = () => createWindowsStore().create()

describe('clampViewportToContent', () => {
  const content: ContentBounds = { x0: 48, y0: 36, x1: 1008, y1: 656 }

  it('returns the viewport unchanged without content or view size', () => {
    const vp = { panX: -9999, panY: 0, zoom: 1 }
    expect(clampViewportToContent(vp, undefined, 800, 600)).toBe(vp)
    expect(clampViewportToContent(vp, content, 0, 0)).toBe(vp)
  })

  it('leaves an in-range viewport untouched', () => {
    const vp = { panX: 10, panY: 10, zoom: 1 }
    expect(clampViewportToContent(vp, content, 1280, 800)).toEqual(vp)
  })

  it('pulls a stranded viewport back so content stays fully on-canvas', () => {
    // Content [48,1008]x[36,656] in a 1280x800 view at zoom 1: pan is
    // clamped to [-48,272] x [-36,144].
    const left = clampViewportToContent({ panX: -1200, panY: 0, zoom: 1 }, content, 1280, 800)
    expect(left.panX).toBe(-48)
    expect(left.panX + content.x0).toBe(0)
    const right = clampViewportToContent({ panX: 4000, panY: 0, zoom: 1 }, content, 1280, 800)
    expect(right.panX + content.x1).toBe(1280)
    const top = clampViewportToContent({ panX: 0, panY: -2000, zoom: 1 }, content, 1280, 800)
    expect(top.panY + content.y0).toBe(0)
  })

  it('keeps the view inside the content when zoomed content outgrows it', () => {
    // At zoom 3 the content spans 2880px in a 1280px view: the pan clamps to
    // [1280 - 3*1008, -3*48] so the view never shows past the content edges.
    const vp = { panX: 5000, panY: 0, zoom: 3 }
    const clamped = clampViewportToContent(vp, content, 1280, 800)
    expect(clamped.panX).toBe(-144)
  })
})

describe('defaultGeometry', () => {
  it('cascades deterministically from the fixed start point', () => {
    expect(defaultGeometry(0)).toEqual(DEFAULT_WINDOW)
    expect(defaultGeometry(2)).toEqual({
      x: DEFAULT_WINDOW.x + 2 * CASCADE_STEP,
      y: DEFAULT_WINDOW.y + 2 * CASCADE_STEP,
      w: DEFAULT_WINDOW.w,
      h: DEFAULT_WINDOW.h,
    })
  })
})

describe('windows desktop store', () => {
  it('openWindow seeds default geometry and appends to the opened set and z-order', () => {
    const store = bench()
    store.actions.openWindow('a')
    store.actions.openWindow('b')
    const state = store.getSnapshot()
    expect(state.openedWindows).toEqual(['a', 'b'])
    expect(state.geometry).toEqual({ a: defaultGeometry(0), b: defaultGeometry(1) })
    expect(state.zOrder).toEqual(['a', 'b'])
  })

  it('openWindow is idempotent for the same id', () => {
    const store = bench()
    store.actions.openWindow('a')
    store.actions.openWindow('a')
    expect(store.getSnapshot().openedWindows).toEqual(['a'])
    expect(store.getSnapshot().zOrder).toEqual(['a'])
  })

  it('closeWindow removes the window and its state, and prunes stale entries from z-order', () => {
    const store = bench()
    store.actions.openWindow('a')
    store.actions.openWindow('b')
    store.actions.move('a', 11, 12)
    store.actions.closeWindow('a')
    const state = store.getSnapshot()
    expect(state.openedWindows).toEqual(['b'])
    expect(state.zOrder).toEqual(['b'])
    expect(state.geometry['a']).toBeUndefined()
    expect(state.geometry['b']).toEqual(defaultGeometry(1))
  })

  it('syncWindows prunes windows whose session left the live list', () => {
    const store = bench()
    store.actions.openWindow('a')
    store.actions.openWindow('b')
    store.actions.syncWindows(['a'])
    expect(store.getSnapshot().openedWindows).toEqual(['a'])
    expect(store.getSnapshot().geometry['b']).toBeUndefined()
  })

  it('focus moves an id to the top of the z-order and ignores unknown ids', () => {
    const store = bench()
    store.actions.openWindow('a')
    store.actions.openWindow('b')
    store.actions.openWindow('c')
    store.actions.focus('a')
    expect(store.getSnapshot().zOrder).toEqual(['b', 'c', 'a'])
    store.actions.focus('missing')
    expect(store.getSnapshot().zOrder).toEqual(['b', 'c', 'a'])
  })

  it('minimize, restore, and toggleMaximize track per-window flags', () => {
    const store = bench()
    store.actions.openWindow('a')
    // New windows open maximized.
    expect(store.getSnapshot().maximized).toEqual({ a: true })
    store.actions.minimize('a')
    expect(store.getSnapshot().minimized).toEqual({ a: true })
    store.actions.restore('a')
    expect(store.getSnapshot().minimized).toEqual({ a: false })
    store.actions.toggleMaximize('a')
    expect(store.getSnapshot().maximized).toEqual({ a: false })
    store.actions.toggleMaximize('a')
    expect(store.getSnapshot().maximized).toEqual({ a: true })
  })

  it('move clamps to the desktop origin and ignores unknown ids', () => {
    const store = bench()
    store.actions.openWindow('a')
    store.actions.move('a', -20, -30)
    expect(store.getSnapshot().geometry['a']).toEqual({ x: 0, y: 0, w: DEFAULT_WINDOW.w, h: DEFAULT_WINDOW.h })
    store.actions.move('missing', 5, 6)
    expect(store.getSnapshot().geometry['missing']).toBeUndefined()
  })

  it('resize enforces the minimum window size and ignores unknown ids', () => {
    const store = bench()
    store.actions.openWindow('a')
    store.actions.resize('a', 100, 100)
    expect(store.getSnapshot().geometry['a']).toEqual({ x: DEFAULT_WINDOW.x, y: DEFAULT_WINDOW.y, w: MIN_WINDOW.w, h: MIN_WINDOW.h })
    store.actions.resize('missing', 800, 600)
    expect(store.getSnapshot().geometry['missing']).toBeUndefined()
  })

  it('sidebar and details panel state flip through their actions', () => {
    const store = bench()
    expect(store.getSnapshot().sidebarOpen).toBe(true)
    store.actions.toggleSidebar()
    expect(store.getSnapshot().sidebarOpen).toBe(false)
    store.actions.toggleSidebar()
    expect(store.getSnapshot().sidebarOpen).toBe(true)
    store.actions.setSidebarOpen(false)
    expect(store.getSnapshot().sidebarOpen).toBe(false)
    store.actions.setDetailsOpen(true)
    expect(store.getSnapshot().detailsOpen).toBe(true)
    store.actions.setDetailsOpen(false)
    expect(store.getSnapshot().detailsOpen).toBe(false)
  })

  it('pan, zoom, and setViewport drive the infinite-canvas viewport', () => {
    const store = bench()
    expect(store.getSnapshot().viewport).toEqual({ panX: 0, panY: 0, zoom: 1 })
    store.actions.panBy(40, -20)
    expect(store.getSnapshot().viewport).toEqual({ panX: 40, panY: -20, zoom: 1 })
    store.actions.zoomBy(1.5, 0.3, 3)
    expect(store.getSnapshot().viewport.zoom).toBe(1.5)
    store.actions.zoomBy(100, 0.3, 3)
    expect(store.getSnapshot().viewport.zoom).toBe(3)
    store.actions.zoomBy(0.0001, 0.3, 3)
    expect(store.getSnapshot().viewport.zoom).toBe(0.3)
    store.actions.setViewport({ panX: 7, panY: 8, zoom: 2 })
    expect(store.getSnapshot().viewport).toEqual({ panX: 7, panY: 8, zoom: 2 })
  })
})
