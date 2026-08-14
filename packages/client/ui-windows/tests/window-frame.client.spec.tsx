// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WindowFrame, type WindowFrameProps } from '../src/client/WindowFrame.tsx'

afterEach(cleanup)

beforeEach(() => {
  // jsdom lacks pointer capture: emulate per-element so hasPointerCapture gates pass.
  const captured = new WeakSet<Element>()
  Element.prototype.setPointerCapture = function () { captured.add(this) }
  Element.prototype.releasePointerCapture = function () { captured.delete(this) }
  Element.prototype.hasPointerCapture = function () { return captured.has(this) }
})

const geometry = { x: 100, y: 60, w: 800, h: 500 }

function mount(overrides: Partial<WindowFrameProps> = {}) {
  const props: WindowFrameProps = {
    title: 'workspace',
    subtitle: '/projects/workspace',
    focused: false,
    maximized: false,
    geometry,
    onFocus: vi.fn(),
    onMinimize: vi.fn(),
    onToggleMaximize: vi.fn(),
    onClose: vi.fn(),
    onMove: vi.fn(),
    onResize: vi.fn(),
    children: <div data-testid="content">content</div>,
    ...overrides,
  }
  render(<WindowFrame {...props} />)
  return props
}

function drag(el: Element, from: { x: number; y: number }, to: { x: number; y: number }): void {
  const down = new PointerEvent('pointerdown', { pointerId: 1, clientX: from.x, clientY: from.y, bubbles: true })
  const move = new PointerEvent('pointermove', { pointerId: 1, clientX: to.x, clientY: to.y, bubbles: true })
  const up = new PointerEvent('pointerup', { pointerId: 1, clientX: to.x, clientY: to.y, bubbles: true })
  act(() => { el.dispatchEvent(down) })
  act(() => { el.dispatchEvent(move) })
  act(() => { el.dispatchEvent(up) })
}

describe('WindowFrame', () => {
  it('renders the title, subtitle, content, and focus state', () => {
    const props = mount({ focused: true })
    expect(screen.getByText('workspace')).toBeTruthy()
    expect(screen.getByText('/projects/workspace')).toBeTruthy()
    expect(screen.getByTestId('content')).toBeTruthy()
    expect(document.querySelector('[data-focused="true"]')).toBeTruthy()
    expect(props.onFocus).not.toHaveBeenCalled()
  })

  it('routes the three control buttons', () => {
    const props = mount()
    fireEvent.click(screen.getByLabelText('最小化'))
    expect(props.onMinimize).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByLabelText('最大化'))
    expect(props.onToggleMaximize).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByLabelText('关闭'))
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('drags the title bar to a new absolute position and raises the window', () => {
    const props = mount()
    drag(screen.getByTestId('window-titlebar'), { x: 200, y: 100 }, { x: 260, y: 140 })
    expect(props.onFocus).toHaveBeenCalledOnce()
    expect(props.onMove).toHaveBeenCalledWith(160, 100)
  })

  it('resizes from the bottom-right handle', () => {
    const props = mount()
    drag(screen.getByTestId('window-resize'), { x: 900, y: 560 }, { x: 950, y: 600 })
    expect(props.onResize).toHaveBeenCalledWith(850, 540)
  })

  it('maximized windows fill the work area and disable drag and resize', () => {
    const props = mount({ maximized: true })
    const frame = document.querySelector('[data-maximized="true"]') as HTMLElement
    expect(frame.style.left).toBe('0px')
    expect(frame.style.right).toBe('0px')
    expect(frame.style.bottom).toBe('48px')
    expect(screen.getByLabelText('还原')).toBeTruthy()
    expect(screen.queryByTestId('window-resize')).toBeNull()
    drag(screen.getByTestId('window-titlebar'), { x: 200, y: 100 }, { x: 260, y: 140 })
    expect(props.onMove).not.toHaveBeenCalled()
  })

  it('omits the subtitle line when absent', () => {
    const props = mount({ subtitle: undefined })
    expect(screen.getByText('workspace')).toBeTruthy()
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('double-clicking the title bar toggles maximize', () => {
    const props = mount()
    fireEvent.doubleClick(screen.getByTestId('window-titlebar'))
    expect(props.onToggleMaximize).toHaveBeenCalledOnce()
  })

  it('any pointer-down inside the window raises it to the front', () => {
    const props = mount()
    fireEvent.pointerDown(screen.getByTestId('content'))
    expect(props.onFocus).toHaveBeenCalledOnce()
  })
})
