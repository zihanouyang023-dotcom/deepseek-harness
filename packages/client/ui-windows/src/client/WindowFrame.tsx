/**
 * One desktop window's chrome: title bar (title, subtitle, control buttons),
 * pointer-capture drag on the title bar, a bottom-right resize handle, and
 * the content area. Move/resize report absolute replacements computed from a
 * drag-start base (frozen per gesture, so deltas never compound); the store
 * clamps bounds. Pure component: everything arrives through props.
 */
import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { WindowGeometry } from './contract.ts'
import { TASKBAR_HEIGHT } from './stores.ts'
import css from './WindowFrame.module.css'

/** Chrome interaction surface of one desktop window. */
export interface WindowFrameProps {
  /** Window title (the workspace title). */
  title: string
  /** Secondary line under the title (the workspace path); absent renders no line. */
  subtitle?: string | undefined
  /** True when this window hosts the current session's workspace. */
  focused: boolean
  /** True while the window fills the work area (drag/resize disabled). */
  maximized: boolean
  /** Desktop-local geometry; move/resize report absolute replacements. */
  geometry: WindowGeometry
  /** Raise this window to the front (fires on any pointer-down inside the chrome). */
  onFocus: () => void
  /** Minimize (taskbar-only) this window. */
  onMinimize: () => void
  /** Toggle the maximized flag. */
  onToggleMaximize: () => void
  /** Close this window (the desktop maps it to minimize; workspaces persist). */
  onClose: () => void
  /** Report a new top-left position. */
  onMove: (x: number, y: number) => void
  /** Report a new size. */
  onResize: (w: number, h: number) => void
  /** Window content. */
  children?: ReactNode
}

/** One desktop window frame (see module doc). */
export function WindowFrame({
  title, subtitle, focused, maximized, geometry, onFocus, onMinimize,
  onToggleMaximize, onClose, onMove, onResize, children,
}: WindowFrameProps) {
  const base = useRef<WindowGeometry>(geometry)
  const origin = useRef({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const geometryRef = useRef(geometry)
  geometryRef.current = geometry

  const startDrag = () => (e: React.PointerEvent<HTMLDivElement>) => {
    if (maximized) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    base.current = geometryRef.current
    origin.current = { x: e.clientX, y: e.clientY }
    setDragging(true)
  }
  const drag = (kind: 'move' | 'resize') => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const dx = e.clientX - origin.current.x
    const dy = e.clientY - origin.current.y
    if (kind === 'move') onMove(base.current.x + dx, base.current.y + dy)
    else onResize(base.current.w + dx, base.current.h + dy)
  }
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
  }

  const style: CSSProperties = maximized
    ? { left: 0, top: 0, right: 0, bottom: TASKBAR_HEIGHT, width: 'auto', height: 'auto' }
    : { left: geometry.x, top: geometry.y, width: geometry.w, height: geometry.h }

  return (
    <div
      className={css.frame}
      style={style}
      data-focused={focused}
      data-maximized={maximized}
      data-dragging={dragging || undefined}
      onPointerDownCapture={onFocus}
    >
      <div
        className={css.titleBar}
        data-testid="window-titlebar"
        onPointerDown={startDrag()}
        onPointerMove={drag('move')}
        onPointerUp={endDrag}
        onDoubleClick={onToggleMaximize}
      >
        <div className={css.titleText}>
          <span className={css.title}>{title}</span>
          {subtitle !== undefined && subtitle !== '' && <span className={css.subtitle}>{subtitle}</span>}
        </div>
        <button type="button" className={css.control} data-kind="minimize" aria-label="最小化" onClick={onMinimize}>─</button>
        <button type="button" className={css.control} data-kind="maximize" aria-label={maximized ? '还原' : '最大化'} onClick={onToggleMaximize}>{maximized ? '❐' : '□'}</button>
        <button type="button" className={css.control} data-kind="close" aria-label="关闭" onClick={onClose}>✕</button>
      </div>
      <div className={css.body}>{children}</div>
      {!maximized && (
        <div
          className={css.resize}
          data-testid="window-resize"
          onPointerDown={startDrag()}
          onPointerMove={drag('resize')}
          onPointerUp={endDrag}
        />
      )}
    </div>
  )
}
