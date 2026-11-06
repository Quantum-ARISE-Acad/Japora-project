import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { personalizeBroadcastMessage } from "../src/lib/broadcast";

describe("broadcast message personalization", () => {
  test("replaces name, store, and product when values are available", () => {
    assert.equal(
      personalizeBroadcastMessage("Hi {{name}}, {{product}} is at {{store}}", {
        name: "Ada",
        store: "Ada Shop",
        product: "Ankara dress",
      }),
      "Hi Ada, Ankara dress is at Ada Shop",
    );
  });

  test("uses known customer and store values and removes unknown product placeholders", () => {
    assert.equal(
      personalizeBroadcastMessage("Hi {{name}}, visit {{store}} for {{product}}", {
        name: "Ada",
        store: "Ada Shop",
      }),
      "Hi Ada, visit Ada Shop for",
    );
  });

  test("removes every supported placeholder when its value is unavailable", () => {
    const result = personalizeBroadcastMessage(
      "Hi {{name}} {{product}} at {{store}}",
      { name: " ", product: null, store: undefined },
    );

    assert.equal(result, "Hi at");
    assert.doesNotMatch(result, /\{\{\s*(name|store|product)\s*\}\}/i);
  });
});
