import * as css from "css-tree";
import { z } from "zod";

export type NodeStyleDeclaration = {
  property: string;
  value: string;
  important: boolean;
};
export type NodePresentation = {
  declarations: NodeStyleDeclaration[];
  scale?: number | "auto";
  icon?: string;
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
function fail(message: string): never {
  throw new Error(`Node style: ${message}`);
}
const unsafeText = (text: string) =>
  [...text].some(
    (char) => char === "<" || char === ">" || char.charCodeAt(0) < 32,
  );
/** Parse inert declarations only; never return authored stylesheet text. */
export function parseNodeStyle(input: NodeStyle): NodeStyleDeclaration[] {
  const parse = (text: string) => {
    const ast = css.parse(text, {
      context: "declarationList",
      onParseError: (error) => {
        throw error;
      },
    });
    const out: NodeStyleDeclaration[] = [];
    if (ast.type !== "DeclarationList") return fail("Expected declarations");
    ast.children.forEach((node) => {
      if (node.type !== "Declaration") fail("Only declarations are supported");
      const decodedProperty = css.ident.decode(node.property);
      const property = decodedProperty.startsWith("--")
        ? decodedProperty
        : decodedProperty.toLowerCase();
      if (
        !properties.has(property) &&
        property !== "--lensmap-scale" &&
        property !== "--lensmap-icon"
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
      if (property === "--lensmap-scale") {
        const scalar =
          value.type === "Value" ? value.children.first : undefined;
        if (
          valueText !== "auto" &&
          (value.type !== "Value" ||
            value.children.size !== 1 ||
            scalar?.type !== "Number" ||
            !Number.isFinite(Number(scalar.value)) ||
            Number(scalar.value) <= 0)
        )
          fail("Scale must be positive or auto");
      } else if (property === "--lensmap-icon") {
        if (
          value.type !== "Value" ||
          value.children.size !== 1 ||
          value.children.first?.type !== "String"
        )
          fail("Icon must be a CSS string");
        const first = value.type === "Value" ? value.children.first : undefined;
        if (first?.type === "String" && unsafeText(first.value))
          fail("Unsafe icon text");
      } else if (css.lexer.matchProperty(property, value).error)
        fail(`Invalid value for ${property}`);
      out.push({
        property,
        value: valueText,
        important: Boolean(node.important),
      });
    });
    return out;
  };
  if (typeof input === "string") return parse(input);
  return Object.entries(input).flatMap(([property, value]) => {
    if (!/^(?:--lensmap-(?:scale|icon)|[a-z-]+)$/i.test(property))
      return fail(`Invalid property ${property}`);
    const text =
      property === "--lensmap-icon"
        ? css.generate({ type: "String", value: String(value) })
        : String(value);
    const declarations = parse(`${property}:${text}`);
    if (
      declarations.length !== 1 ||
      declarations[0].property !==
        (property.startsWith("--") ? property : property.toLowerCase())
    )
      fail("Mapping values must contain one declaration value");
    return declarations;
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
  declarations.sort((a, b) => Number(a.important) - Number(b.important));
  if (!declarations.length) return undefined;
  const presentation: NodePresentation = { declarations: [] };
  for (const declaration of declarations) {
    if (declaration.property === "--lensmap-scale")
      presentation.scale =
        declaration.value === "auto" ? "auto" : Number(declaration.value);
    else if (declaration.property === "--lensmap-icon") {
      const value = css.parse(declaration.value, { context: "value" });
      if (value.type === "Value" && value.children.first?.type === "String")
        presentation.icon = value.children.first.value;
    } else presentation.declarations.push(declaration);
  }
  return presentation;
}
