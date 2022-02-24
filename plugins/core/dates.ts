import { syscall } from "./lib/syscall.ts";

export async function insertToday() {
  let niceDate = new Date().toISOString().split("T")[0];
  await syscall("editor.insertAtCursor", niceDate);
}
