// @vitest-environment jsdom
/**
 * Desktop interaction spec under the four-share props form: real windows
 * store instance (createWindowsStore().create() — the test-sanctioned engine
 * path), a recording renderSlot stub, and a render-prop SessionProvider stub
 * (the real one is framework-wired to the renderer host; its own behavior is
 * web-react's spec territory). Preserved behavior: window-per-workspace
 * projection, focused-window routing of the conversation, overview routing of
 * the remaining windows, taskbar minimize/restore, start-panel hosting of the
 * sidebar seat, details toggling, and the ungrouped-session fallback window.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import type {
  SessionId, SessionListState, SessionSummary, WorkspaceId, WorkspaceListState, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Desktop } from '../src/client/Desktop.tsx'
import type { DesktopProps } from '../src/client/contract.ts'
import { createWindowsStore } from '../src/client/stores.ts'

afterEach(cleanup)

const sid = (id: string) => id as SessionId
const wid = (id: string) => id as WorkspaceId
const summary = (id: string, cwd: string, overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  id: sid(id), displayTitle: id, cwd, running: false, blank: false, updatedAt: 1, ...overrides,
})
const workspace = (id: string, sessionIds: string[] = []): WorkspaceView => ({
  workspaceId: wid(id), path: `/projects/${id}`, title: id, sessionIds: sessionIds.map(sid),
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
})

/** Mutable fixture feeds for the stub hooks (single source per test). */
let currentSession: SessionId | undefined
let rows: SessionSummary[] = []
let items: WorkspaceView[] = []
let baselinesReady = true
let archivedIds: SessionId[] = []

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
  items,
  archivedSessionIds: archivedIds,
  state: 'idle',
  phase: 'ready',
  error: null,
  baselinesReady,
  recentWorkspaceId: items[0]?.workspaceId,
})

/** Test-local selector hook over a framework-neutral store instance. */
function hookOf<T>(inst: { subscribe: (fn: () => void) => () => void; getSnapshot: () => T }) {
  return function useSelector<S>(sel: (s: T) => S): S { return sel(useSyncExternalStore(inst.subscribe, inst.getSnapshot)) }
}

/** Render-prop contract stub fed through the standard seat prop. */
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
  items = []
  baselinesReady = true
  archivedIds = []
})

describe('Desktop', () => {
  it('renders one window per workspace and hosts the conversation in the focused window', () => {
    items = [workspace('w1', ['s1']), workspace('w2')]
    rows = [summary('s1', '/projects/w1')]
    currentSession = sid('s1')
    const { slotCalls } = mount()
    expect(titlebars()).toHaveLength(2)
    expect(screen.getAllByTestId('conversation-content')).toHaveLength(1)
    expect(screen.getAllByTestId('conversation-content')[0]?.parentElement?.parentElement).toBeTruthy()
    expect(slotCalls.filter(c => c.key === 'conversation').length).toBeGreaterThan(0)
    // The focused window renders last (front-most).
    expect(titlebars()[1]?.textContent).toContain('w1')
    expect(screen.getByTestId('overlay-content')).toBeTruthy()
  })

  it('shows session overviews in non-focused windows and routes their actions', () => {
    items = [workspace('w1'), workspace('w2', ['s2'])]
    rows = [summary('s2', '/projects/w2')]
    const { props } = mount()
    expect(screen.queryByTestId('conversation-content')).toBeNull()
    fireEvent.click(screen.getByText('s2'))
    expect((props as unknown as { openSession: ReturnType<typeof vi.fn> }).openSession).toHaveBeenCalledWith(sid('s2'))
    // Two windows each carry a New Session action; the second belongs to w2.
    fireEvent.click(screen.getAllByText('新建会话')[1]!)
    expect((props as unknown as { startSession: ReturnType<typeof vi.fn> }).startSession).toHaveBeenCalledWith(wid('w2'))
    expect(screen.getByText('此工作区还没有会话 — 点“新建会话”开始')).toBeTruthy()
  })

  it('taskbar buttons minimize the focused window and restore it', () => {
    items = [workspace('w1', ['s1']), workspace('w2')]
    rows = [summary('s1', '/projects/w1')]
    currentSession = sid('s1')
    const { instance } = mount()
    const w1 = screen.getAllByTestId('taskbar-workspace')[0]!
    expect(w1.dataset.focused).toBe('true')
    fireEvent.click(w1)
    expect(titlebars()).toHaveLength(1) // w1 minimized
    expect(w1.dataset.minimized).toBe('true')
    fireEvent.click(w1)
    expect(titlebars()).toHaveLength(2)
    expect(w1.dataset.minimized).toBe('false')
    // A click on a non-focused window raises it without changing selection.
    const w2 = screen.getAllByTestId('taskbar-workspace')[1]!
    fireEvent.click(w2)
    expect(instance.getSnapshot().zOrder[instance.getSnapshot().zOrder.length - 1]).toBe('w2')
  })

  it('start button toggles the start panel hosting the sidebar seat', () => {
    items = [workspace('w1')]
    const { slotCalls } = mount()
    expect(screen.queryByTestId('start-panel')).toBeNull()
    fireEvent.click(screen.getByLabelText('开始'))
    expect(screen.getByTestId('start-panel')).toBeTruthy()
    const sidebarCall = slotCalls.find(c => c.key === 'sidebar')
    expect(sidebarCall).toBeTruthy()
    expect(sidebarCall!.owner).toEqual({ collapsed: false, width: 340 })
    expect(screen.getByTestId('sidebar-content')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('开始'))
    expect(screen.queryByTestId('start-panel')).toBeNull()
  })

  it('opens the details pane inside the focused window through the store', () => {
    items = [workspace('w1', ['s1']), workspace('w2')]
    rows = [summary('s1', '/projects/w1')]
    currentSession = sid('s1')
    const { instance } = mount()
    expect(screen.queryByTestId('details-content')).toBeNull()
    act(() => { instance.actions.setDetailsOpen(true) })
    expect(screen.getByTestId('details-content')).toBeTruthy()
    act(() => { instance.actions.setDetailsOpen(false) })
    expect(screen.queryByTestId('details-content')).toBeNull()
  })

  it('raises the start panel automatically on an empty, ready workspace baseline', () => {
    items = []
    baselinesReady = true
    mount()
    expect(screen.getByTestId('start-panel')).toBeTruthy()
    expect(screen.getByText('没有工作区 — 打开开始菜单注册一个目录')).toBeTruthy()
  })

  it('keeps the start panel closed while the workspace baseline is pending', () => {
    items = []
    baselinesReady = false
    mount()
    expect(screen.queryByTestId('start-panel')).toBeNull()
  })

  it('renders a fallback window for a current session whose cwd has no workspace', () => {
    items = [workspace('w1')]
    rows = [summary('s1', '/ungrouped')]
    currentSession = sid('s1')
    mount()
    expect(titlebars()).toHaveLength(2) // w1 + fallback
    expect(screen.getAllByTestId('conversation-content')).toHaveLength(1)
    expect(screen.getAllByText('s1')).toHaveLength(2) // fallback title + taskbar status
    expect(screen.getByText('/ungrouped')).toBeTruthy() // fallback subtitle
  })
})
