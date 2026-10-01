// @vitest-environment jsdom
/**
 * Mobile navigation (the floating ☰ toggle + off-canvas drawer + backdrop).
 *
 * Regression: the fixed HUD header is z-index 70 and spans the phone width, but the toggle was z-50, so the HUD sat on
 * top of the ☰ and swallowed the tap; and the drawer (forced to z-index 6 by .po-shell .po-side) sat under its own
 * z-30 backdrop, so nav items could not be tapped even if it opened. These tests pin the behavior and the layer order.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';

vi.mock('next/navigation', () => ({ usePathname: () => '/command-center' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import Sidebar from './Sidebar';

afterEach(cleanup);

const toggle = () => screen.getByRole('button', { name: /(open|close) navigation/i });
const aside = (c: HTMLElement) => c.querySelector('aside.po-side') as HTMLElement;
const backdrop = (c: HTMLElement) => c.querySelector('div.fixed.inset-0.md\\:hidden') as HTMLElement | null;
const z = (el: HTMLElement | null) => Number(el?.style.zIndex);

describe('Sidebar mobile navigation', () => {
  it('starts closed: drawer off-canvas, no backdrop, toggle offers to open', () => {
    const { container } = render(<Sidebar />);
    expect(toggle().getAttribute('aria-label')).toBe('Open navigation');
    expect(aside(container).className).toContain('-translate-x-full');
    expect(backdrop(container)).toBeNull();
  });

  it('the toggle opens the drawer and shows the backdrop', () => {
    const { container } = render(<Sidebar />);
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-label')).toBe('Close navigation');
    expect(aside(container).className).toContain('translate-x-0');
    expect(aside(container).className).not.toContain('-translate-x-full');
    expect(backdrop(container)).not.toBeNull();
  });

  it('the toggle closes it again', () => {
    const { container } = render(<Sidebar />);
    fireEvent.click(toggle());
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-label')).toBe('Open navigation');
    expect(aside(container).className).toContain('-translate-x-full');
    expect(backdrop(container)).toBeNull();
  });

  it('tapping the backdrop closes it', () => {
    const { container } = render(<Sidebar />);
    fireEvent.click(toggle());
    fireEvent.click(backdrop(container)!);
    expect(toggle().getAttribute('aria-label')).toBe('Open navigation');
    expect(backdrop(container)).toBeNull();
  });

  it('selecting a nav item closes the drawer and keeps the link target', () => {
    const { container } = render(<Sidebar />);
    fireEvent.click(toggle());
    const jobs = screen.getByRole('link', { name: /jobs/i });
    expect(jobs.getAttribute('href')).toBe('/command-center/jobs');
    fireEvent.click(jobs);
    expect(toggle().getAttribute('aria-label')).toBe('Open navigation');
    expect(backdrop(container)).toBeNull();
  });
});

describe('Sidebar layer order (the actual bug)', () => {
  const hudZ = Number(/zIndex:\s*(\d+)/.exec(
    readFileSync(join(process.cwd(), 'src/components/command-center/CommandHUD.tsx'), 'utf8').split('id="cc-hud"')[1],
  )?.[1]);

  it('reads the HUD layer from its source (so this test follows it if it moves)', () => {
    expect(hudZ).toBeGreaterThan(0);
  });

  it('the toggle sits ABOVE the fixed HUD, otherwise the HUD swallows the tap', () => {
    render(<Sidebar />);
    expect(z(toggle())).toBeGreaterThan(hudZ);
  });

  it('when open: toggle > drawer > backdrop > HUD, so the drawer and its items are tappable', () => {
    const { container } = render(<Sidebar />);
    fireEvent.click(toggle());
    expect(z(toggle())).toBeGreaterThan(z(aside(container)));
    expect(z(aside(container))).toBeGreaterThan(z(backdrop(container)));
    expect(z(backdrop(container))).toBeGreaterThan(hudZ);
  });

  it('when closed the drawer does not force a z-index (desktop rail keeps the stylesheet value)', () => {
    const { container } = render(<Sidebar />);
    expect(aside(container).style.zIndex).toBe('');
  });
});
