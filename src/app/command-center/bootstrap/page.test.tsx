/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BootstrapPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

const json = (body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  );

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  push.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Command Center bootstrap entry", () => {
  it("guides an already-enrolled browser to a one-time approval code", async () => {
    vi.mocked(fetch).mockImplementation(() => json({ ready: true, alreadyEnrolled: true }));
    render(<BootstrapPage />);
    expect(await screen.findByText(/one-time approval code/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Bootstrap token or approval code")).toBeInTheDocument();
  });

  it("keeps the bootstrap secret path for a first device", async () => {
    vi.mocked(fetch).mockImplementation(() => json({ ready: true, alreadyEnrolled: false }));
    render(<BootstrapPage />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/one-time approval code/i)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Bootstrap token or approval code")).toBeInTheDocument();
  });

  it("reports a deployment without a bootstrap secret", async () => {
    vi.mocked(fetch).mockImplementation(() => json({ ready: false, alreadyEnrolled: false }));
    render(<BootstrapPage />);
    expect(await screen.findByText(/not configured on this deployment/i)).toBeInTheDocument();
  });
});
