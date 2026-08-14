// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import type {
  SessionId, SessionListState, SessionSummary, WorkspaceListState,
} from '@deepseek-ai/dsh-client-runtime/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Desktop } from '../src/client/Desktop.tsx'
import type { DesktopProps } from '../src/client/contract.ts'
import { createWindowsStore } from '../src/client/stores.ts'

afterEach(cleanup)

const sid = (id: string) => id as SessionId
const summary = (id: string, cwd: string, overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  id: sid(id), displayTitle: id, cwd, running: false, blank: false, updatedAt: 1, ...overrides,
})

let currentSession: SessionId | undefined
let rows: SessionSummary[] = []

const sessionListState = (): SessionListState => ({
  ids: rows.map(r => r.id),
  byId: Object.fromEntries(rows.map(r => [r.id, r])),
  current: currentSession,
  phase: 'ready',
  subagentsByParent: {},
  jobsBySession: {},
  currentAddress: undefined,
})

const workspaceListState = (): WorkspaceListState => ({
  items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
  baselinesReady: true, recentWorkspaceId: undefined,
})

function hookOf<T>(inst: { subscribe: (fn: () => void) => () => void; getSnapshot: () => T }) {
  return function useSelector<S>(sel: (s: T) => S): S { return sel(useSyncExternalStore(inst.subscribe, inst.getSnapshot)) }
}

const SessionProvider: DesktopProps['SessionProvider'] = ({ children, empty }) =>
  currentSession === undefined ? <>{empty?.() ?? null}</> : <>{children(currentSession)}</>

function mount() {
  const instance = createWindowsStore().create()
  const slotCalls: { key: string; owner: object }[] = []
  const renderSlot = ((key: string, owner: object) => {
    slotCalls.push({ key, owner })
    if (key === 'sidebar') return <div data-testid="sidebar-content" />
    if (key === 'conversation') return <div data-testid="conversation-content" />
    if (key === 'details') return <div data-testid="details-content" />
    return <div data-testid="overlay-content" />
  }) as unknown as DesktopProps['renderSlot']
  const props: DesktopProps = {
    useStore: hookOf(instance),
    actions: instance.actions,
    useSessions: ((sel: (s: SessionListState) => unknown, _eq?: unknown) => sel(sessionListState())) as never,
    useWorkspaces: ((sel: (s: WorkspaceListState) => unknown) => sel(workspaceListState())) as never,
    renderSlot,
    SessionProvider,
    startSession: vi.fn(),
    openSession: vi.fn(),
  }
  const utils = render(<Desktop {...props} />)
  return { utils, instance, slotCalls, props }
}

const titlebars = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('[data-testid="window-titlebar"]'))

beforeEach(() => {
  localStorage.clear()
  currentSession = undefined
  rows = []
})

