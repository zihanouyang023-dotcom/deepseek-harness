/**
 * WindowsLayoutController: the desktop's ctx.layout provider — the same
 * outward panel-action face ui-layout supplies (structural twin of its
 * ILayout), so layout-dependent feature plugins (sidebar, conversation,
 * app-shell) activate unchanged when this package replaces ui-layout in a
 * profile. Writes go through the desktop store's bound actions, attached by
 * the root registration's inject hook (a sanctioned assembly side effect).
 */
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { createWindowsStore } from './stores.ts'

/** The desktop store's bound action set (framework-baked, draft params peeled). */
export type DesktopBoundActions = BoundActions<ReturnType<typeof createWindowsStore>>

/**
 * The outward layout face (`ctx.layout`) under the desktop shell: sidebar
 * toggling drives the fixed left column, details opening drives the focused
 * window's details pane. Structurally identical to ui-layout's ILayout so
 * both type programs merge cleanly.
 */
export interface IWindowsLayout {
  /** Toggle the fixed left sidebar column. */
  toggleSidebar(): void
  /** Open the details pane (no-op when already open). */
  openDetails(): void
  /** Close the details pane. */
  closeDetails(): void
}

/** Desktop layout face (ctx.layout). */
export class WindowsLayoutController implements IWindowsLayout {
  #actions: DesktopBoundActions | undefined

  /**
   * Adopt the root entry's bound store actions (wired from the root
   * registration's inject hook).
   * @param actions - bound actions of the desktop store instance.
   */
  attachActions(actions: DesktopBoundActions): void {
    this.#actions = actions
  }

  /** Toggle the fixed left sidebar column. */
  toggleSidebar(): void {
    this.#require().toggleSidebar()
  }

  /** Open the details pane (no-op when already open). */
  openDetails(): void {
    this.#require().setDetailsOpen(true)
  }

  /** Close the details pane. */
  closeDetails(): void {
    this.#require().setDetailsOpen(false)
  }

  #require(): DesktopBoundActions {
    // Callers are UI gestures, which cannot fire before the root entry
    // rendered (the inject hook runs in its first render) — reaching this
    // unwired is a boot-order bug, not a race to tolerate.
    if (this.#actions === undefined) throw new Error('windows layout: actions not wired (root entry not mounted)')
    return this.#actions
  }
}
