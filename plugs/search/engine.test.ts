import { KV, KvKey } from "$sb/types.ts";
import { assertEquals } from "../../test_deps.ts";
import { BatchKVStore, SimpleSearchEngine } from "./engine.ts";

class InMemoryBatchKVStore implements BatchKVStore {
  private store = new Map<string, any>();

  query({ prefix }: { prefix: KvKey }): Promise<KV[]> {
    const results: KV[] = [];
    entries:
    for (const [key, value] of this.store.entries()) {
      const parsedKey: string[] = JSON.parse(key);
      for (let i = 0; i < prefix.length; i++) {
        if (prefix[i] !== parsedKey[i]) {
          continue entries;
        }
      }
      results.push({ key: parsedKey, value });
    }
    return Promise.resolve(results);
  }

  batchSet(kvs: KV[]): Promise<void> {
    for (const { key, value } of kvs) {
      this.store.set(JSON.stringify(key), value);
    }
    return Promise.resolve();
  }

  batchDel(keys: KvKey[]): Promise<void> {
    for (const key of keys) {
      this.store.delete(JSON.stringify(key));
    }
    return Promise.resolve();
  }
}

Deno.test("Test full text search", async () => {
  const engine = new SimpleSearchEngine(new InMemoryBatchKVStore());

  await engine.indexDocument({ id: "1", text: "The quick brown fox" });
  await engine.indexDocument({ id: "2", text: "jumps over the lazy dogs" });
  await engine.indexDocument({
    id: "3",
    text: "Hello world, jumping jump jumps",
  });
  await engine.indexDocument({ id: "4", text: "TypeScript is awesome" });
  await engine.indexDocument({ id: "5", text: "The brown dogs jumps zęf" });

  console.log(engine.index);

  const results = await engine.search("Brown fox");
  console.log(results);
  assertEquals(results.length, 2);
  assertEquals(results[0].id, "1");
  assertEquals(results[0].score, 2);
  assertEquals(results[1].id, "5");
  assertEquals(results[1].score, 1);

  const results2 = await engine.search("jump");
  console.log(results2);
  assertEquals(results2.length, 3);

  await engine.deleteDocument("3");
  const results3 = await engine.search("jump");
  console.log(results3);
  assertEquals(results3.length, 2);

  const results4 = await engine.search("zęf");
  console.log(results4);
  assertEquals(results4.length, 1);
});
