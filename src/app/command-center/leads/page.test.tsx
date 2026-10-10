/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LeadsPage from "./page";

vi.mock("next/link", () => ({ default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={String(href)} {...props}>{children}</a> }));
vi.mock("@/components/command-center/po/Instrument", () => ({ InstrumentPage: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));

const nowIso = () => new Date().toISOString();
const payload = (leads: unknown[] = []) => ({
  leads,
  meta: { source: "supabase.pipeline_leads", source_checked_at: nowIso(), response_generated_at: nowIso() },
});
const lead = (id: string, company: string) => ({
  id, name: null, company, product: null, stage: "lead", source: "manual", value: 1200, notes: null, meta: null,
});
const jsonResponse = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), {
  status,
  headers: { date: nowIso() },
}));

beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("LeadsPage live CRM states", () => {
  it("renders loading and aborts the live request on unmount", async () => {
    let requestSignal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation((_input, init) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    });
    const view = render(<LeadsPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading live CRM leads");
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    view.unmount();
    expect(requestSignal?.aborted).toBe(true);
  });

  it("renders verified empty only after a valid zero-row response", async () => {
    vi.mocked(fetch).mockImplementation(() => jsonResponse(200, payload()));
    render(<LeadsPage />);
    expect(await screen.findByText(/No leads found in the live CRM/)).toBeInTheDocument();
    expect(screen.getByText(/Source: supabase.pipeline_leads/)).toBeInTheDocument();
  });

  it("renders unavailable for HTTP, malformed rows, and stale provenance", async () => {
    const cases = [
      () => jsonResponse(503, { error: "unavailable" }),
      () => jsonResponse(200, payload([{ id: "bad" }])),
      () => jsonResponse(200, { ...payload(), meta: { ...payload().meta, source_checked_at: "2020-01-01T00:00:00.000Z" } }),
    ];
    for (const fetchCase of cases) {
      vi.mocked(fetch).mockImplementation(fetchCase);
      const view = render(<LeadsPage />);
      expect(await screen.findByRole("alert")).toHaveTextContent("CRM data unavailable");
      view.unmount();
    }
  });

  it("transitions a stalled request from loading to unavailable on timeout", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));
    render(<LeadsPage />);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(screen.getByRole("alert")).toHaveTextContent("Live CRM request timed out");
  });

  it("renders verified lead data", async () => {
    vi.mocked(fetch).mockImplementation(() => jsonResponse(200, payload([lead("lead-1", "Verified Co")])));
    render(<LeadsPage />);
    expect(await screen.findByText("Verified Co")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("retries from unavailable to verified data", async () => {
    vi.mocked(fetch)
      .mockImplementationOnce(() => jsonResponse(503, { error: "unavailable" }))
      .mockImplementationOnce(() => jsonResponse(200, payload([lead("lead-2", "Recovered Co")])));
    render(<LeadsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry live CRM" }));
    expect(await screen.findByText("Recovered Co")).toBeInTheDocument();
  });

  it("aborts superseded retries and ignores stale race completions", async () => {
    let resolveStale: ((response: Response) => void) | undefined;
    let firstRetrySignal: AbortSignal | undefined;
    vi.mocked(fetch)
      .mockImplementationOnce(() => jsonResponse(503, { error: "unavailable" }))
      .mockImplementationOnce((_input, init) => {
        firstRetrySignal = init?.signal ?? undefined;
        return new Promise<Response>((resolve) => { resolveStale = resolve; });
      })
      .mockImplementationOnce(() => jsonResponse(200, payload([lead("lead-new", "Newest Co")])));

    render(<LeadsPage />);
    const retry = await screen.findByRole("button", { name: "Retry live CRM" });
    act(() => {
      retry.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      retry.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(await screen.findByText("Newest Co")).toBeInTheDocument();
    expect(firstRetrySignal?.aborted).toBe(true);
    await act(async () => { resolveStale?.(await jsonResponse(200, payload([lead("lead-old", "Stale Co")]))); });
    await waitFor(() => expect(screen.queryByText("Stale Co")).not.toBeInTheDocument());
  });
});
