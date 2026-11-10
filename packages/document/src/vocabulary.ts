import { type CssNode, ident, lexer, parse, walk } from "css-tree";
import { type Node, parseDocument } from "yaml";
import { z } from "zod";
export interface ConnectionPresentation {
  strokeWidth: number | string;
  lineStyle: "solid" | "dashed" | "dotted";
  lineColor: string;
  startMarker: "none" | "arrow" | "bar" | "circle" | "diamond";
  endMarker: "none" | "arrow" | "bar" | "circle" | "diamond";
  text: string;
  reverseText: string;
}
export interface ResolvedConnectionType extends ConnectionPresentation {
  coreKind: "ordinary" | "map_link" | "external_link";
}
// Dimensional checking over css-tree's AST closes its deliberately permissive
// <calc()> lexer production. This never evaluates authored CSS or resolves units.
type Dimension = string;
function productDimension(
  a: Dimension,
  b: Dimension,
  divide: boolean,
): Dimension {
  const powers = new Map<string, number>();
  for (const [dimension, sign] of [
    [a, 1],
    [b, divide ? -1 : 1],
  ] as const) {
    if (dimension === "number") continue;
    for (const term of dimension.split("*")) {
      const [unit, exponent] = term.split("^");
      powers.set(unit, (powers.get(unit) ?? 0) + sign * Number(exponent ?? 1));
    }
  }
  return (
    [...powers]
      .filter(([, power]) => power !== 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([unit, power]) => (power === 1 ? unit : `${unit}^${power}`))
      .join("*") || "number"
  );
}
function mathDimension(
  node: CssNode,
  percentageHint: Dimension = "length",
): Dimension {
  const fail = (): never => {
    throw new Error("Invalid CSS math dimensions");
  };
  const compatible = (a: Dimension, b: Dimension) => (a === b ? a : fail());
  const expression = (nodes: CssNode[]): Dimension => {
    if (!nodes.length || nodes.length % 2 === 0) return fail();
    const values: Dimension[] = [];
    let current = mathDimension(nodes[0], percentageHint);
    for (let i = 1; i < nodes.length; i += 2) {
      const operator = nodes[i];
      if (operator.type !== "Operator") return fail();
      const op = operator.value.trim();
      const next = mathDimension(nodes[i + 1], percentageHint);
      if (op === "*" || op === "/") {
        current = productDimension(current, next, op === "/");
      } else if (op === "+" || op === "-") {
        values.push(current);
        current = next;
      } else return fail();
    }
    values.push(current);
    return values.reduce(compatible);
  };
  if (node.type === "Number") {
    if (!Number.isFinite(Number(node.value))) return fail();
    return "number";
  }
  if (node.type === "Percentage") {
    if (!Number.isFinite(Number(node.value))) return fail();
    return percentageHint;
  }
  if (node.type === "Dimension") {
    if (!Number.isFinite(Number(node.value))) return fail();
    for (const unit of [
      "length",
      "angle",
      "time",
      "frequency",
      "resolution",
      "flex",
    ] as const)
      if (lexer.matchType(unit, node).matched) return unit;
    return fail();
  }
  if (node.type === "Identifier") {
    if (["e", "pi"].includes(ident.decode(node.name).toLowerCase()))
      return "number";
    return fail();
  }
  if (node.type === "Value" || node.type === "Parentheses")
    return expression(node.children.toArray());
  if (node.type !== "Function") return fail();
  const groups: CssNode[][] = [[]];
  for (const child of node.children) {
    if (child.type === "Operator" && child.value.trim() === ",")
      groups.push([]);
    else groups[groups.length - 1].push(child);
  }
  const fn = ident.decode(node.name).toLowerCase();
  if (
    fn === "round" &&
    groups[0].length === 1 &&
    groups[0][0].type === "Identifier" &&
    ["nearest", "up", "down", "to-zero"].includes(
      groups[0][0].name.toLowerCase(),
    )
  )
    groups.shift();
  const args = groups.map(expression);
  const arity = (min: number, max = min) => {
    if (args.length < min || args.length > max) fail();
  };
  if (fn === "calc") {
    arity(1);
    return args[0];
  }
  if (["min", "max", "hypot"].includes(fn)) {
    arity(1, Infinity);
    return args.reduce(compatible);
  }
  if (fn === "clamp") {
    arity(3);
    return args.reduce(compatible);
  }
  if (["mod", "rem"].includes(fn)) {
    arity(2);
    return args.reduce(compatible);
  }
  if (fn === "round") {
    arity(1, 2);
    if (args.length === 1 && args[0] !== "number") return fail();
    return args.reduce(compatible);
  }
  if (fn === "abs") {
    arity(1);
    return args[0];
  }
  if (fn === "sign") {
    arity(1);
    return "number";
  }
  if (["sin", "cos", "tan"].includes(fn)) {
    arity(1);
    if (!["number", "angle"].includes(args[0])) return fail();
    return "number";
  }
  if (["asin", "acos", "atan"].includes(fn)) {
    arity(1);
    if (args[0] !== "number") return fail();
    return "angle";
  }
  if (fn === "atan2") {
    arity(2);
    args.reduce(compatible);
    return "angle";
  }
  if (["pow", "sqrt", "log", "exp"].includes(fn)) {
    arity(fn === "pow" ? 2 : 1, fn === "log" ? 2 : fn === "pow" ? 2 : 1);
    if (args.some((a) => a !== "number")) return fail();
    return "number";
  }
  return fail();
}
function css(value: string, property: string): boolean {
  try {
    const ast = parse(value, { context: "value" });
    let safe = true;
    walk(ast, (node) => {
      if (property === "color" && node.type === "Function") {
        const fn = ident.decode(node.name).toLowerCase();
        if (
          [
            "rgb",
            "rgba",
            "hsl",
            "hsla",
            "hwb",
            "lab",
            "lch",
            "oklab",
            "oklch",
            "color",
            "device-cmyk",
          ].includes(fn)
        ) {
          const channels = node.children
            .toArray()
            .filter((child) => child.type !== "Operator");
          const hue = ["hsl", "hsla", "hwb"].includes(fn)
            ? 0
            : ["lch", "oklch"].includes(fn)
              ? 2
              : -1;
          channels.forEach((channel, index) => {
            if (
              channel.type === "Function" &&
              [
                "calc",
                "min",
                "max",
                "clamp",
                "round",
                "mod",
                "rem",
                "abs",
                "sign",
                "sin",
                "cos",
                "tan",
                "asin",
                "acos",
                "atan",
                "atan2",
                "pow",
                "sqrt",
                "hypot",
                "log",
                "exp",
              ].includes(ident.decode(channel.name).toLowerCase())
            ) {
              const dimension = mathDimension(
                channel,
                index === hue ? "percentage" : "number",
              );
              if (
                index === hue
                  ? !["number", "angle"].includes(dimension)
                  : dimension !== "number"
              )
                safe = false;
            }
          });
        }
      }

      if (
        property === "color" &&
        node.type === "Function" &&
        [
          "calc",
          "min",
          "max",
          "clamp",
          "round",
          "mod",
          "rem",
          "abs",
          "sign",
          "sin",
          "cos",
          "tan",
          "asin",
          "acos",
          "atan",
          "atan2",
          "pow",
          "sqrt",
          "hypot",
          "log",
          "exp",
        ].includes(ident.decode(node.name).toLowerCase())
      )
        mathDimension(node, "number");
      if (node.type === "Raw" || node.type === "Url") safe = false;
      if (
        node.type === "Function" &&
        ["var", "env", "attr", "url", "paint"].includes(
          ident.decode(node.name).toLowerCase(),
        )
      )
        safe = false;
      if (
        node.type === "Identifier" &&
        (/^(inherit|initial|unset|revert|revert-layer|infinity|-infinity|nan)$/i.test(
          node.name,
        ) ||
          ident.decode(node.name).startsWith("--"))
      )
        safe = false;
    });
    if (!safe || !lexer.matchProperty(property, ast).matched) return false;
    if (
      property === "stroke-width" &&
      !["number", "length"].includes(mathDimension(ast))
    )
      return false;
    if (property === "stroke-width" && ast.type === "Value") {
      const literal = ast.children.first;
      if (
        literal &&
        ["Number", "Dimension", "Percentage"].includes(literal.type) &&
        "value" in literal &&
        Number(literal.value) < 0
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
const name = z.string().regex(/\S/);
const marker = z.enum(["none", "arrow", "bar", "circle", "diamond"]);
export const ConnectionTypeDeclarationSchema = z
  .strictObject({
    extends: name.optional(),
    "stroke-width": z
      .union([
        z.number().finite().nonnegative(),
        z
          .string()
          .refine((v) => css(v, "stroke-width"), "Invalid scalar CSS width"),
      ])
      .optional(),
    "line-style": z.enum(["solid", "dashed", "dotted"]).optional(),
    "line-color": z
      .string()
      .refine((v) => v === "auto" || css(v, "color"), "Invalid CSS colour")
      .optional(),
    "start-marker": marker.optional(),
    "end-marker": marker.optional(),
    text: name.optional(),
    reverse_text: name.optional(),
  })
  .refine(
    (v) => (v.text === undefined) === (v.reverse_text === undefined),
    "Supply both text and reverse_text",
  )
  .meta({
    anyOf: [
      { required: ["text", "reverse_text"] },
      {
        not: {
          anyOf: [{ required: ["text"] }, { required: ["reverse_text"] }],
        },
      },
    ],
  });
export type ConnectionTypeDeclaration = z.infer<
  typeof ConnectionTypeDeclarationSchema
>;
export type ConnectionTypeDeclarations = Record<
  string,
  z.infer<typeof ConnectionTypeDeclarationSchema>
>;
// Zod records intentionally discard __proto__; validate entries without copying
// through an ordinary object's property setter so every exact authored name survives.
export const ConnectionTypeDeclarationsSchema = z
  .any()
  .superRefine((value, ctx) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      ctx.addIssue({
        code: "custom",
        message: "Expected a declaration mapping",
      });
      return;
    }
    for (const [key, declaration] of Object.entries(value)) {
      if (!name.safeParse(key).success)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Type names must be nonblank",
        });
      const result = ConnectionTypeDeclarationSchema.safeParse(declaration);
      if (!result.success)
        for (const issue of result.error.issues)
          ctx.addIssue({ ...issue, path: [key, ...issue.path] });
    }
  })
  .meta({
    type: "object",
    propertyNames: { type: "string", pattern: "\\S" },
    additionalProperties: z.toJSONSchema(ConnectionTypeDeclarationSchema, {
      io: "input",
    }),
  }) as z.ZodType<ConnectionTypeDeclarations>;
