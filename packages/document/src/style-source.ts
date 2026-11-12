import { CST, type Scalar } from "yaml";

/** Map decoded CSS offsets through the maintained YAML scalar decoder.
 * Inserting a marker is accepted only when removing it restores the exact value;
 * quoting, escapes, folding and indentation therefore cannot silently shift it.
 * This runs only for a failed style, and stops once both boundaries are found.
 */
export function styleSourceSpan(scalar: Scalar, start: number, end: number) {
  const token = scalar.srcToken;
  if (!token || !CST.isScalar(token) || typeof scalar.value !== "string")
    return undefined;
  const marker = "\uE000";
  if (scalar.value.includes(marker)) return undefined;
  const base =
    token.type === "block-scalar"
      ? token.offset +
        token.props.reduce(
          (n, prop) => n + ("source" in prop ? prop.source.length : 0),
          0,
        )
      : token.offset;
  const decodedOffset = (i: number) => {
    let invalid = false;
    const decoded = CST.resolveAsScalar(
      {
        ...token,
        source: token.source.slice(0, i) + marker + token.source.slice(i),
      },
      false,
      () => {
        invalid = true;
      },
    );
    if (invalid || !decoded) return undefined;
    const at = decoded.value.indexOf(marker);
    return at >= 0 &&
      decoded.value.slice(0, at) + decoded.value.slice(at + 1) === scalar.value
      ? at
      : undefined;
  };
  // Valid insertion boundaries preserve order, including across folded lines.
  const boundary = (target: number) => {
    let low = 0;
    let high = token.source.length;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      let candidate = middle;
      let at = decodedOffset(candidate);
      while (at === undefined && candidate < high)
        at = decodedOffset(++candidate);
      if (at === undefined) {
        high = middle - 1;
        continue;
      }
      if (at === target) return base + candidate;
      if (at < target) low = candidate + 1;
      else high = middle - 1;
    }
    return undefined;
  };
  const offset = boundary(start);
  const endOffset = boundary(end);
  return offset === undefined || endOffset === undefined
    ? undefined
    : { offset, endOffset };
}
