import { z } from "zod";

/** Experimental v1 subset. Fields may be added or refined before v1 stabilizes. */
export const PositionSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite(),
});
const IdSchema = z.string().regex(/\S/, "An ID must not be empty.");
export const ConnectionTypeSchema = z.enum([
  "connected",
  "precedes",
  "follows",
  "prevents",
  "optional",
  "external_link",
  "map_link",
]);
export type ConnectionType = z.infer<typeof ConnectionTypeSchema>;
const LocalTypeSchema = z.enum([
  "connected",
  "precedes",
  "follows",
  "prevents",
  "optional",
]);
export const ReferenceSchema = z.strictObject({
  node_id: IdSchema,
  type: ConnectionTypeSchema.optional(),
});

const NodeContentSchema = z.strictObject({
  id: IdSchema.optional(),
  summary: z.string().nullable().optional(),
  full_text: z.string().nullable().optional(),
  position: PositionSchema.optional(),
});

export type Reference = z.infer<typeof ReferenceSchema>;
export type RichNode = z.infer<typeof NodeContentSchema> & {
  connections?: Connection[];
  type?: ConnectionType;
  url?: string;
};
export type Connection = string | RichNode | Reference | Connection[];

const ordinary = (typed: boolean) => {
  const base = typed
    ? NodeContentSchema.extend({ type: LocalTypeSchema.optional() })
    : NodeContentSchema;
  return z.union([
    base.extend({
      summary: z.string().nullable(),
      connections: z.array(ConnectionSchema).optional(),
    }),
    base.extend({
      full_text: z.string().nullable(),
      connections: z.array(ConnectionSchema).optional(),
    }),
  ]);
};
const portal = () =>
  NodeContentSchema.extend({
    type: z.enum(["map_link", "external_link"]),
    url: z.string().regex(/\S/, "A portal URL must not be blank."),
    connections: z.array(ConnectionSchema).optional(),
  });
export const RichNodeSchema: z.ZodType<RichNode> = z.lazy(() =>
  z.union([ordinary(true), portal()]),
);
const RootNodeSchema: z.ZodType<RichNode> = z.lazy(() =>
  z.union([ordinary(false), portal()]),
);

export const ConnectionSchema: z.ZodType<Connection> = z.lazy(() =>
  z.union([
    z.string(),
    ReferenceSchema,
    RichNodeSchema,
    z.array(ConnectionSchema),
  ]),
);
export const NodeSchema = z.union([z.string(), RootNodeSchema]);
export const DocumentSchema = z.strictObject({
  version: z.literal("v1"),
  frontmatter: z.record(z.string(), z.unknown()).optional(),
  nodes: z.array(NodeSchema),
});
export type LensmapDocument = z.infer<typeof DocumentSchema>;
