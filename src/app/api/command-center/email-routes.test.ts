import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createTransport, sendMail, getSupabaseAdmin } = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("nodemailer", () => ({ default: { createTransport } }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin }));

import { POST as sendLeadEmail } from "./leads/send/route";
import { POST as approveGateItem } from "./gate/route";

const smtpEnv = {
  SMTP_HOST: "smtp.invalid",
  SMTP_PORT: "587",
  SMTP_USER: "sandbox-user",
  SMTP_PASS: "sandbox-pass",
  EMAIL_FROM: "sandbox@example.invalid",
};

function setSmtpEnv() {
  for (const [key, value] of Object.entries(smtpEnv)) process.env[key] = value;
}

function clearSmtpEnv() {
  for (const key of Object.keys(smtpEnv)) delete process.env[key];
}

describe("Nodemailer 10 email route compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSmtpEnv();
    sendMail.mockResolvedValue({ messageId: "sandbox-message-id" });
    createTransport.mockReturnValue({ sendMail });
  });

  afterEach(clearSmtpEnv);

  it("builds and sends the lead email through a mocked SMTP transport", async () => {
    const lead = {
      id: "lead-1",
      stage: "qualified",
      contact_email: "lead@example.invalid",
      meta: {
        kit: { coldEmail: { subject: "Subject", body: "Hello\n\nWorld" } },
      },
    };
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === "pipeline_leads") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: lead, error: null }) })),
          })),
          update: vi.fn(() => ({ eq: updateEq })),
        };
      }
      if (table === "pipeline_events") return { insert };
      throw new Error(`unexpected table ${table}`);
    });
    getSupabaseAdmin.mockReturnValue({ from });

    const response = await sendLeadEmail(new Request("http://localhost/api/command-center/leads/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadId: "lead-1" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sent: true,
      to: "lead@example.invalid",
      messageId: "sandbox-message-id",
    });
    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.invalid",
      port: 587,
      secure: false,
      auth: { user: "sandbox-user", pass: "sandbox-pass" },
    });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "lead@example.invalid",
      subject: "Subject",
      text: "Hello\n\nWorld",
      replyTo: "sandbox@example.invalid",
    }));
    expect(updateEq).toHaveBeenCalledWith("id", "lead-1");
    expect(insert).toHaveBeenCalledOnce();
  });

  it("executes an approved gate email through the same mocked SMTP contract", async () => {
    const item = {
      id: "gate-1",
      lead_id: "lead-1",
      kind: "send",
      title: "Gate title",
      status: "pending",
      payload: { subject: "Approved subject", body: "Approved body" },
      pipeline_leads: { contact_email: "lead@example.invalid" },
    };
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === "pipeline_gate") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: item, error: null }) })),
          })),
          update: vi.fn(() => ({ eq: updateEq })),
        };
      }
      if (table === "pipeline_events") return { insert };
      throw new Error(`unexpected table ${table}`);
    });
    getSupabaseAdmin.mockReturnValue({ from });

    const response = await approveGateItem(new Request("http://localhost/api/command-center/gate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "gate-1", action: "approve" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "executed",
      sentTo: "lead@example.invalid",
      messageId: "sandbox-message-id",
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: "Parallax Ventures <sandbox@example.invalid>",
      to: "lead@example.invalid",
      subject: "Approved subject",
      text: "Approved body",
      replyTo: "sandbox@example.invalid",
    });
    expect(updateEq).toHaveBeenCalledWith("id", "gate-1");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      lead_id: "lead-1",
      kind: "outreach_sent",
    }));
  });
});
