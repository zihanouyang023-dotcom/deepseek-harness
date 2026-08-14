/**
 * The desktop root component: a fixed left sidebar column (native ui-sidebar)
 * beside an infinite canvas (blank-grab pan + wheel zoom in world
 * coordinates). Every opened session renders as its own window; the current
 * session's window hosts the native conversation surface, the others stay
 * mounted as lightweight placeholder frames so opening a session never tears
 * a prior one down. Only the single-stage client's current session streams;
 * the per-window session claim is the stage-2 multi-pane seam. The canvas
 * right-clicks into a zoom menu (放大/缩小/重置视图), and every viewport change
 * is clamped so open windows can never drift fully off-screen. Pure component:
 * everything arrives through the four framework shares.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { shallowEqual } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionId, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import { WindowFrame } from './WindowFrame.tsx'
import { Taskbar } from './Taskbar.tsx'
import {
  DEFAULT_VIEWPORT, DEFAULT_WINDOW, ZOOM_MAX, ZOOM_MIN,
  clampViewportToContent, type ContentBounds, type Viewport,
} from './stores.ts'
import type { DesktopProps } from './contract.ts'
import css from './Desktop.module.css'

/** Fixed sidebar column width in px while open. */
const SIDEBAR_WIDTH = 280

/** Context-menu zoom step (menu items zoom by this factor around the canvas center). */
const MENU_ZOOM_FACTOR = 1.25

