import { describe, expect, it } from "vitest";
import {
  applyOpenAIToolSchemaStrictToBody,
  listOpenAIStrictViolations,
  normalizeJsonSchemaForOpenAIStrict,
  normalizeToolsJsonSchemaForOpenAIStrict,
} from "./openaiToolSchemaStrict";

describe("normalizeJsonSchemaForOpenAIStrict", () => {
  it("把 properties 有、required 缺的字段补进 required，并允许 null", () => {
    const input = {
      type: "object",
      properties: {
        id: { type: "string" },
        scope: { type: "string", enum: ["all", "selective"] },
      },
      required: ["id"],
      additionalProperties: false,
    };
    const out = normalizeJsonSchemaForOpenAIStrict(input) as {
      required: string[];
      properties: { scope: { anyOf: unknown[] } };
    };
    expect(out.required).toEqual(["id", "scope"]);
    expect(out.properties.scope.anyOf).toEqual([
      { type: "string", enum: ["all", "selective"] },
      { type: "null" },
    ]);
    expect(listOpenAIStrictViolations(out)).toEqual([]);
  });

  it("递归处理 anchors.items（propose_storyboard_plan 复现）", () => {
    const input = {
      type: "object",
      properties: {
        title: { type: "string" },
        anchors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              scope: { type: "string", enum: ["all", "selective"] },
            },
            required: ["id"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "anchors"],
      additionalProperties: false,
    };
    const out = normalizeJsonSchemaForOpenAIStrict(input);
    expect(listOpenAIStrictViolations(out)).toEqual([]);
    const items = (out as { properties: { anchors: { items: { required: string[] } } } }).properties.anchors.items;
    expect(items.required).toContain("scope");
  });

  it("幂等：已 strict 的 schema 再规范化不破坏", () => {
    const already = {
      type: "object",
      properties: {
        id: { type: "string" },
        scope: { anyOf: [{ type: "string", enum: ["all", "selective"] }, { type: "null" }] },
      },
      required: ["id", "scope"],
    };
    const once = normalizeJsonSchemaForOpenAIStrict(already);
    const twice = normalizeJsonSchemaForOpenAIStrict(once);
    expect(listOpenAIStrictViolations(twice)).toEqual([]);
    expect((twice as { required: string[] }).required).toEqual(["id", "scope"]);
  });

  it("空 object 补 required: []", () => {
    const out = normalizeJsonSchemaForOpenAIStrict({ type: "object", properties: {} }) as { required: string[] };
    expect(out.required).toEqual([]);
  });
});

describe("normalizeToolsJsonSchemaForOpenAIStrict / body", () => {
  it("规范化 tools[].function.parameters", () => {
    const tools = [
      {
        type: "function",
        function: {
          name: "propose_storyboard_plan",
          parameters: {
            type: "object",
            properties: {
              anchors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    scope: { type: "string", enum: ["all", "selective"] },
                  },
                  required: ["id"],
                },
              },
            },
            required: ["anchors"],
          },
        },
      },
    ];
    normalizeToolsJsonSchemaForOpenAIStrict(tools);
    expect(listOpenAIStrictViolations(tools[0].function.parameters)).toEqual([]);
  });

  it("applyOpenAIToolSchemaStrictToBody 无 tools 时原样返回", () => {
    const body = { model: "x", messages: [] };
    expect(applyOpenAIToolSchemaStrictToBody(body)).toBe(body);
  });
});
