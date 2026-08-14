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
     * The fixed left sidebar column (native ui-sidebar: workspace/session
     * browser). The desktop supplies live column state; a closed sidebar
     * collapses to the compact rail via the same collapsed/width share.
     */
    'sidebar': { kind: 'single'; scope: 'root'; owner: SidebarOwnerProps }
    /**
     * The current session's conversation surface, rendered once inside the
     * current session's window (session-maybe: the no-session hero renders
     * while no session is current).
     */
    'conversation': { kind: 'single'; scope: 'session-maybe'; owner: ConversationOwnerProps }
    /**
     * The current session window's right pane, mounted while the desktop
     * opens it.
     */
    'details': { kind: 'single'; scope: 'session'; owner: DetailsOwnerProps }
    /**
     * Desktop-wide floating layer (additive; click-through until an entry
     * opts into pointer events).
     */
    'shell.overlay': { kind: 'list'; scope: 'root' }
  }
}

/** Sidebar owner share: live column state from the desktop. */
export interface SidebarOwnerProps {
  /** True when the sidebar is closed (renders the compact control rail). */
  collapsed: boolean
  /** Rendered column width in px. */
  width: number
}

/** Conversation owner share: empty — session facts arrive through the framework hooks. */
export interface ConversationOwnerProps {}

/** Details owner share: empty — sessionId arrives as a framework-standard prop. */
export interface DetailsOwnerProps {}

/** One window's desktop-local viewport geometry. */
export interface WindowGeometry {
  /** Left edge in world px (canvas coordinates; unclamped on the infinite canvas). */
  x: number
  /** Top edge in world px. */
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