export interface VocabularyInput {
  declarations?: ConnectionTypeDeclarations;
  source?: string;
  uri?: string;
  error?: string;
  offset?: number;
}
export const VocabularySchema = z.strictObject({
  connection_types: ConnectionTypeDeclarationsSchema,
});
export function parseVocabulary(source: string, uri?: string): VocabularyInput {
  try {
    const doc = parseDocument(source, { uniqueKeys: true });
    const problem = [...doc.errors, ...doc.warnings][0];
    if (problem)
      return { source, uri, error: problem.message, offset: problem.pos[0] };
    const result = VocabularySchema.safeParse(doc.toJS({ maxAliasCount: 100 }));
    if (!result.success) {
      const issue = result.error.issues[0];
      const ast = doc.getIn(issue.path as (string | number)[], true) as
        | Node
        | undefined;
      return {
        source,
        uri,
        error: issue.message,
        offset: ast?.range?.[0] ?? 0,
      };
    }
    const value = result.data;
    return { source, uri, declarations: value.connection_types };
  } catch (error) {
    return {
      source,
      uri,
      error: error instanceof Error ? error.message : String(error),
      offset: 0,
    };
  }
}
const neutral: ResolvedConnectionType = {
  strokeWidth: 2.5,
  lineStyle: "solid",
  lineColor: "auto",
  startMarker: "none",
  endMarker: "none",
  text: "connected to",
  reverseText: "connected to",
  coreKind: "ordinary",
};
export const builtinVocabulary: Record<string, ResolvedConnectionType> =
  Object.fromEntries(
    [
      ["connected", {}],
      [
        "precedes",
        { endMarker: "arrow", text: "precedes", reverseText: "follows" },
      ],
      [
        "follows",
        { startMarker: "arrow", text: "follows", reverseText: "precedes" },
      ],
      [
        "prevents",
        { endMarker: "bar", text: "prevents", reverseText: "is prevented by" },
      ],
      [
        "optional",
        {
          lineStyle: "dashed",
          text: "optionally connected to",
          reverseText: "optionally connected to",
        },
      ],
      [
        "map_link",
        {
          coreKind: "map_link",
          text: "links to map",
          reverseText: "map linked from",
        },
      ],
      [
        "external_link",
        {
          coreKind: "external_link",
          text: "links to resource",
          reverseText: "resource linked from",
        },
      ],
    ].map(([key, value]) => [key, { ...neutral, ...(value as object) }]),
  ) as Record<string, ResolvedConnectionType>;
