export * from "../common/deps.ts";

export {
  Fragment,
  h,
  render as preactRender,
} from "https://esm.sh/preact@10.11.1";
export type { ComponentChildren } from "https://esm.sh/preact@10.11.1";
export {
  useEffect,
  useReducer,
  useRef,
  useState,
} from "https://esm.sh/preact@10.11.1/hooks";

export {
  Book as BookIcon,
  Home as HomeIcon,
  Moon as MoonIcon,
  Sun as SunIcon,
  Terminal as TerminalIcon,
} from "https://esm.sh/preact-feather@4.2.1";

// Y collab
export * as Y from "yjs";
export {
  yCollab,
  yUndoManagerKeymap,
} from "https://esm.sh/y-codemirror.next@0.3.2?external=yjs,@codemirror/state,@codemirror/commands,@codemirror/history,@codemirror/view";
export { WebsocketProvider } from "https://esm.sh/y-websocket@1.4.5?external=yjs";
