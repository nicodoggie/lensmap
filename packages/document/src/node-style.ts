import * as css from "css-tree";
import { z } from "zod";

export type NodeStyleCondition = { kind: "media" | "container"; query: string };
export type NodeStyleDeclaration = {
  conditions?: NodeStyleCondition[];
  property: string;
  value: string;
  important: boolean;
};
export type NodePresentation = {
  declarations: NodeStyleDeclaration[];
  scale?: number | "auto";
  icon?: string;
  x?: number | "auto";
  y?: number | "auto";
  rules?: NodeStyleDeclaration[];
};
export const NodeStyleSchema = z.union([
  z.string(),
  z.record(z.string(), z.union([z.string(), z.number().finite()])),
]);
export type NodeStyle = z.infer<typeof NodeStyleSchema>;
const properties = new Set([
  "color",
  "background-color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "border",
  "border-color",
  "border-width",
  "border-style",
  "padding",
  ...["top", "right", "bottom", "left"].flatMap((side) => [
    `padding-${side}`,
    `border-${side}`,
    `border-${side}-color`,
    `border-${side}-width`,
    `border-${side}-style`,
  ]),
]);
const functions = new Set([
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
  "color-mix",
  "light-dark",
]);
const sizeFeatures = new Set([
  "width",
  "height",
  "inline-size",
  "block-size",
  "aspect-ratio",
]);
function fail(message: string): never {
  throw new Error(`Node style: ${message}`);
}
const unsafeText = (text: string) =>
  [...text].some(
    (char) => char === "<" || char === ">" || char.charCodeAt(0) < 32,
  );