export function resolveVocabulary(
  shared: VocabularyInput = {},
  local: ConnectionTypeDeclarations = {},
  localContext: VocabularyInput = {},
): Record<string, ResolvedConnectionType> {
  if (shared.error)
    throw Object.assign(new Error(shared.error), {
      offset: shared.offset ?? 0,
      uri: shared.uri,
      source: shared.source,
    });
  const layers = [
    ConnectionTypeDeclarationsSchema.parse(shared.declarations ?? {}),
    ConnectionTypeDeclarationsSchema.parse(local),
  ];
  const declarations = new Map<string, ConnectionTypeDeclarations[string]>();
  for (const layer of layers)
    for (const [key, value] of Object.entries(layer))
      declarations.set(key, { ...declarations.get(key), ...value });
  const fail = (key: string, message: string): never => {
    const parentIsLocal =
      Object.hasOwn(local, key) &&
      (declarations.get(key)?.extends === undefined ||
        Object.hasOwn(local[key], "extends"));
    const context = parentIsLocal ? localContext : shared;
    const location = context.source
      ? vocabularyLocations(context.source, context.uri)[key]
      : undefined;
    throw Object.assign(new Error(message), {
      uri: context.uri,
      source: context.source,
      offset: location?.parent?.start ?? location?.name.start ?? 0,
    });
  };
  const resolved = new Map<string, ResolvedConnectionType>();
  const visiting = new Set<string>();
  const resolve = (key: string): ResolvedConnectionType => {
    const existing = resolved.get(key);
    if (existing) return existing;
    if (visiting.has(key))
      fail(key, `Connection type inheritance cycle: ${key}`);
    const seed = Object.hasOwn(builtinVocabulary, key)
      ? builtinVocabulary[key]
      : undefined;
    const authored = declarations.get(key);
    if (!seed && !authored) throw new Error(`Unknown connection type: ${key}`);
    if (
      authored?.extends !== undefined &&
      !declarations.has(authored.extends) &&
      !Object.hasOwn(builtinVocabulary, authored.extends)
    )
      fail(key, `Unknown parent connection type: ${authored.extends}`);
    visiting.add(key);
    const base =
      authored?.extends !== undefined
        ? resolve(authored.extends)
        : (seed ?? resolve("connected"));
    if (seed && seed.coreKind !== base.coreKind)
      fail(key, `Cannot change built-in core capability: ${key}`);
    const value = { ...base };
    const fields = {
      "stroke-width": "strokeWidth",
      "line-style": "lineStyle",
      "line-color": "lineColor",
      "start-marker": "startMarker",
      "end-marker": "endMarker",
      text: "text",
      reverse_text: "reverseText",
    } as const;
    for (const [field, target] of Object.entries(fields))
      if (authored && Object.hasOwn(authored, field))
        Object.assign(value, {
          [target]: authored[field as keyof typeof authored],
        });
    visiting.delete(key);
    resolved.set(key, value);
    return value;
  };
  for (const key of new Set([
    ...Object.keys(builtinVocabulary),
    ...declarations.keys(),
  ]))
    resolve(key);
  return Object.fromEntries(resolved);
}

