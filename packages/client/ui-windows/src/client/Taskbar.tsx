/**
 * The desktop taskbar: start button, one button per workspace (minimized
 * state shown by the button fill), and the current session's status on the
 * right. Pure component: everything arrives through props.
 */
import type { WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import css from './Taskbar.module.css'

/** Taskbar interaction props. */
export interface TaskbarProps {
  /** Workspaces in registry order. */
  workspaces: readonly WorkspaceView[]
  /** Minimized flags keyed by the workspace id's string form. */
  minimized: Record<string, boolean>
  /** The focused workspace id (current session's workspace), string form. */
  focusedId: string | undefined
  /** Current session display title (right-side status). */
  currentTitle: string | undefined
  /** Current session running state (right-side status dot). */
  currentRunning: boolean
  /** Start panel state (start button fill). */
  startOpen: boolean
  /** Toggle the start panel. */
  onToggleStart: () => void
  /** Taskbar click on one workspace button (restore/focus/minimize per state). */
  onWorkspace: (id: string) => void
}

/** The desktop taskbar (see module doc). */
export function Taskbar({
  workspaces, minimized, focusedId, currentTitle, currentRunning, startOpen, onToggleStart, onWorkspace,
}: TaskbarProps) {
  return (
    <div className={css.taskbar}>
      <button type="button" className={css.startButton} data-start-open={startOpen} aria-label="开始" onClick={onToggleStart}>▦</button>
      {workspaces.map((w) => {
        const id = String(w.workspaceId)
        return (
          <button
            key={id}
            type="button"
            className={css.workspaceButton}
            data-testid="taskbar-workspace"
            data-workspace-id={id}
            data-minimized={minimized[id] === true}
            data-focused={focusedId === id}
            onClick={() => { onWorkspace(id) }}
          >
            <span className={css.workspaceTitle}>{w.title}</span>
          </button>
        )
      })}
      <div className={css.spacer} />
      {currentTitle !== undefined && (
        <div className={css.current}>
          {currentRunning && <span className={css.runningDot} data-running="true" aria-label="运行中" />}
          <span className={css.currentTitle}>{currentTitle}</span>
        </div>
      )}
    </div>
  )
}
