/**
 * The non-focused window body: the workspace's own session rows (account
 * order first, same-cwd extras by recency) plus the New Session action.
 * Pure component and pure projection helper: everything arrives through props.
 */
import type { SessionId, SessionSummary, WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import css from './WorkspaceOverview.module.css'

/** Overview interaction props of one non-focused window. */
export interface WorkspaceOverviewProps {
  /** The workspace this window projects. */
  workspace: WorkspaceView
  /** This workspace's sessions in display order (see workspaceSessions). */
  sessions: readonly SessionSummary[]
  /** Start (or reuse) a session for this workspace. */
  startSession: (workspaceId: WorkspaceId) => void
  /** Open one of the listed sessions (the desktop then focuses this window). */
  openSession: (sessionId: SessionId) => void
}

/**
 * Project a workspace's sessions in display order: the durable workspace
 * account order first, then any same-cwd sessions outside the account by
 * recency. Archived sessions and sessions whose cwd differs are excluded.
 * @param workspace - the owning workspace.
 * @param summaries - the complete session list rows (undefined entries are skipped).
 * @param archivedSessionIds - registry-global archive set (string forms).
 * @returns the ordered visible sessions.
 */
export function workspaceSessions(
  workspace: WorkspaceView,
  summaries: readonly (SessionSummary | undefined)[],
  archivedSessionIds: ReadonlySet<string>,
): SessionSummary[] {
  const byId = new Map<string, SessionSummary>()
  for (const s of summaries) {
    if (s === undefined || s.cwd !== workspace.path || archivedSessionIds.has(String(s.id))) continue
    byId.set(String(s.id), s)
  }
  const ordered: SessionSummary[] = []
  for (const sessionId of workspace.sessionIds) {
    const s = byId.get(String(sessionId))
    if (s === undefined) continue
    ordered.push(s)
    byId.delete(String(sessionId))
  }
  const extras = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
  return [...ordered, ...extras]
}

/** One workspace's session overview (see module doc). */
export function WorkspaceOverview({ workspace, sessions, startSession, openSession }: WorkspaceOverviewProps) {
  return (
    <div className={css.overview}>
      <div className={css.header}>
        <span className={css.title}>{workspace.title}</span>
        <button type="button" className={css.newSession} onClick={() => { startSession(workspace.workspaceId) }}>新建会话</button>
      </div>
      {sessions.length === 0
        ? <div className={css.empty}>此工作区还没有会话 — 点“新建会话”开始</div>
        : (
          <ul className={css.rows}>
            {sessions.map(s => (
              <li key={String(s.id)}>
                <button type="button" className={css.row} data-session-id={String(s.id)} onClick={() => { openSession(s.id) }}>
                  <span className={css.rowTitle}>{s.displayTitle}</span>
                  {s.running && <span className={css.runningDot} data-running="true" aria-label="运行中" />}
                  {s.blank && <span className={css.blankTag}>空白</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}
