/**
 * Durable Object: 审批挂起/唤醒
 * 以 approval_id 为实例 ID，/v1/guard 请求在此挂起直到 Telegram 回调唤醒
 */
export class GuardSession implements DurableObject {
  private resolve?: (result: { approved: boolean }) => void;

  constructor(
    private ctx: DurableObjectState,
    private env: Record<string, unknown>
  ) {}

  async fetch(request: Request): Promise<Response> {
    let body: { action: string; approved?: boolean };
    try {
      body = (await request.json()) as { action: string; approved?: boolean };
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (body.action === "wait") {
      const result = await this.waitForApproval();
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (body.action === "resolve" && typeof body.approved === "boolean") {
      this.resolveApproval(body.approved);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  private waitForApproval(): Promise<{ approved: boolean }> {
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  private resolveApproval(approved: boolean): void {
    if (this.resolve) {
      this.resolve({ approved });
      this.resolve = undefined;
    }
  }
}
