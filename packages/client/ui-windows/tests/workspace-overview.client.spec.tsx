// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type {
  SessionId, SessionSummary, WorkspaceId, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceOverview, workspaceSessions } from '../src/client/WorkspaceOverview.tsx'

afterEach(cleanup)

const sid = (id: string) => id as SessionId
const wid = (id: string) => id as WorkspaceId
const summary = (id: string, cwd: string, updatedAt: number, overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  id: sid(id), displayTitle: id, cwd, running: false, blank: false, updatedAt, ...overrides,
})
const workspace = (sessionIds: string[], path = '/projects/w'): WorkspaceView => ({
  workspaceId: wid('w'), path, title: 'w', sessionIds: sessionIds.map(sid),
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
})

describe('workspaceSessions', () => {
  it('orders by the workspace account, then same-cwd extras by recency', () => {
    const w = workspace(['s2', 's1'])
    const rows = [
      summary('s1', '/projects/w', 10),
      summary('s2', '/projects/w', 20),
      summary('extra-new', '/projects/w', 50),
      summary('extra-old', '/projects/w', 5),
    ]
    expect(workspaceSessions(w, rows, new Set()).map(s => String(s.id)))
      .toEqual(['s2', 's1', 'extra-new', 'extra-old'])
  })

  it('excludes archived sessions and sessions outside the workspace cwd', () => {
    const w = workspace(['s1', 's2'])
    const rows = [
      summary('s1', '/projects/w', 10),
      summary('s2', '/projects/w', 20),
      summary('other', '/elsewhere', 30),
      summary('archived', '/projects/w', 40),
    ]
    expect(workspaceSessions(w, rows, new Set(['archived'])).map(s => String(s.id)))
      .toEqual(['s1', 's2'])
  })

  it('skips undefined rows and accounts for ids with no list row', () => {
    const w = workspace(['missing', 's1'])
    const rows = [undefined, summary('s1', '/projects/w', 10)]
    expect(workspaceSessions(w, rows, new Set()).map(s => String(s.id))).toEqual(['s1'])
  })
})

describe('WorkspaceOverview', () => {
  const mount = (overrides: Partial<Parameters<typeof WorkspaceOverview>[0]> = {}) => {
    const props = {
      workspace: workspace(['s1', 's2']),
      sessions: [summary('s1', '/projects/w', 10), summary('s2', '/projects/w', 20, { running: true, blank: true })],
      startSession: vi.fn(),
      openSession: vi.fn(),
      ...overrides,
    }
    render(<WorkspaceOverview {...props} />)
    return props
  }

  it('renders every session row with status affordances', () => {
    mount()
    expect(screen.getByText('s1')).toBeTruthy()
    expect(screen.getByText('s2')).toBeTruthy()
    expect(screen.getByLabelText('运行中')).toBeTruthy()
    expect(screen.getByText('空白')).toBeTruthy()
  })

  it('opens the clicked session', () => {
    const props = mount()
    fireEvent.click(screen.getByText('s1'))
    expect(props.openSession).toHaveBeenCalledWith(sid('s1'))
  })

  it('starts a session for the workspace', () => {
    const props = mount()
    fireEvent.click(screen.getByText('新建会话'))
    expect(props.startSession).toHaveBeenCalledWith(wid('w'))
  })

  it('shows the empty state when the workspace has no sessions', () => {
    mount({ sessions: [] })
    expect(screen.getByText('此工作区还没有会话 — 点“新建会话”开始')).toBeTruthy()
  })
})
