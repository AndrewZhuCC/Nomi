/**
 * OpenAI-strict tool JSON Schema 规范化。
 *
 * 部分中转 / OpenAI 系端点（含 strict:true 的 Responses API）校验 tool parameters 时要求：
 *   每个 type:object 的 required 必须包含 properties 的全部 key
 * （错误文案：Missing 'scope' / Missing 'family' / 'required' is required to be supplied ...）。
 *
 * AI SDK 从 zod `.optional()` 生成的 schema 会把可选字段放进 properties 却不进 required，
 * 从而 HTTP 400。
 *
 * 出站前补全 required，并把原 optional 字段改为「可 null」（模型可显式传 null），
 * 运行时 zod 仍按原 optional 解析。
 *
 * 支持两种 wire 形态：
 * - chat/completions: tools[].function.parameters
 * - Responses API:    tools[].parameters（扁平，无 function 包一层）
 * - legacy:           functions[].parameters
 */

type Json = Record<string, unknown>;

function isPlainObject(value: unknown): value is Json {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function alreadyNullable(schema: Json): boolean {
  if (Array.isArray(schema.type) && schema.type.includes("null")) return true;
  if (schema.type === "null") return true;
  const anyOf = schema.anyOf;
  if (Array.isArray(anyOf)) {
    return anyOf.some((branch) => isPlainObject(branch) && (branch.type === "null" || alreadyNullable(branch)));
  }
  return false;
}

/**
 * 把可选字段变成 strict 友好的「必填但可 null」。
 * 简单标量优先 type: [T, "null"]；复杂结构用 anyOf。
 */
function ensureNullable(schema: Json): Json {
  if (alreadyNullable(schema)) return schema;

  const { description, ...rest } = schema;
  const simpleType = rest.type;
  // 单一基础 type 且无 properties/items/enum 复杂组合 → type 数组含 null
  if (
    typeof simpleType === "string" &&
    ["string", "number", "integer", "boolean", "object", "array"].includes(simpleType) &&
    rest.properties === undefined &&
    rest.items === undefined &&
    rest.enum === undefined &&
    rest.anyOf === undefined &&
    rest.oneOf === undefined &&
    rest.allOf === undefined
  ) {
    const wrapped: Json = { ...rest, type: [simpleType, "null"] };
    if (typeof description === "string") wrapped.description = description;
    return wrapped;
  }

  // enum 单独处理：enum 值 + null，type 含 null
  if (Array.isArray(rest.enum) && (simpleType === "string" || simpleType === "number" || simpleType === undefined)) {
    const wrapped: Json = {
      ...rest,
      type: simpleType ? [simpleType, "null"] : ["string", "null"],
      enum: [...rest.enum, null],
    };
    if (typeof description === "string") wrapped.description = description;
    return wrapped;
  }

  const wrapped: Json = {
    anyOf: [rest, { type: "null" }],
  };
  if (typeof description === "string") wrapped.description = description;
  return wrapped;
}

export function normalizeJsonSchemaForOpenAIStrict(schema: unknown): unknown {
  if (!isPlainObject(schema)) return schema;

  const out: Json = { ...schema };

  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    const arr = out[key];
    if (Array.isArray(arr)) {
      out[key] = arr.map((item) => normalizeJsonSchemaForOpenAIStrict(item));
    }
  }

  if (out.items !== undefined) {
    out.items = normalizeJsonSchemaForOpenAIStrict(out.items);
  }
  if (isPlainObject(out.additionalProperties)) {
    out.additionalProperties = normalizeJsonSchemaForOpenAIStrict(out.additionalProperties);
  }

  if (out.type === "object" || (Array.isArray(out.type) && out.type.includes("object")) || isPlainObject(out.properties)) {
    const propsRaw = out.properties;
    if (isPlainObject(propsRaw)) {
      const properties: Json = {};
      for (const [key, value] of Object.entries(propsRaw)) {
        properties[key] = normalizeJsonSchemaForOpenAIStrict(value);
      }

      const propKeys = Object.keys(properties);
      const requiredList = Array.isArray(out.required)
        ? out.required.filter((k): k is string => typeof k === "string")
        : [];
      const requiredSet = new Set(requiredList);
      const missing = propKeys.filter((k) => !requiredSet.has(k));

      for (const key of missing) {
        const prop = properties[key];
        if (isPlainObject(prop)) {
          properties[key] = ensureNullable(prop);
        }
        requiredSet.add(key);
      }

      out.properties = properties;
      out.required = [...requiredList, ...missing.filter((k) => !requiredList.includes(k))];
      // OpenAI strict 要求 object 显式 additionalProperties: false
      if (out.additionalProperties === undefined) {
        out.additionalProperties = false;
      }
    } else if (
      out.type === "object" &&
      (out.properties === undefined || (isPlainObject(out.properties) && Object.keys(out.properties).length === 0)) &&
      !Array.isArray(out.required)
    ) {
      out.properties = out.properties ?? {};
      out.required = [];
      if (out.additionalProperties === undefined) out.additionalProperties = false;
    }
  }

  return out;
}

