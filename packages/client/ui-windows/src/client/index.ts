/**
 * Windows desktop plugin, browser half. One register() call contributes the
 * Desktop into the built-in 'root' slot and, in the same breath, declares the
 * four frame child slots (structural twins of ui-layout's, so sidebar,
 * conversation, details, and overlay plugins fill them unchanged), seats the
 * window-geometry store, and injects the session callbacks. The same effect
 * provides ctx.layout — the desktop's structural twin of ui-layout's face —
 * so feature plugins that inject layout (sidebar, conversation, app-shell)
 * activate unchanged. Registration precedes service provision so a
 * synchronously woken layout-dependent plugin never registers into an
 * undeclared slot.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { WindowsLayoutController } from './service.ts'
import { createWindowsStore } from './stores.ts'
import { Desktop } from './Desktop.tsx'
import type { DesktopInjected } from './contract.ts'
import type { DesktopBoundActions } from './service.ts'

export type {
  DesktopProps, DesktopInjected, SidebarOwnerProps, ConversationOwnerProps,
  DetailsOwnerProps, WindowGeometry,
} from './contract.ts'
export type { DesktopState, DesktopActions, Viewport } from './stores.ts'
export type { IWindowsLayout, DesktopBoundActions } from './service.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The outward layout face (the desktop's structural twin of ui-layout's ILayout). */
    layout: import('./service.ts').IWindowsLayout
  }
}

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'sessions', 'workspaces']

/**
 * Register the desktop root and provide the layout service face.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const layout = new WindowsLayoutController()
  ctx.effect(() => {
    const disposeRegistration = ctx.slots.register({
      name: 'root',
      children: {
        'sidebar': { kind: 'single', scope: 'root' },
        'conversation': { kind: 'single', scope: 'session-maybe' },
        'details': { kind: 'single', scope: 'session' },
        'shell.overlay': { kind: 'list', scope: 'root' },
      },
      store: createWindowsStore,
      inject: (actions: DesktopBoundActions): DesktopInjected => {
        layout.attachActions(actions)
        return {
          startSession: (workspaceId) => { ctx.workspaces.startSession(workspaceId) },
          openSession: (sessionId) => { ctx.sessions.open(sessionId) },
        }
      },
    }, Desktop)
    const disposeService = ctx.reflect.provide('layout', layout)
    return () => {
      disposeRegistration()
      // provide()'s disposer settles asynchronously; teardown is synchronous fire-and-forget.
      void disposeService()
    }
  }, 'ui-windows: desktop registration + layout service')
}
