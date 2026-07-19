/**
 * OpenAI-strict tool JSON Schema 规范化。
 *
 * 部分中转 / OpenAI 系端点校验 tool parameters 时要求：
 *   每个 type:object 的 required 必须包含 properties 的全部 key
 * （错误文案：Missing 'scope' / 'required' is required to be supplied ...）。
 *
 * AI SDK 从 zod `.optional()` 生成的 schema 会把可选字段放进 properties 却不进 required，
 * 从而 HTTP 400（生成助手 propose_storyboard_plan 等）。
 *
 * 出站前把「缺 required 的 property」补进 required，并允许 null（模型可显式传 null），
 * 运行时 zod 仍按原 optional 解析。
 */

type Json = Record<string, unknown>;

function isPlainObject(value: unknown): value is Json {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** 已是 anyOf[..., {type:null}] 或 type 含 null 则视为可空。 */
function alreadyNullable(schema: Json): boolean {
  if (Array.isArray(schema.type) && schema.type.includes("null")) return true;
  if (schema.type === "null") return true;
  const anyOf = schema.anyOf;
  if (Array.isArray(anyOf)) {
    return anyOf.some((branch) => isPlainObject(branch) && (branch.type === "null" || alreadyNullable(branch)));
  }
  return false;
}

function ensureNullable(schema: Json): Json {
  if (alreadyNullable(schema)) return schema;
  // 去掉顶层 description 以外的元数据拷贝；用 anyOf 保留原约束
  const { description, ...rest } = schema;
  const wrapped: Json = {
    anyOf: [rest, { type: "null" }],
  };
  if (typeof description === "string") wrapped.description = description;
  return wrapped;
}

/**
 * 递归规范化单个 JSON Schema 节点。
 * 返回新对象（浅层可变 + 递归替换），调用方可原地使用返回值。
 */
export function normalizeJsonSchemaForOpenAIStrict(schema: unknown): unknown {
  if (!isPlainObject(schema)) return schema;

  const out: Json = { ...schema };

  // 组合子
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
      // 保持稳定顺序：原 required 在前，再补 missing
      out.required = [...requiredList, ...missing.filter((k) => !requiredList.includes(k))];
    } else if (propKeysEmptyButObject(out) && !Array.isArray(out.required)) {
      // 空 object（如 read_canvas_state 的 parameters）给 required: []
      out.required = [];
    }
  }

  return out;
}

function propKeysEmptyButObject(schema: Json): boolean {
  return schema.type === "object" && (schema.properties === undefined || (isPlainObject(schema.properties) && Object.keys(schema.properties).length === 0));
}

/**
 * 规范化 chat/completions body 里的 tools 数组（OpenAI function tools）。
 * 原地修改 tools 项的 function.parameters；返回同一数组引用。
 */
export function normalizeToolsJsonSchemaForOpenAIStrict(tools: unknown): unknown {
  if (!Array.isArray(tools)) return tools;
  for (const tool of tools) {
    if (!isPlainObject(tool)) continue;
    const fn = tool.function;
    if (!isPlainObject(fn)) continue;
    if (fn.parameters !== undefined) {
      fn.parameters = normalizeJsonSchemaForOpenAIStrict(fn.parameters);
    }
  }
  return tools;
}

/**
 * 在请求 body 上规范化 tools（若存在）。返回新 body 浅拷贝 + 规范化后的 tools。
 */
export function applyOpenAIToolSchemaStrictToBody(body: Record<string, unknown>): Record<string, unknown> {
  if (!("tools" in body) || body.tools === undefined) return body;
  const tools = Array.isArray(body.tools) ? body.tools.map((t) => (isPlainObject(t) ? { ...t, function: isPlainObject(t.function) ? { ...t.function } : t.function } : t)) : body.tools;
  normalizeToolsJsonSchemaForOpenAIStrict(tools);
  return { ...body, tools };
}

/** 测试/诊断：列出 object 节点上「在 properties 但不在 required」的路径。 */
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
    const required = new Set(Array.isArray(schema.required) ? schema.required.filter((k): k is string => typeof k === "string") : []);
    for (const [key, value] of Object.entries(schema.properties)) {
      if (!required.has(key)) out.push(`${path}.${key}`);
      out.push(...listOpenAIStrictViolations(value, `${path}.${key}`));
    }
  }
  return out;
}
