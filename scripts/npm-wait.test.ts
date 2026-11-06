import assert from "node:assert/strict";
import { test } from "node:test";
import { waitForPublished } from "./npm-wait.ts";

test("waits for registry processing without retrying a publication", async () => {
  let reads = 0;
  let waits = 0;
  await waitForPublished("@lensmap/document", "0.1.1", "sha512-expected", {
    read: () => (++reads < 3 ? undefined : "sha512-expected"),
    wait: async () => {
      waits++;
    },
    log: () => {},
  });
  assert.equal(reads, 3);
  assert.equal(waits, 2);
});

test("rejects a different immutable artifact immediately", async () => {
  await assert.rejects(
    waitForPublished("@lensmap/document", "0.1.1", "sha512-expected", {
      read: () => "sha512-other",
      wait: async () => {
        assert.fail("Integrity mismatches are not processing delays.");
      },
      log: () => {},
    }),
    /different artifact/,
  );
});

test("stops bounded missing-version readback and does not conceal other failures", async () => {
  let reads = 0;
  await assert.rejects(
    waitForPublished("@lensmap/document", "0.1.1", "sha512-expected", {
      read: () => {
        reads++;
        return undefined;
      },
      wait: async () => {},
      log: () => {},
    }),
    /not available/,
  );
  assert.equal(reads, 60);
  await assert.rejects(
    waitForPublished("@lensmap/document", "0.1.1", "sha512-expected", {
      read: () => {
        throw Error("authentication failed");
      },
      wait: async () => {
        assert.fail("Authentication failures must not be retried.");
      },
      log: () => {},
    }),
    /authentication failed/,
  );
});