/** Source-only provenance for host hover/diagnostics; never embedded in edges. */
export function vocabularyLocations(
  source: string,
  uri?: string,
): Record<
  string,
  {
    uri?: string;
    name: { start: number; end: number };
    parent?: { start: number; end: number };
  }
> {
  const doc = parseDocument(source);
  const mapping = doc.getIn(["connection_types"], true);
  const entries: [
    string,
    {
      uri?: string;
      name: { start: number; end: number };
      parent?: { start: number; end: number };
    },
  ][] = [];
  if (
    mapping &&
    typeof mapping === "object" &&
    "items" in mapping &&
    Array.isArray(mapping.items)
  )
    for (const pair of mapping.items) {
      if (!pair || typeof pair !== "object" || !("key" in pair)) continue;
      const key = pair.key as Node | undefined;
      if (!key || !("value" in key) || typeof key.value !== "string") continue;
      const parent = doc.getIn(
        ["connection_types", key.value, "extends"],
        true,
      ) as Node | undefined;
      entries.push([
        key.value,
        {
          uri,
          name: { start: key.range?.[0] ?? 0, end: key.range?.[1] ?? 0 },
          ...(parent?.range
            ? { parent: { start: parent.range[0], end: parent.range[1] } }
            : {}),
        },
      ]);
    }
  return Object.fromEntries(entries);
}
