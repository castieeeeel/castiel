import { removeDirectiveBody, SpaceSync, SyncStatusItem } from "./sync.ts";
import { DiskSpacePrimitives } from "./disk_space_primitives.ts";
import { assertEquals } from "../../test_deps.ts";

Deno.test("Test store", async () => {
  const primaryPath = await Deno.makeTempDir();
  const secondaryPath = await Deno.makeTempDir();
  console.log("Primary", primaryPath);
  console.log("Secondary", secondaryPath);
  const primary = new DiskSpacePrimitives(primaryPath);
  const secondary = new DiskSpacePrimitives(secondaryPath);
  const statusMap = new Map<string, SyncStatusItem>();
  const sync = new SpaceSync(primary, secondary, statusMap);

  // Write one page to primary
  await primary.writeFile("index", "utf8", "Hello");
  assertEquals((await secondary.fetchFileList()).length, 0);
  console.log("Initial sync ops", await doSync());

  assertEquals((await secondary.fetchFileList()).length, 1);
  assertEquals((await secondary.readFile("index", "utf8")).data, "Hello");

  // Should be a no-op
  assertEquals(await doSync(), 0);

  // Now let's make a change on the secondary
  await secondary.writeFile("index", "utf8", "Hello!!");
  await secondary.writeFile("test", "utf8", "Test page");

  // And sync it
  await doSync();

  assertEquals((await primary.fetchFileList()).length, 2);
  assertEquals((await secondary.fetchFileList()).length, 2);

  assertEquals((await primary.readFile("index", "utf8")).data, "Hello!!");

  // Let's make some random edits on both ends
  await primary.writeFile("index", "utf8", "1");
  await primary.writeFile("index2", "utf8", "2");
  await secondary.writeFile("index3", "utf8", "3");
  await secondary.writeFile("index4", "utf8", "4");
  await doSync();

  assertEquals((await primary.fetchFileList()).length, 5);
  assertEquals((await secondary.fetchFileList()).length, 5);

  assertEquals(await doSync(), 0);

  console.log("Deleting pages");
  // Delete some pages
  await primary.deleteFile("index");
  await primary.deleteFile("index3");

  await doSync();

  assertEquals((await primary.fetchFileList()).length, 3);
  assertEquals((await secondary.fetchFileList()).length, 3);

  // No-op
  assertEquals(await doSync(), 0);

  await secondary.deleteFile("index4");
  await primary.deleteFile("index2");

  await doSync();

  // Just "test" left
  assertEquals((await primary.fetchFileList()).length, 1);
  assertEquals((await secondary.fetchFileList()).length, 1);

  // No-op
  assertEquals(await doSync(), 0);

  await secondary.writeFile("index", "utf8", "I'm back");

  await doSync();

  assertEquals((await primary.readFile("index", "utf8")).data, "I'm back");

  // Cause a conflict
  console.log("Introducing a conflict now");
  await primary.writeFile("index", "utf8", "Hello 1");
  await secondary.writeFile("index", "utf8", "Hello 2");

  await doSync();

  // Sync conflicting copy back
  await doSync();

  // Verify that primary won
  assertEquals((await primary.readFile("index", "utf8")).data, "Hello 1");
  assertEquals((await secondary.readFile("index", "utf8")).data, "Hello 1");

  // test + index + index.conflicting copy
  assertEquals((await primary.fetchFileList()).length, 3);
  assertEquals((await secondary.fetchFileList()).length, 3);

  // Introducing a fake conflict (same content, so not really conflicting)
  await primary.writeFile("index", "utf8", "Hello 1");
  await secondary.writeFile("index", "utf8", "Hello 1");

  // And two more files with different bodies, but only within a query directive — shouldn't conflict
  await primary.writeFile(
    "index.md",
    "utf8",
    "Hello\n<!-- #query page -->\nHello 1\n<!-- /query -->",
  );
  await secondary.writeFile(
    "index.md",
    "utf8",
    "Hello\n<!-- #query page -->\nHello 2\n<!-- /query -->",
  );

  await doSync();
  await doSync();

  // test + index + index.md + previous index.conflicting copy but nothing more
  assertEquals((await primary.fetchFileList()).length, 4);

  console.log("Bringing a third device in the mix");

  const ternaryPath = await Deno.makeTempDir();

  console.log("Ternary", ternaryPath);

  const ternary = new DiskSpacePrimitives(ternaryPath);
  const sync2 = new SpaceSync(
    secondary,
    ternary,
    new Map<string, SyncStatusItem>(),
  );
  console.log(
    "N ops",
    await sync2.syncFiles(SpaceSync.primaryConflictResolver),
  );
  await sleep(2);
  assertEquals(await sync2.syncFiles(SpaceSync.primaryConflictResolver), 0);

  await Deno.remove(primaryPath, { recursive: true });
  await Deno.remove(secondaryPath, { recursive: true });
  await Deno.remove(ternaryPath, { recursive: true });

  async function doSync() {
    await sleep();
    const r = await sync.syncFiles(
      SpaceSync.primaryConflictResolver,
    );
    await sleep();
    return r;
  }
});

function sleep(ms = 10): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

Deno.test("Remove directive bodies", () => {
  assertEquals(
    removeDirectiveBody(`<!-- #query page -->
This is a body
bla bla bla
<!-- /query -->
Hello
<!-- #include [[test]] -->
This is a body
<!-- /include -->
`),
    `<!-- #query page -->
<!-- /query -->
Hello
<!-- #include [[test]] -->
<!-- /include -->
`,
  );
});
