import { describe, expect, it, vi } from 'vitest'
import { WindowsLayoutController } from '../src/client/service.ts'

const actions = () => ({
  toggleStart: vi.fn(),
  setDetailsOpen: vi.fn(),
})

describe('WindowsLayoutController', () => {
  it('throws while actions are not wired (boot-order guard)', () => {
    const controller = new WindowsLayoutController()
    expect(() => { controller.toggleSidebar() }).toThrow('actions not wired')
    expect(() => { controller.openDetails() }).toThrow('actions not wired')
    expect(() => { controller.closeDetails() }).toThrow('actions not wired')
  })

  it('maps the layout face onto the desktop store actions', () => {
    const controller = new WindowsLayoutController()
    const bound = actions()
    controller.attachActions(bound as never)
    controller.toggleSidebar()
    expect(bound.toggleStart).toHaveBeenCalledOnce()
    controller.openDetails()
    expect(bound.setDetailsOpen).toHaveBeenLastCalledWith(true)
    controller.closeDetails()
    expect(bound.setDetailsOpen).toHaveBeenLastCalledWith(false)
  })

  it('re-attachment replaces the stale action set', () => {
    const controller = new WindowsLayoutController()
    controller.attachActions(actions() as never)
    const bound = actions()
    controller.attachActions(bound as never)
    controller.openDetails()
    expect(bound.setDetailsOpen).toHaveBeenCalledOnce()
  })
})
