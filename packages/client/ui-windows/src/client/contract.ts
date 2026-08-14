/**
 * Shared client contracts: the frame-slot declarations (the desktop declares
 * the same child slots as ui-layout's AppFrame so sidebar, conversation,
 * details, and overlay plugins fill them unchanged), the injected business
 * face, and the window-geometry vocabulary. Types only — no runtime code.
 * @module @deepseek-ai/dsh-client-ui-windows/src/client/contract
 */

import type { PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId, WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import type { createWindowsStore } from './stores.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    // Structural twins of ui-layout's frame declarations: the two layouts are
    // alternatives, never co-loaded — a profile enables one and disables the
    // other, so the identical declarations never collide at runtime.
    /**
     * The start panel's content column, hosting the sidebar plugin. The
     * desktop supplies live panel state; a closed panel unmounts the seat.
     */
    'sidebar': { kind: 'single'; scope: 'root'; owner: SidebarOwnerProps }
    /**
     * The focused window's center column: the current-session conversation
     * (session-maybe, so the no-session hero renders while no session is
     * current — the desktop renders the seat only inside a focused window).
     */
    'conversation': { kind: 'single'; scope: 'session-maybe'; owner: ConversationOwnerProps }
    /**
     * The focused window's right pane, mounted while the desktop opens it.
     */
    'details': { kind: 'single'; scope: 'session'; owner: DetailsOwnerProps }
    /**
     * Desktop-wide floating layer (additive; click-through until an entry
     * opts into pointer events).
     */
    'shell.overlay': { kind: 'list'; scope: 'root' }
  }
}

/** Sidebar owner share: live panel state from the desktop (width is the open panel width). */
export interface SidebarOwnerProps {
  /** True when the start panel is closed (the desktop unmounts the seat). */
  collapsed: boolean
  /** Rendered panel width in px. */
  width: number
}

/** Conversation owner share: empty — session facts arrive through the framework hooks. */
export interface ConversationOwnerProps {}

/** Details owner share: empty — sessionId arrives as a framework-standard prop. */
export interface DetailsOwnerProps {}

/** One window's desktop-local viewport geometry. */
export interface WindowGeometry {
  /** Left edge in px (clamped to the desktop). */
  x: number
  /** Top edge in px (clamped to the desktop). */
  y: number
  /** Width in px (minimum enforced by the store). */
  w: number
  /** Height in px (minimum enforced by the store). */
  h: number
}

/** The inject face the desktop registration returns to its component. */
export interface DesktopInjected {
  /** Start (or reuse) a session for the target workspace; omitted inherits the current session's workspace. */
  startSession: (workspaceId?: WorkspaceId) => void
  /** Open an existing session (the desktop then focuses its workspace window). */
  openSession: (sessionId: SessionId) => void
}

/** Full composed Desktop props: the four shares plus the inject face. */
export type DesktopProps =
  & PropsRuntime<'root'>
  & PropsRenderSlots<'sidebar' | 'conversation' | 'details' | 'shell.overlay'>
  & PropsStore<ReturnType<typeof createWindowsStore>>
  & DesktopInjected
