import { describe, expect, it } from "vitest";
import { connectionAppearance } from "./connection-appearance";

describe("connection appearance", () => {
  it("uses only relationship metadata for markers and dashes", () => {
    expect(connectionAppearance()).toEqual({ dashed: false });
    expect(connectionAppearance("connected")).toEqual({ dashed: false });
    expect(connectionAppearance("optional")).toEqual({ dashed: true });
    expect(connectionAppearance("precedes")).toEqual({
      dashed: false,
      end: "arrow",
    });
    expect(connectionAppearance("follows")).toEqual({
      dashed: false,
      start: "arrow",
    });
    expect(connectionAppearance("prevents")).toEqual({
      dashed: false,
      end: "bar",
    });
    expect(connectionAppearance("map_link")).toEqual({ dashed: false });
    expect(connectionAppearance("external_link")).toEqual({ dashed: false });
  });
  it("never marks the cut end of a continuation", () => {
    expect(connectionAppearance("precedes", "outgoing")).toEqual({
      dashed: false,
    });
    expect(connectionAppearance("follows", "incoming")).toEqual({
      dashed: false,
    });
    expect(connectionAppearance("prevents", "incoming").end).toBe("bar");
    expect(connectionAppearance("follows", "outgoing").start).toBe("arrow");
  });
});