/** One desktop (see module doc). */
export function Desktop(props: DesktopProps) {
  const { useStore, useSessions, useWorkspaces, actions, renderSlot, openSession } = props
  const view = useStore(s => s)
  const sessions = useSessions(s => ({ ids: s.ids, byId: s.byId, current: s.current }), shallowEqual)
  useWorkspaces(s => s)

  const current = sessions.current
  const currentId = current === undefined ? undefined : String(current)

  const listIds = useMemo(() => sessions.ids.map(id => String(id)), [sessions.ids])
  const listIdsKey = listIds.join('\u0000')
  // Prune windows whose session left the list; never auto-open. The current
  // session is always kept: the live list can lag it (async load, filtering),
  // and pruning its window with no re-open effect is how windows "vanished".
  useEffect(() => {
    const ids = listIdsKey === '' ? [] : listIdsKey.split('\u0000')
    const keep = currentId !== undefined && !ids.includes(currentId) ? [...ids, currentId] : ids
    actions.syncWindows(keep)
  }, [actions, listIdsKey, currentId])

  // A user gesture (sidebar open / session create) lands a session as current;
  // that is what opens its window. First-boot restore: the persisted current
  // session reopens its window too.
  useEffect(() => {
    if (currentId !== undefined) actions.openWindow(currentId)
  }, [actions, currentId])

  const panning = useRef(false)
  const panOrigin = useRef({ x: 0, y: 0 })
  const panBase = useRef({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // The world-space bounds of the open restored windows — the content the
  // viewport clamp keeps reachable.
  const contentBounds = (): ContentBounds | undefined => {
    let bounds: ContentBounds | undefined
    for (const id of view.openedWindows) {
      if (view.minimized[id] === true || view.maximized[id] === true) continue
      const g = view.geometry[id] ?? DEFAULT_WINDOW
      bounds = bounds === undefined
        ? { x0: g.x, y0: g.y, x1: g.x + g.w, y1: g.y + g.h }
        : {
          x0: Math.min(bounds.x0, g.x),
          y0: Math.min(bounds.y0, g.y),
          x1: Math.max(bounds.x1, g.x + g.w),
          y1: Math.max(bounds.y1, g.y + g.h),
        }
    }
    return bounds
  }

  // Every viewport change passes through here: clamp first so the content
  // stays fully on-canvas (or covers it) — windows can never drift out of view.
  const applyViewport = (next: Viewport) => {
    const el = canvasRef.current
    actions.setViewport(clampViewportToContent(next, contentBounds(), el?.clientWidth ?? 0, el?.clientHeight ?? 0))
  }

  // Zoom by a factor anchored at a canvas-relative point (cursor for wheel,
  // canvas center for menu items), then clamp.
  const zoomAt = (factor: number, anchor?: { x: number; y: number }) => {
    const el = canvasRef.current
    const rect = el?.getBoundingClientRect()
    const mx = anchor?.x ?? (rect ? rect.width / 2 : 0)
    const my = anchor?.y ?? (rect ? rect.height / 2 : 0)
    const { zoom, panX, panY } = view.viewport
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * factor))
    if (next === zoom) return
    const worldX = (mx - panX) / zoom
    const worldY = (my - panY) / zoom
    applyViewport({ zoom: next, panX: mx - worldX * next, panY: my - worldY * next })
  }

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    panning.current = true
    panOrigin.current = { x: e.clientX, y: e.clientY }
    panBase.current = { x: view.viewport.panX, y: view.viewport.panY }
  }
  const onCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panning.current || !e.currentTarget.hasPointerCapture(e.pointerId)) return
    const dx = (e.clientX - panOrigin.current.x) / view.viewport.zoom
    const dy = (e.clientY - panOrigin.current.y) / view.viewport.zoom
    applyViewport({ panX: panBase.current.x + dx, panY: panBase.current.y + dy, zoom: view.viewport.zoom })
  }
  const onCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    panning.current = false
  }
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Wheeling over a window (the message scroller, settings, tool details)
    // must scroll that surface, never rezoom the canvas.
    if ((e.target as HTMLElement | null)?.closest('[data-window]') !== null) return
    e.preventDefault()
    const el = canvasRef.current
    if (el === null) return
    const rect = el.getBoundingClientRect()
    zoomAt(Math.exp(-e.deltaY * 0.0012), { x: e.clientX - rect.left, y: e.clientY - rect.top })
  }
  // Right-click on the blank canvas opens the zoom menu; over a window the
  // native menu still fires (window content owns its own context menus).
  const onContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    const el = canvasRef.current
    const rect = el?.getBoundingClientRect()
    setCtxMenu({
      x: rect ? e.clientX - rect.left : e.clientX,
      y: rect ? e.clientY - rect.top : e.clientY,
    })
  }

  // The menu closes on any press outside itself or on Escape.
  useEffect(() => {
    if (ctxMenu === null) return
    const onDown = (ev: PointerEvent) => {
      if (menuRef.current?.contains(ev.target as Node) === false) setCtxMenu(null)
    }
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setCtxMenu(null) }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [ctxMenu])

  const summaryOf = (id: string): SessionSummary | undefined => sessions.byId[id as SessionId]

  const renderWindow = (id: string, isCurrent: boolean) => {
    const summary = summaryOf(id)
    if (summary === undefined) return null
    if (view.minimized[id] === true) return null
    const geometry = view.geometry[id] ?? { ...DEFAULT_WINDOW }
    const maximized = view.maximized[id] === true
    const title = summary.displayTitle
    const center = isCurrent
      ? (
        <div className={css.currentBody}>
          <div className={css.centerCol}>{renderSlot('conversation', {})}</div>
          {view.detailsOpen && <div className={css.detailsPane}>{renderSlot('details', {})}</div>}
        </div>
      )
      : (
        <div className={css.placeholder}>
          <div className={css.placeholderTitle}>{title}</div>
          <div className={css.placeholderMeta}>{summary.running ? '运行中' : '空闲'} · 点击左侧列表切换</div>
        </div>
      )
    return (
      <WindowFrame
        key={id}
        title={title}
        {...(summary.cwd === undefined ? {} : { subtitle: summary.cwd })}
        focused={isCurrent}
        maximized={maximized}
        geometry={geometry}
        onFocus={() => { if (!isCurrent) openSession(id as SessionId); actions.focus(id) }}
        onMinimize={() => { actions.minimize(id) }}
        onToggleMaximize={() => { actions.toggleMaximize(id) }}
        onClose={() => { actions.closeWindow(id) }}
        onMove={(x, y) => { actions.move(id, x, y) }}
        onResize={(w, h) => { actions.resize(id, w, h) }}
      >
        {center}
      </WindowFrame>
    )
  }

  const sorted = [...view.openedWindows].sort((a, b) => {
    const za = view.zOrder.indexOf(a)
    const zb = view.zOrder.indexOf(b)
    return (za === -1 ? 0 : za) - (zb === -1 ? 0 : zb)
  })
  const ordered = currentId === undefined ? sorted : [...sorted.filter(id => id !== currentId), currentId]

  const vp = view.viewport
  const worldTransform = `translate(${vp.panX}px, ${vp.panY}px) scale(${vp.zoom})`

  // Maximized windows render OUTSIDE the world transform (a fixed sheet over
  // the work area); the .world keeps only restored windows in world space.
  const worldWindows = ordered.filter(id => view.maximized[id] !== true)
  const maximizedWindows = ordered.filter(id => view.maximized[id] === true)

  return (
    <div className={css.desktop}>
      {view.sidebarOpen && (
        <div className={css.sidebar} style={{ width: SIDEBAR_WIDTH }} data-testid="sidebar-column">
          {renderSlot('sidebar', { collapsed: false, width: SIDEBAR_WIDTH })}
        </div>
      )}
      <div
        ref={canvasRef}
        className={css.canvas}
        data-testid="desktop-canvas"
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={onCanvasPointerUp}
        onWheel={onWheel}
        onContextMenu={onContextMenu}
      >
        {view.openedWindows.length === 0 && <div className={css.emptyHint}>点击左侧列表中的会话，窗口会在这里弹出</div>}
        <div className={css.world} style={{ transform: worldTransform }} data-testid="desktop-world">
          {worldWindows.map(id => renderWindow(id, id === currentId))}
        </div>
        {maximizedWindows.map(id => (
          <div key={id} className={css.maximizedLayer}>
            {renderWindow(id, id === currentId)}
          </div>
        ))}
        {ctxMenu !== null && (
          <div
            ref={menuRef}
            className={css.ctxMenu}
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            data-testid="canvas-menu"
            onContextMenu={(e) => { e.preventDefault() }}
          >
            <div className={css.ctxHeader}>缩放 · {Math.round(vp.zoom * 100)}%</div>
            <button type="button" className={css.ctxItem} disabled={vp.zoom >= ZOOM_MAX} onClick={() => { zoomAt(MENU_ZOOM_FACTOR); setCtxMenu(null) }}>放大</button>
            <button type="button" className={css.ctxItem} disabled={vp.zoom <= ZOOM_MIN} onClick={() => { zoomAt(1 / MENU_ZOOM_FACTOR); setCtxMenu(null) }}>缩小</button>
            <div className={css.ctxDivider} />
            <button type="button" className={css.ctxItem} onClick={() => { applyViewport({ ...DEFAULT_VIEWPORT }); setCtxMenu(null) }}>重置视图</button>
          </div>
        )}
      </div>
      <div className={css.overlayLayer}>{renderSlot('shell.overlay', {})}</div>
      <Taskbar
        windows={ordered.map(id => ({ id, title: summaryOf(id)?.displayTitle ?? id, minimized: view.minimized[id] === true }))}
        currentId={currentId}
        currentTitle={current !== undefined ? sessions.byId[current]?.displayTitle : undefined}
        currentRunning={current !== undefined && sessions.byId[current]?.running === true}
        sidebarOpen={view.sidebarOpen}
        onToggleSidebar={() => { actions.toggleSidebar() }}
        onWorkspace={(id) => {
          const isCurrent = currentId === id
          const isMinimized = view.minimized[id] === true
          if (isCurrent && !isMinimized) {
            actions.minimize(id)
          } else {
            actions.restore(id)
            actions.focus(id)
            if (!isCurrent) openSession(id as SessionId)
          }
        }}
      />
    </div>
  )
}
