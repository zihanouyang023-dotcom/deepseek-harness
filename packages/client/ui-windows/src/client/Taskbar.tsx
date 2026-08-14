/**
 * The desktop taskbar: a sidebar toggle, one button per opened session window
 * (minimized state shown by the button fill, current session highlighted),
 * and the current session's status on the right. Pure component: everything
 * arrives through props.
 */
import css from './Taskbar.module.css'
import { IconGrid } from './icons.tsx'

/** One taskbar window row. */
export interface TaskbarWindow {
  /** Session id string form. */
  id: string
  /** Display title. */
  title: string
  /** Minimized flag. */
  minimized: boolean
}

/** Taskbar interaction props. */
export interface TaskbarProps {
  /** Opened session windows in render order. */
  windows: readonly TaskbarWindow[]
  /** The current session's window id (string form). */
  currentId: string | undefined
  /** Current session display title (right-side status). */
  currentTitle: string | undefined
  /** Current session running state (right-side status dot). */
  currentRunning: boolean
  /** Sidebar column open (toggle fill). */
  sidebarOpen: boolean
  /** Toggle the fixed left sidebar column. */
  onToggleSidebar: () => void
  /** Taskbar click on one session window button (restore/focus/minimize). */
  onWorkspace: (id: string) => void
}

/** The desktop taskbar (see module doc). */
export function Taskbar({
  windows, currentId, currentTitle, currentRunning, sidebarOpen, onToggleSidebar, onWorkspace,
}: TaskbarProps) {
  return (
    <div className={css.taskbar}>
      <button type="button" className={css.startButton} data-start-open={sidebarOpen} aria-label="侧边栏" onClick={onToggleSidebar}><IconGrid /></button>
      {windows.map(w => (
        <button
          key={w.id}
          type="button"
          className={css.workspaceButton}
          data-testid="taskbar-workspace"
          data-window-id={w.id}
          data-minimized={w.minimized}
          data-focused={currentId === w.id}
          onClick={() => { onWorkspace(w.id) }}
        >
          <span className={css.workspaceTitle}>{w.title}</span>
        </button>
      ))}
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