/** Parse inert declarations only; never return authored stylesheet text. */
export function parseNodeStyle(input: NodeStyle): NodeStyleDeclaration[] {
  const parse = (text: string, conditional = true) => {
    const ast = css.parse(text, {
      context: "declarationList",
      positions: true,
      onParseError: (error) => {
        throw error;
      },
    });
    const out: NodeStyleDeclaration[] = [];
    if (ast.type !== "DeclarationList") return fail("Expected declarations");
    const visit = (
      children: css.List<css.CssNode>,
      conditions: NodeStyleCondition[],
    ) =>
      children.forEach((node) => {
        try {
          if (node.type === "Atrule") {
            if (!conditional)
              fail("Mapping values must contain one declaration value");
            const kind = css.ident.decode(node.name).toLowerCase();
            if (
              (kind !== "media" && kind !== "container") ||
              !node.prelude ||
              node.prelude.type !== "AtrulePrelude" ||
              !node.block
            )
              fail(
                "Only media and unnamed size container blocks are supported",
              );
            if (css.lexer.matchAtrulePrelude(kind, node.prelude).error)
              fail("Invalid condition");
            if (
              kind === "container" &&
              (node.prelude.children.size !== 1 ||
                node.prelude.children.first?.type !== "Condition")
            )
              fail("Only unnamed size container queries are supported");
            css.walk(node.prelude, (token) => {
              if (
                token.type === "Raw" ||
                token.type === "Url" ||
                token.type === "Function" ||
                token.type === "GeneralEnclosed"
              )
                fail("Unsupported condition");
              if (
                kind === "container" &&
                token.type === "Feature" &&
                css.ident.decode(token.name).toLowerCase() !== "orientation" &&
                !sizeFeatures.has(
                  css.ident
                    .decode(token.name)
                    .toLowerCase()
                    .replace(/^(min|max)-/, ""),
                )
              )
                fail("Only size container features are supported");
              if (kind === "container" && token.type === "FeatureRange") {
                const identifiers = [
                  token.left,
                  token.middle,
                  token.right,
                ].filter((t) => t?.type === "Identifier");
                if (
                  identifiers.some(
                    (t) =>
                      t?.type === "Identifier" &&
                      !sizeFeatures.has(css.ident.decode(t.name).toLowerCase()),
                  )
                )
                  fail("Only size container features are supported");
              }
            });
            const query = text
              .slice(
                node.prelude.loc?.start.offset,
                node.prelude.loc?.end.offset,
              )
              .trim();
            visit(node.block.children, [...conditions, { kind, query }]);
            return;
          }

          if (node.type !== "Declaration")
            fail("Only declarations are supported");
          const decodedProperty = css.ident.decode(node.property);
          const property = decodedProperty.startsWith("--")
            ? decodedProperty
            : decodedProperty.toLowerCase();
          if (
            !properties.has(property) &&
            property !== "--lensmap-scale" &&
            property !== "--lensmap-icon" &&
            property !== "--lensmap-x" &&
            property !== "--lensmap-y"
          )
            fail(`Unsupported property ${property}`);
          const valueText = css.generate(node.value).trim();
          const value = css.parse(valueText, {
            context: "value",
            onParseError: (error) => {
              throw error;
            },
          });
          css.walk(value, (token) => {
            if (
              token.type === "Raw" ||
              token.type === "Url" ||
              (token.type === "Function" &&
                !functions.has(css.ident.decode(token.name).toLowerCase()))
            )
              fail(`Unsafe or unsupported value for ${property}`);
            if (token.type === "String" && unsafeText(token.value))
              fail("Unsafe text");
            if (
              token.type === "Identifier" &&
              /^(inherit|initial|unset|revert|revert-layer|infinity|-infinity|nan)$/i.test(
                css.ident.decode(token.name),
              )
            )
              fail("CSS-wide keywords are unsupported");
            if (
              (token.type === "Number" ||
                token.type === "Dimension" ||
                token.type === "Percentage") &&
              !Number.isFinite(Number(token.value))
            )
              fail("Lengths and numbers must be finite");
          });
          if (
            ["--lensmap-scale", "--lensmap-x", "--lensmap-y"].includes(property)
          ) {
            const scalar =
              value.type === "Value" ? value.children.first : undefined;
            if (
              valueText !== "auto" &&
              (value.type !== "Value" ||
                value.children.size !== 1 ||
                scalar?.type !== "Number" ||
                !Number.isFinite(Number(scalar.value)) ||
                (property === "--lensmap-scale" && Number(scalar.value) <= 0))
            )
              fail(
                property === "--lensmap-scale"
                  ? "Scale must be positive or auto"
                  : "Coordinate must be a finite unitless number or auto",
              );
          } else if (property === "--lensmap-icon") {
            if (
              value.type !== "Value" ||
              value.children.size !== 1 ||
              value.children.first?.type !== "String"
            )
              fail("Icon must be a CSS string");
            const first =
              value.type === "Value" ? value.children.first : undefined;
            if (first?.type === "String" && unsafeText(first.value))
              fail("Unsafe icon text");
          } else if (css.lexer.matchProperty(property, value).error)
            fail(`Invalid value for ${property}`);
          out.push({
            ...(conditions.length ? { conditions } : {}),
            property,
            value: valueText,
            important: Boolean(node.important),
          });
        } catch (error) {
          const failure =
            error instanceof Error ? error : new Error(String(error));
          if (!("styleOffset" in failure))
            Object.assign(failure, {
              styleOffset: node.loc?.start.offset,
              styleEndOffset: node.loc
                ? node.loc.end.offset -
                  (text.slice(node.loc.start.offset, node.loc.end.offset)
                    .length -
                    text
                      .slice(node.loc.start.offset, node.loc.end.offset)
                      .trimEnd().length)
                : undefined,
            });
          throw failure;
        }
      });
    visit(ast.children, []);
    return out;
  };
  if (typeof input === "string") return parse(input);
  return Object.entries(input).flatMap(([property, value]) => {
    try {
      if (!/^(?:--lensmap-(?:scale|icon|x|y)|[a-z-]+)$/i.test(property))
        return fail(`Invalid property ${property}`);
      const text =
        property === "--lensmap-icon"
          ? css.generate({ type: "String", value: String(value) })
          : String(value);
      const declarations = parse(`${property}:${text}`, false);
      if (
        declarations.length !== 1 ||
        declarations[0].property !==
          (property.startsWith("--") ? property : property.toLowerCase())
      )
        fail("Mapping values must contain one declaration value");
      return declarations;
    } catch (error) {
      throw Object.assign(
        error instanceof Error ? error : new Error(String(error)),
        { styleProperty: property },
      );
    }
  });
}
/** Low-to-high cascade order preserves shorthand interactions for browser application. */
export function resolveNodeStyle(
  classes: string[] | undefined,
  inline: NodeStyle | undefined,
  rules: Map<string, NodeStyleDeclaration[]>,
): NodePresentation | undefined {
  for (const name of classes ?? [])
    if (!rules.has(name)) fail(`Unknown class ${name}`);
  const selected = new Set(classes);
  const declarations = [...rules]
    .filter(([name]) => selected.has(name))
    .flatMap(([, values]) => values);
  declarations.push(...(inline === undefined ? [] : parseNodeStyle(inline)));
  return resolveNodePresentation(declarations);
}
/** Resolve a validated program without selecting a browser environment. */
export function resolveNodePresentation(
  program: readonly NodeStyleDeclaration[],
  matches?: (condition: NodeStyleCondition) => boolean,
): NodePresentation | undefined {
  const conditional = program.some((d) => d.conditions?.length);
  const declarations = program.filter(
    (d) => !d.conditions?.length || (matches && d.conditions.every(matches)),
  );
  declarations.sort((a, b) => Number(a.important) - Number(b.important));
  if (!declarations.length && !conditional) return undefined;
  const presentation: NodePresentation = {
    declarations: [],
    ...(conditional ? { rules: [...program] } : {}),
  };
  for (const declaration of declarations) {
    if (declaration.property === "--lensmap-scale")
      presentation.scale =
        declaration.value === "auto" ? "auto" : Number(declaration.value);
    else if (
      declaration.property === "--lensmap-x" ||
      declaration.property === "--lensmap-y"
    )
      presentation[declaration.property === "--lensmap-x" ? "x" : "y"] =
        declaration.value === "auto" ? "auto" : Number(declaration.value);
    else if (declaration.property === "--lensmap-icon") {
      const value = css.parse(declaration.value, { context: "value" });
      if (value.type === "Value" && value.children.first?.type === "String")
        presentation.icon = value.children.first.value;
    } else {
      const { conditions: _conditions, ...standard } = declaration;
      presentation.declarations.push(standard);
    }
  }
  return presentation;
}