/** 规范化单个 tool 条目（兼容 chat / responses / legacy functions）。 */
function normalizeOneToolLike(tool: unknown): void {
  if (!isPlainObject(tool)) return;

  // chat/completions: { type, function: { name, parameters } }
  if (isPlainObject(tool.function) && tool.function.parameters !== undefined) {
    tool.function.parameters = normalizeJsonSchemaForOpenAIStrict(tool.function.parameters);
  }
  // Responses API flat: { type:"function", name, parameters, strict? }
  if (tool.parameters !== undefined && !isPlainObject(tool.function)) {
    tool.parameters = normalizeJsonSchemaForOpenAIStrict(tool.parameters);
  }
  // 有的实现同时挂 parameters 在顶层与 function 下，两边都规范化
  if (tool.parameters !== undefined && isPlainObject(tool.function)) {
    tool.parameters = normalizeJsonSchemaForOpenAIStrict(tool.parameters);
  }
}

export function normalizeToolsJsonSchemaForOpenAIStrict(tools: unknown): unknown {
  if (!Array.isArray(tools)) return tools;
  for (const tool of tools) normalizeOneToolLike(tool);
  return tools;
}

export function applyOpenAIToolSchemaStrictToBody(body: Record<string, unknown>): Record<string, unknown> {
  let changed = false;
  const next: Record<string, unknown> = { ...body };

  if (Array.isArray(body.tools)) {
    const tools = body.tools.map((t) => {
      if (!isPlainObject(t)) return t;
      const copy: Json = { ...t };
      if (isPlainObject(t.function)) copy.function = { ...t.function };
      return copy;
    });
    normalizeToolsJsonSchemaForOpenAIStrict(tools);
    next.tools = tools;
    changed = true;
  }

  // legacy function calling
  if (Array.isArray(body.functions)) {
    const functions = body.functions.map((f) => (isPlainObject(f) ? { ...f } : f));
    for (const fn of functions) {
      if (isPlainObject(fn) && fn.parameters !== undefined) {
        fn.parameters = normalizeJsonSchemaForOpenAIStrict(fn.parameters);
      }
    }
    next.functions = functions;
    changed = true;
  }

  return changed ? next : body;
}

export function listOpenAIStrictViolations(schema: unknown, path = "$"): string[] {
  const out: string[] = [];
  if (!isPlainObject(schema)) return out;

  if (Array.isArray(schema.anyOf)) {
    schema.anyOf.forEach((branch, i) => out.push(...listOpenAIStrictViolations(branch, `${path}.anyOf[${i}]`)));
  }
  if (Array.isArray(schema.oneOf)) {
    schema.oneOf.forEach((branch, i) => out.push(...listOpenAIStrictViolations(branch, `${path}.oneOf[${i}]`)));
  }
  if (Array.isArray(schema.allOf)) {
    schema.allOf.forEach((branch, i) => out.push(...listOpenAIStrictViolations(branch, `${path}.allOf[${i}]`)));
  }
  if (schema.items !== undefined) {
    out.push(...listOpenAIStrictViolations(schema.items, `${path}[]`));
  }

  if (isPlainObject(schema.properties)) {
    const required = new Set(
      Array.isArray(schema.required) ? schema.required.filter((k): k is string => typeof k === "string") : [],
    );
    for (const [key, value] of Object.entries(schema.properties)) {
      if (!required.has(key)) out.push(`${path}.${key}`);
      out.push(...listOpenAIStrictViolations(value, `${path}.${key}`));
    }
  }
  return out;
}
