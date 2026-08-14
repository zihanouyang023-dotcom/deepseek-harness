/**
 * The desktop root component: one window per workspace, a taskbar, a start
 * panel hosting the sidebar seat, and the frame-wide overlay layer. The
 * window of the current session's workspace hosts the conversation (plus the
 * details pane while open); every other window shows that workspace's session
 * overview; a current session whose cwd has no workspace renders in a static
 * fallback window so the conversation surface never disappears. Pure
 * component: everything arrives through the four framework shares.
 */
import { useEffect, useMemo } from 'react'
import { shallowEqual } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import { WindowFrame } from './WindowFrame.tsx'
import { Taskbar } from './Taskbar.tsx'
import { WorkspaceOverview, workspaceSessions } from './WorkspaceOverview.tsx'
import { DEFAULT_WINDOW } from './stores.ts'
import type { DesktopProps, WindowGeometry } from './contract.ts'
import css from './Desktop.module.css'

/** Static geometry of the ungrouped-current-session fallback window. */
const FALLBACK_GEOMETRY: WindowGeometry = { x: 120, y: 60, w: 960, h: 620 }

/** One desktop (see module doc). */
export function Desktop({
  useStore, useSessions, useWorkspaces, actions, renderSlot, startSession, openSession,
}: DesktopProps) {
  const view = useStore(s => s)
  const sessions = useSessions(s => ({ ids: s.ids, byId: s.byId, current: s.current }), shallowEqual)
  const workspaces = useWorkspaces(s => s)

  const items = workspaces.items
  const idsKey = useMemo(() => items.map(w => String(w.workspaceId)).join('\u0000'), [items])
  useEffect(() => {
    const ids = idsKey === '' ? [] : idsKey.split('\u0000')
    actions.syncWindows(ids)
  }, [actions, idsKey])

  // Empty-desktop onboarding: raise the start panel once the workspace
  // baseline is ready and truly empty (it hosts the add-workspace flow).
  useEffect(() => {
    if (workspaces.baselinesReady && items.length === 0 && !view.startOpen) {
      actions.setStartOpen(true)
    }
  }, [actions, workspaces.baselinesReady, items.length, view.startOpen])

  const current = sessions.current
  const currentSummary = current !== undefined ? sessions.byId[current] : undefined
  const currentCwd = currentSummary?.cwd
  const focused = currentCwd !== undefined ? items.find(w => w.path === currentCwd) : undefined
  const focusedId = focused === undefined ? undefined : String(focused.workspaceId)

  const archived = useMemo(() => new Set(workspaces.archivedSessionIds.map(String)), [workspaces.archivedSessionIds])
  const summaries = useMemo(() => sessions.ids.map(id => sessions.byId[id]), [sessions.ids, sessions.byId])

  const renderWindow = (workspace: WorkspaceView, isFocused: boolean, geometry: WindowGeometry, minimized: boolean, maximized: boolean) => {
    if (minimized) return null
    const id = String(workspace.workspaceId)
    return (
      <WindowFrame
        key={id}
        title={workspace.title}
        subtitle={workspace.path}
        focused={isFocused}
        maximized={maximized}
        geometry={geometry}
        onFocus={() => { actions.focus(id) }}
        onMinimize={() => { actions.minimize(id) }}
        onToggleMaximize={() => { actions.toggleMaximize(id) }}
        onClose={() => { actions.minimize(id) }}
        onMove={(x, y) => { actions.move(id, x, y) }}
        onResize={(w, h) => { actions.resize(id, w, h) }}
      >
        {isFocused
          ? (
            <div className={css.focusedBody}>
              <div className={css.centerCol}>{renderSlot('conversation', {})}</div>
              {view.detailsOpen && <div className={css.detailsPane}>{renderSlot('details', {})}</div>}
            </div>
          )
          : (
            <WorkspaceOverview
              workspace={workspace}
              sessions={workspaceSessions(workspace, summaries, archived)}
              startSession={startSession}
              openSession={openSession}
            />
          )}
      </WindowFrame>
    )
  }

  // Registry order with the focused window forced to the front (its z cell
  // still updates on user focus clicks, but focus follows the current
  // session, not clicks).
  const windows = [...items].sort((a, b) => {
    const za = view.zOrder.indexOf(String(a.workspaceId))
    const zb = view.zOrder.indexOf(String(b.workspaceId))
    return (za === -1 ? 0 : za) - (zb === -1 ? 0 : zb)
  })
  const ordered = focused === undefined ? windows : [...windows.filter(w => String(w.workspaceId) !== focusedId), focused]

  return (
    <div className={css.desktop}>
      <div className={css.workArea}>
        {items.length === 0 && workspaces.baselinesReady && <div className={css.emptyHint}>没有工作区 — 打开开始菜单注册一个目录</div>}
        {ordered.map((w) => {
          const id = String(w.workspaceId)
          return renderWindow(
            w,
            focusedId === id,
            view.geometry[id] ?? { ...DEFAULT_WINDOW },
            view.minimized[id] === true,
            view.maximized[id] === true,
          )
        })}
        {focused === undefined && currentSummary !== undefined && (
          <WindowFrame
            title={currentSummary.displayTitle}
            {...(currentSummary.cwd === undefined ? {} : { subtitle: currentSummary.cwd })}
            focused
            maximized={false}
            geometry={FALLBACK_GEOMETRY}
            onFocus={() => {}}
            onMinimize={() => {}}
            onToggleMaximize={() => {}}
            onClose={() => {}}
            onMove={() => {}}
            onResize={() => {}}
          >
            {renderSlot('conversation', {})}
          </WindowFrame>
        )}
      </div>
      {view.startOpen && (
        <div className={css.startPanel} data-testid="start-panel">
          {renderSlot('sidebar', { collapsed: false, width: 340 })}
        </div>
      )}
      <div className={css.overlayLayer}>{renderSlot('shell.overlay', {})}</div>
      <Taskbar
        workspaces={items}
        minimized={view.minimized}
        focusedId={focusedId}
        currentTitle={currentSummary?.displayTitle}
        currentRunning={currentSummary?.running === true}
        startOpen={view.startOpen}
        onToggleStart={() => { actions.toggleStart() }}
        onWorkspace={(id) => {
          if (view.startOpen) actions.setStartOpen(false)
          const isFocused = focusedId === id
          const isMinimized = view.minimized[id] === true
          if (isFocused && !isMinimized) {
            actions.minimize(id)
          } else {
            actions.restore(id)
            actions.focus(id)
          }
        }}
      />
    </div>
  )
}
