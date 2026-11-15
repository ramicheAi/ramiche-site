/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import TerminalPage from "./page";

vi.mock("@/components/command-center/po/Instrument", () => ({
  InstrumentPage: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  Panel: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));

afterEach(cleanup);

describe("Command Center terminal", () => {
  it("server-renders without client timestamps, preventing hydration error #418", () => {
    expect(renderToString(<TerminalPage />)).not.toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });

  it("renders the intro on the client and runs a built-in command", async () => {
    render(<TerminalPage />);
    expect(await screen.findByText(/PARALLAX TERMINAL v1.0/)).toBeInTheDocument();
    const input = screen.getByPlaceholderText("Type a command...");
    fireEvent.change(input, { target: { value: "help" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText(/Available commands:/)).toBeInTheDocument();
    expect(screen.getByText(/status\s+— Show agent status summary/)).toBeInTheDocument();
  });
});
