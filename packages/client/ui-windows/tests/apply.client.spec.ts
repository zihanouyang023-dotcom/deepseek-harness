// @vitest-environment jsdom
// Client apply wiring under the terminal register form: ctx.layout provided,
// ONE register() call declares the four frame child slots + seats the store
// factory + wires the desktop actions through the inject hook; teardown
// cascades (service unprovided + declarations gone + registration cleared).
// Node half and the invariant companion ride along — one line exposes the
// aggregate coverage gate still requires exercised.

import { Context } from '@deepseek-ai/cordis'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { WindowsLayoutController } from '../src/client/service.ts'
import { apply, inject } from '../src/client/index.ts'
import { apply as nodeApply } from '../src/index.ts'
import * as invariant from '../src/invariant.ts'

beforeEach(() => {
  localStorage.clear()
})

async function bench() {
  const ctx = new Context()
  const slotsFiber = ctx.plugin(SlotRegistry)
  ctx.provide('sessions', { open: vi.fn(), currentProvideInfo: { getSnapshot: () => undefined, subscribe: () => () => {} } } as never)
  ctx.provide('workspaces', { startSession: vi.fn() } as never)
  await slotsFiber.await()
  return { ctx, slots: ctx.get('slots') as SlotRegistry }
}

describe('ui-windows client apply', () => {
  it('declares its service dependencies', () => {
    expect(inject).toEqual(['slots', 'sessions', 'workspaces'])
  })

  it('provides ctx.layout and registers the Desktop into root with the four frame declarations', async () => {
    const { ctx, slots } = await bench()
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(ctx.get('layout')).toBeInstanceOf(WindowsLayoutController)
    expect(slots.entries('root')).toHaveLength(1)
    expect(slots.spec('sidebar')).toEqual({ kind: 'single', scope: 'root' })
    expect(slots.spec('conversation')).toEqual({ kind: 'single', scope: 'session-maybe' })
    expect(slots.spec('details')).toEqual({ kind: 'single', scope: 'session' })
    expect(slots.spec('shell.overlay')).toEqual({ kind: 'list', scope: 'root' })
  })

  it('injects the session callbacks and attaches the desktop actions to the layout face', async () => {
    const { ctx, slots } = await bench()
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const actions = { toggleSidebar: vi.fn(), setDetailsOpen: vi.fn() }
    const injected = (slots.entries('root')[0]!.inject as (actions: never) => object)(actions as never) as {
      startSession: (id?: string) => void
      openSession: (id: string) => void
    }
    injected.startSession()
    expect((ctx.get('workspaces') as unknown as { startSession: ReturnType<typeof vi.fn> }).startSession).toHaveBeenCalledWith(undefined)
    injected.startSession('w-1')
    expect((ctx.get('workspaces') as unknown as { startSession: ReturnType<typeof vi.fn> }).startSession).toHaveBeenLastCalledWith('w-1')
    injected.openSession('s-1')
    expect((ctx.get('sessions') as unknown as { open: ReturnType<typeof vi.fn> }).open).toHaveBeenCalledWith('s-1')
    const layout = ctx.get('layout') as WindowsLayoutController
    layout.toggleSidebar()
    expect(actions.toggleSidebar).toHaveBeenCalledOnce()
    layout.openDetails()
    expect(actions.setDetailsOpen).toHaveBeenLastCalledWith(true)
  })

  it('teardown unwinds the service, the root registration, and the child declarations', async () => {
    const { ctx, slots } = await bench()
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await fiber.dispose()
    expect(ctx.get('layout')).toBeUndefined()
    expect(slots.entries('root')).toHaveLength(0)
    expect(slots.spec('sidebar')).toBeUndefined()
    // The built-in root declaration survives entry teardown (runtime-owned).
    expect(slots.spec('root')).toEqual({ kind: 'single', scope: 'root' })
  })
})

describe('node half + invariant companion', () => {
  it('node apply is an intentional no-op (loader-managed lifecycle only)', () => {
    nodeApply()
    expect(true).toBe(true) // reaching here without throw is the contract
  })

  it('invariant companion registers under the package name', async () => {
    const register = vi.fn().mockReturnValue(() => {})
    const ctx = { invariants: { register } } as never
    const dispose = await invariant.apply(ctx)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-client-ui-windows', expect.any(Function))
    expect(() => { (register.mock.calls[0]![1] as (c: never) => void)(undefined as never) }).not.toThrow()
    expect(dispose).toBeTypeOf('function')
  })
})
