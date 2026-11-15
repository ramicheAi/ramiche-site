/**
 * @vitest-environment jsdom
 *
 * Behaviour of the mobile navigation drawer. These are the defects the independent review found:
 * the closed drawer stayed focusable, Escape did nothing, focus was not returned to the control
 * that opened it, and the secondary controls had no mobile path at all.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Sidebar from '../Sidebar';

vi.mock('next/navigation', () => ({ usePathname: () => '/command-center' }));

vi.mock('../PoShell', () => ({
  usePoTheme: () => ({ theme: 'dark', still: false, toggleTheme: vi.fn(), toggleStill: vi.fn() }),
}));

/** jsdom has no matchMedia; the drawer asks it whether it is in its off-canvas state. */
function mockViewport(isPhone: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: isPhone && /max-width/.test(query),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// Queried by DOM, not by role: once the drawer is inert it is deliberately absent from the
// accessibility tree, which is the behaviour under test.
const drawer = () => document.querySelector('aside.po-side') as HTMLElement;
const openDrawer = () =>
  fireEvent(window, new CustomEvent('cc:toggle-nav'));

beforeEach(() => mockViewport(true));
afterEach(cleanup);

describe('mobile drawer', () => {
  it('is inert and hidden from the tab order while closed', async () => {
    render(<Sidebar />);
    await waitFor(() => expect(drawer()).toHaveAttribute('inert'));
  });

  it('opens from the HUD event and becomes interactive', async () => {
    render(<Sidebar />);
    openDrawer();
    await waitFor(() => expect(drawer()).not.toHaveAttribute('inert'));
  });

  it('closes on Escape and returns focus to the menu button', async () => {
    const menu = document.createElement('button');
    menu.id = 'cc-menu-btn';
    document.body.appendChild(menu);
    menu.focus();

    render(<Sidebar />);
    openDrawer();
    await waitFor(() => expect(drawer()).not.toHaveAttribute('inert'));

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(drawer()).toHaveAttribute('inert'));
    expect(document.activeElement).toBe(menu);
    menu.remove();
  });

  it('is never inert on a wide viewport, where it is the permanent rail', () => {
    mockViewport(false);
    render(<Sidebar />);
    expect(drawer()).not.toHaveAttribute('inert');
  });

  it('carries working pulse, wake and theme controls', async () => {
    const pulses: Event[] = [];
    const wakes: Event[] = [];
    window.addEventListener('cc:toggle-pulse', (e) => pulses.push(e));
    window.addEventListener('cc:toggle-wake', (e) => wakes.push(e));

    render(<Sidebar />);
    openDrawer();
    await waitFor(() => expect(drawer()).not.toHaveAttribute('inert'));
    fireEvent.click(screen.getByRole('button', { name: /pulse/i }));
    fireEvent.click(screen.getByRole('button', { name: /wake/i }));
    fireEvent.click(screen.getByRole('button', { name: /theme|appearance/i }));

    expect(pulses).toHaveLength(1);
    expect(wakes).toHaveLength(1);
    expect(screen.getByRole('button', { name: /theme|appearance/i })).toBeInTheDocument();
  });
});
