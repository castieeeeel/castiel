import { syscall } from "./syscall.ts";
import { FilterOption } from "../../common/types.ts";

export function getCurrentPage(): Promise<string> {
  return syscall("editor.getCurrentPage");
}

export function setPage(newName: string): Promise<void> {
  return syscall("editor.setPage", newName);
}

export function getText(): Promise<string> {
  return syscall("editor.getText");
}

export function getCursor(): Promise<number> {
  return syscall("editor.getCursor");
}

export function getSelection(): Promise<{ from: number; to: number }> {
  return syscall("editor.getSelection");
}

export function setSelection(from: number, to: number): Promise<void> {
  return syscall("editor.setSelection", from, to);
}

export function save(): Promise<void> {
  return syscall("editor.save");
}

export function navigate(
  name: string,
  pos?: string | number,
  replaceState = false,
): Promise<void> {
  return syscall("editor.navigate", name, pos, replaceState);
}

export function reloadPage(): Promise<void> {
  return syscall("editor.reloadPage");
}

export function openUrl(url: string): Promise<void> {
  return syscall("editor.openUrl", url);
}

export function flashNotification(
  message: string,
  type: "info" | "error" = "info",
): Promise<void> {
  return syscall("editor.flashNotification", message, type);
}

export function filterBox(
  label: string,
  options: FilterOption[],
  helpText = "",
  placeHolder = "",
): Promise<FilterOption | undefined> {
  return syscall("editor.filterBox", label, options, helpText, placeHolder);
}

export function showPanel(
  id: "lhs" | "rhs" | "bhs" | "modal",
  mode: number,
  html: string,
  script = "",
): Promise<void> {
  return syscall("editor.showPanel", id, mode, html, script);
}

export function hidePanel(id: "lhs" | "rhs" | "bhs" | "modal"): Promise<void> {
  return syscall("editor.hidePanel", id);
}

export function insertAtPos(text: string, pos: number): Promise<void> {
  return syscall("editor.insertAtPos", text, pos);
}

export function replaceRange(
  from: number,
  to: number,
  text: string,
): Promise<void> {
  return syscall("editor.replaceRange", from, to, text);
}

export function moveCursor(pos: number): Promise<void> {
  return syscall("editor.moveCursor", pos);
}

export function insertAtCursor(text: string): Promise<void> {
  return syscall("editor.insertAtCursor", text);
}

export function matchBefore(
  re: string,
): Promise<{ from: number; to: number; text: string } | null> {
  return syscall("editor.matchBefore", re);
}

export function dispatch(change: any): Promise<void> {
  return syscall("editor.dispatch", change);
}

export function prompt(
  message: string,
  defaultValue = "",
): Promise<string | undefined> {
  return syscall("editor.prompt", message, defaultValue);
}

export function enableReadOnlyMode(enabled: boolean) {
  return syscall("editor.enableReadOnlyMode", enabled);
}

// DEPRECATED in favor of showPanel and hidePanel

export function showRhs(
  html: string,
  script?: string,
  flex = 1,
): Promise<void> {
  return syscall("editor.showRhs", html, script, flex);
}

export function hideRhs(): Promise<void> {
  return syscall("editor.hideRhs");
}

export function showLhs(
  html: string,
  script?: string,
  flex = 1,
): Promise<void> {
  return syscall("editor.showLhs", html, script, flex);
}

export function hideLhs(): Promise<void> {
  return syscall("editor.hideLhs");
}

export function showBhs(
  html: string,
  script?: string,
  flex = 1,
): Promise<void> {
  return syscall("editor.showBhs", html, script, flex);
}

export function hideBhs(): Promise<void> {
  return syscall("editor.hideBhs");
}

// End deprecation