describe('Desktop', () => {
  it('renders the fixed sidebar column hosting the native sidebar seat', () => {
    rows = [summary('s1', '/projects/w1')]
    currentSession = sid('s1')
    const { slotCalls } = mount()
    expect(screen.getByTestId('sidebar-column')).toBeTruthy()
    expect(screen.getByTestId('sidebar-content')).toBeTruthy()
    const sidebarCall = slotCalls.find(c => c.key === 'sidebar')
    expect(sidebarCall!.owner).toEqual({ collapsed: false, width: 280 })
  })

  it('opens no window without a current session', () => {
    rows = [summary('s1', '/projects/w1'), summary('s2', '/projects/w2')]
    mount()
    expect(titlebars()).toHaveLength(0)
    expect(screen.getByText('点击左侧列表中的会话，窗口会在这里弹出')).toBeTruthy()
  })

  it('opens a window for the current session and keeps prior windows as placeholders', () => {
    rows = [summary('s1', '/projects/w1'), summary('s2', '/projects/w2')]
    currentSession = sid('s1')
    const { instance } = mount()
    expect(titlebars()).toHaveLength(1)
    expect(screen.getAllByTestId('conversation-content')).toHaveLength(1)
    // A previously-opened session stays mounted as a placeholder.
    act(() => { instance.actions.openWindow('s2') })
    expect(titlebars()).toHaveLength(2)
    expect(screen.getByText('空闲 · 点击左侧列表切换')).toBeTruthy()
  })

  it('closing a window removes it from the opened set', () => {
    rows = [summary('s1', '/projects/w1'), summary('s2', '/projects/w2')]
    currentSession = sid('s1')
    const { instance } = mount()
    act(() => { instance.actions.openWindow('s2') })
    expect(titlebars()).toHaveLength(2)
    // Close the non-current (s2) window: its frame title is 's2'.
    const s2Frame = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="window-titlebar"]'))
      .find(tb => tb.textContent?.includes('s2'))
    const s2Close = s2Frame!.querySelector('button[aria-label="关闭"]')!
    fireEvent.click(s2Close)
    expect(titlebars()).toHaveLength(1)
    expect(instance.getSnapshot().openedWindows).toEqual(['s1'])
  })

  it('pan and zoom drive the world transform', () => {
    rows = [summary('s1', '/projects/w1')]
    currentSession = sid('s1')
    const { instance } = mount()
    const world = screen.getByTestId('desktop-world')
    act(() => { instance.actions.panBy(40, -20) })
    expect(world.style.transform).toBe('translate(40px, -20px) scale(1)')
    act(() => { instance.actions.setViewport({ panX: 40, panY: -20, zoom: 1.5 }) })
    expect(world.style.transform).toBe('translate(40px, -20px) scale(1.5)')
  })

  it('wheel over a window does not rezoom; wheel over blank canvas zooms', () => {
    rows = [summary('s1', '/projects/w1')]
    currentSession = sid('s1')
    const { instance } = mount()
    const world = screen.getByTestId('desktop-world')
    expect(instance.getSnapshot().viewport.zoom).toBe(1)
    // Wheel over the window content (the conversation) must NOT zoom.
    fireEvent.wheel(screen.getByTestId('conversation-content'), { deltaY: -100 })
    expect(instance.getSnapshot().viewport.zoom).toBe(1)
    // Wheel over the blank canvas must zoom.
    fireEvent.wheel(screen.getByTestId('desktop-canvas'), { deltaY: -100 })
    expect(instance.getSnapshot().viewport.zoom).toBeGreaterThan(1)
    expect(world).toBeTruthy()
  })

  it('taskbar buttons minimize the current window and restore it', () => {
    rows = [summary('s1', '/projects/w1'), summary('s2', '/projects/w2')]
    currentSession = sid('s1')
    const { instance } = mount()
    act(() => { instance.actions.openWindow('s2') })
    const s1 = screen.getAllByTestId('taskbar-workspace').find(b => b.dataset.windowId === 's1')!
    expect(s1.dataset.focused).toBe('true')
    fireEvent.click(s1)
    expect(s1.dataset.minimized).toBe('true')
    fireEvent.click(s1)
    expect(s1.dataset.minimized).toBe('false')
  })

  it('clicking a non-current window opens that session', () => {
    rows = [summary('s1', '/projects/w1'), summary('s2', '/projects/w2')]
    currentSession = sid('s1')
    const { instance, props } = mount()
    act(() => { instance.actions.openWindow('s2') })
    const s2 = screen.getAllByTestId('taskbar-workspace').find(b => b.dataset.windowId === 's2')!
    fireEvent.click(s2)
    expect((props as unknown as { openSession: ReturnType<typeof vi.fn> }).openSession).toHaveBeenCalledWith(sid('s2'))
  })

  it('opens the details pane inside the current window through the store', () => {
    rows = [summary('s1', '/projects/w1')]
    currentSession = sid('s1')
    const { instance } = mount()
    expect(screen.queryByTestId('details-content')).toBeNull()
    act(() => { instance.actions.setDetailsOpen(true) })
    expect(screen.getByTestId('details-content')).toBeTruthy()
    act(() => { instance.actions.setDetailsOpen(false) })
    expect(screen.queryByTestId('details-content')).toBeNull()
  })

  it('keeps the current session window when the live list stops listing it', () => {
    rows = [summary('s1', '/projects/w1')]
    currentSession = sid('s1')
    const { utils, instance, props } = mount()
    expect(titlebars()).toHaveLength(1)
    // A refetching or filtered list can drop the current session from ids
    // while its summary stays; the prune must not strand the window closed
    // (the open effect only re-runs when currentId changes).
    const filtered = { ...sessionListState(), ids: [] as SessionId[] }
    const rerenderProps = {
      ...props,
      useSessions: ((sel: (s: SessionListState) => unknown) => sel(filtered)) as never,
    }
    utils.rerender(<Desktop {...rerenderProps} />)
    expect(instance.getSnapshot().openedWindows).toEqual(['s1'])
    expect(titlebars()).toHaveLength(1)
  })

  it('right-clicking the blank canvas opens the zoom menu; items zoom and reset', () => {
    rows = [summary('s1', '/projects/w1')]
    currentSession = sid('s1')
    const { instance } = mount()
    const canvas = screen.getByTestId('desktop-canvas')
    fireEvent.contextMenu(canvas)
    expect(screen.getByTestId('canvas-menu')).toBeTruthy()
    fireEvent.click(screen.getByText('缩小'))
    expect(instance.getSnapshot().viewport.zoom).toBeLessThan(1)
    fireEvent.contextMenu(canvas)
    fireEvent.click(screen.getByText('放大'))
    fireEvent.contextMenu(canvas)
    fireEvent.click(screen.getByText('放大'))
    expect(instance.getSnapshot().viewport.zoom).toBeGreaterThan(1)
    fireEvent.contextMenu(canvas)
    fireEvent.click(screen.getByText('重置视图'))
    expect(instance.getSnapshot().viewport).toEqual({ panX: 0, panY: 0, zoom: 1 })
    expect(screen.queryByTestId('canvas-menu')).toBeNull()
  })

  it('the zoom menu closes on Escape and on a press outside itself', () => {
    rows = [summary('s1', '/projects/w1')]
    currentSession = sid('s1')
    mount()
    const canvas = screen.getByTestId('desktop-canvas')
    fireEvent.contextMenu(canvas)
    expect(screen.getByTestId('canvas-menu')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('canvas-menu')).toBeNull()
    fireEvent.contextMenu(canvas)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByTestId('canvas-menu')).toBeNull()
  })

  it('right-clicking inside a window does not open the canvas menu', () => {
    rows = [summary('s1', '/projects/w1')]
    currentSession = sid('s1')
    mount()
    fireEvent.contextMenu(screen.getByTestId('conversation-content'))
    expect(screen.queryByTestId('canvas-menu')).toBeNull()
  })
})
