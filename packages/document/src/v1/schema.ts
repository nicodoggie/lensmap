import { z } from "zod";

/** Experimental v1 subset. Fields may be added or refined before v1 stabilizes. */
export const PositionSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite(),
});
const IdSchema = z.string().regex(/\S/, "An ID must not be empty.");
export const ReferenceSchema = z.strictObject({ node_id: IdSchema });

const NodeContentSchema = z.strictObject({
  id: IdSchema.optional(),
  summary: z.string().nullable().optional(),
  full_text: z.string().nullable().optional(),
  position: PositionSchema.optional(),
});

export type Reference = z.infer<typeof ReferenceSchema>;
export type RichNode = z.infer<typeof NodeContentSchema> & {
  connections?: Connection[];
};
export type Connection = string | RichNode | Reference | Connection[];

export const RichNodeSchema: z.ZodType<RichNode> = z.lazy(() =>
  z.union([
    NodeContentSchema.extend({
      summary: z.string().nullable(),
      connections: z.array(ConnectionSchema).optional(),
    }),
    NodeContentSchema.extend({
      full_text: z.string().nullable(),
      connections: z.array(ConnectionSchema).optional(),
    }),
  ]),
);

export const ConnectionSchema: z.ZodType<Connection> = z.lazy(() =>
  z.union([
    z.string(),
    ReferenceSchema,
    RichNodeSchema,
    z.array(ConnectionSchema),
  ]),
);
export const NodeSchema = z.union([z.string(), RichNodeSchema]);
export const DocumentSchema = z.strictObject({
  version: z.literal("v1"),
  nodes: z.array(NodeSchema),
});
export type LensmapDocument = z.infer<typeof DocumentSchema>;
