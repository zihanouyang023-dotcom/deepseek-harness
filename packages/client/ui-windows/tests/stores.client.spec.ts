import { describe, expect, it } from 'vitest'
import {
  CASCADE_STEP, DEFAULT_WINDOW, MIN_WINDOW, createWindowsStore, defaultGeometry,
} from '../src/client/stores.ts'

const bench = () => createWindowsStore().create()

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
  it('syncWindows seeds defaults in list order and appends new ids to the z-order', () => {
    const store = bench()
    store.actions.syncWindows(['a', 'b'])
    const state = store.getSnapshot()
    expect(state.geometry).toEqual({ a: defaultGeometry(0), b: defaultGeometry(1) })
    expect(state.zOrder).toEqual(['a', 'b'])
    expect(state.minimized).toEqual({})
    expect(state.maximized).toEqual({})
  })

  it('syncWindows retains existing geometry and prunes removed windows on every axis', () => {
    const store = bench()
    store.actions.syncWindows(['a', 'b'])
    store.actions.move('a', 11, 12)
    store.actions.resize('a', 500, 400)
    store.actions.minimize('b')
    store.actions.toggleMaximize('b')
    store.actions.syncWindows(['a'])
    const state = store.getSnapshot()
    expect(state.geometry).toEqual({ a: { x: 11, y: 12, w: 500, h: 400 } })
    expect(state.minimized).toEqual({})
    expect(state.maximized).toEqual({})
    expect(state.zOrder).toEqual(['a'])
  })

  it('focus moves an id to the top of the z-order and ignores unknown ids', () => {
    const store = bench()
    store.actions.syncWindows(['a', 'b', 'c'])
    store.actions.focus('a')
    expect(store.getSnapshot().zOrder).toEqual(['b', 'c', 'a'])
    store.actions.focus('missing')
    expect(store.getSnapshot().zOrder).toEqual(['b', 'c', 'a'])
  })

  it('minimize, restore, and toggleMaximize track per-window flags', () => {
    const store = bench()
    store.actions.syncWindows(['a'])
    store.actions.minimize('a')
    expect(store.getSnapshot().minimized).toEqual({ a: true })
    store.actions.restore('a')
    expect(store.getSnapshot().minimized).toEqual({ a: false })
    store.actions.toggleMaximize('a')
    expect(store.getSnapshot().maximized).toEqual({ a: true })
    store.actions.toggleMaximize('a')
    expect(store.getSnapshot().maximized).toEqual({ a: false })
  })

  it('move clamps to the desktop origin and ignores unknown ids', () => {
    const store = bench()
    store.actions.syncWindows(['a'])
    store.actions.move('a', -20, -30)
    expect(store.getSnapshot().geometry['a']).toEqual({ x: 0, y: 0, w: DEFAULT_WINDOW.w, h: DEFAULT_WINDOW.h })
    store.actions.move('missing', 5, 6)
    expect(store.getSnapshot().geometry['missing']).toBeUndefined()
  })

  it('resize enforces the minimum window size and ignores unknown ids', () => {
    const store = bench()
    store.actions.syncWindows(['a'])
    store.actions.resize('a', 100, 100)
    expect(store.getSnapshot().geometry['a']).toEqual({ x: DEFAULT_WINDOW.x, y: DEFAULT_WINDOW.y, w: MIN_WINDOW.w, h: MIN_WINDOW.h })
    store.actions.resize('missing', 800, 600)
    expect(store.getSnapshot().geometry['missing']).toBeUndefined()
  })

  it('start and details panel state flip through their actions', () => {
    const store = bench()
    expect(store.getSnapshot().startOpen).toBe(false)
    store.actions.toggleStart()
    expect(store.getSnapshot().startOpen).toBe(true)
    store.actions.toggleStart()
    expect(store.getSnapshot().startOpen).toBe(false)
    store.actions.setStartOpen(true)
    expect(store.getSnapshot().startOpen).toBe(true)
    store.actions.setDetailsOpen(true)
    expect(store.getSnapshot().detailsOpen).toBe(true)
    store.actions.setDetailsOpen(false)
    expect(store.getSnapshot().detailsOpen).toBe(false)
  })
})
