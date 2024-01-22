import { encodePageRef, parsePageRef } from "$sb/lib/page.ts";
import { assertEquals } from "../../test_deps.ts";

Deno.test("Page utility functions", () => {
  // Base cases
  assertEquals(parsePageRef("foo"), { page: "foo" });
  assertEquals(parsePageRef("[[foo]]"), { page: "foo" });
  assertEquals(parsePageRef("foo@1"), { page: "foo", pos: 1 });
  assertEquals(parsePageRef("foo$bar"), { page: "foo", anchor: "bar" });
  assertEquals(parsePageRef("foo$bar@1"), {
    page: "foo",
    anchor: "bar",
    pos: 1,
  });

  // Edge cases
  assertEquals(parsePageRef(""), { page: "" });
  assertEquals(parsePageRef("user@domain.com"), { page: "user@domain.com" });

  // Encoding
  assertEquals(encodePageRef({ page: "foo" }), "foo");
  assertEquals(encodePageRef({ page: "foo", pos: 10 }), "foo@10");
  assertEquals(encodePageRef({ page: "foo", anchor: "bar" }), "foo$bar");
});
