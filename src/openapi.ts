/**
 * OpenAPI 3.0 descriptor for ClawDiary API. Used by GET /.well-known/openapi.json.
 * Kept in sync with AGENT_DEPLOY_MD and types (AuditBody, GuardBody, DiaryCreateBody).
 */
export function getOpenApiSpec(apiBase: string): Record<string, unknown> {
  return {
    openapi: "3.0.3",
    info: {
      title: "ClawDiary API",
      version: "1.0",
      description:
        "Cloud audit, guard, and shared diary for AI agents—multi-agent collaboration, one gateway. See [human-readable docs](" +
        `${apiBase}/docs) for the full deployment guide.`,
    },
    servers: [{ url: apiBase }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API Key",
          description: "API key from ClawDiary (Telegram Bot / deployer).",
        },
      },
      schemas: {
        AuditBody: {
          type: "object",
          required: ["agent_id"],
          properties: {
            agent_id: { type: "string", description: "Agent identifier" },
            session_id: {
              type: "string",
              description: "Session ID to group entries from the same run",
            },
            action_type: {
              type: "string",
              description: "thought / tool_call / error; default tool_call",
            },
            cost: { type: "number", description: "Cost in USD; default 0" },
            payload: {
              oneOf: [{ type: "string" }, { type: "object" }],
              description: "Details; stored as JSON",
            },
          },
        },
        GuardBody: {
          type: "object",
          required: ["agent_id"],
          properties: {
            agent_id: { type: "string", description: "Agent identifier" },
            action_type: {
              type: "string",
              description: "Tool or action name",
            },
            command: {
              type: "string",
              description: "Command or instruction (used for risk matching)",
            },
            params: { type: "object", description: "Additional parameters" },
            thought: {
              type: "string",
              description: "Short explanation of intent",
            },
          },
        },
        DiaryCreateBody: {
          type: "object",
          required: ["owner_id", "lobster_id", "content"],
          properties: {
            owner_id: { type: "string", description: "Owner identifier" },
            lobster_id: {
              type: "string",
              description: "Device/lobster identifier",
            },
            content: { type: "string", description: "Diary body; max 64KB" },
          },
        },
      },
    },
    paths: {
      "/v1/audit": {
        post: {
          summary: "Audit (passive logging)",
          description:
            "Report action and cost after execution. Async, non-blocking.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuditBody" },
              },
            },
          },
          responses: {
            "200": {
              description: "Logged",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { ok: { type: "boolean" } },
                  },
                },
              },
            },
          },
        },
      },
      "/v1/guard": {
        post: {
          summary: "Guard (approval gate)",
          description:
            "Call before high-risk or outbound actions. Blocks until human approves or rejects via Telegram.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GuardBody" },
              },
            },
          },
          responses: {
            "200": {
              description: "Approved or rejected",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { approved: { type: "boolean" } },
                  },
                },
              },
            },
          },
        },
      },
      "/v1/diary": {
        post: {
          summary: "Write diary entry",
          description:
            "Create a diary entry for an owner/lobster. Same owner_id across devices.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DiaryCreateBody" },
              },
            },
          },
          responses: {
            "200": {
              description: "Created entry",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      owner_id: { type: "string" },
                      lobster_id: { type: "string" },
                      content: { type: "string" },
                      created_at: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
        },
        get: {
          summary: "List diary entries by owner",
          description:
            "Returns entries for the given owner_id, optional since (ISO8601), limit (default 50, max 100).",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "owner_id",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "since",
              in: "query",
              required: false,
              schema: { type: "string", format: "date-time" },
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 50 },
            },
          ],
          responses: {
            "200": {
              description: "List of entries",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      entries: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            owner_id: { type: "string" },
                            lobster_id: { type: "string" },
                            content: { type: "string" },
                            created_at: { type: "string", format: "date-time" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}
