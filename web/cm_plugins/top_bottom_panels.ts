import { Decoration, EditorState } from "../deps.ts";
import type { Client } from "../client.ts";
import { decoratorStateField } from "./util.ts";
import { MarkdownWidget } from "./markdown_widget.ts";

export function postScriptPrefacePlugin(
  editor: Client,
) {
  const panelWidgetHook = editor.system.panelWidgetHook;
  return decoratorStateField((state: EditorState) => {
    const widgets: any[] = [];
    const topCallback = panelWidgetHook.callbacks.get("top");
    if (topCallback) {
      widgets.push(
        Decoration.widget({
          widget: new MarkdownWidget(
            undefined,
            editor,
            `top:${editor.currentPage}`,
            "",
            topCallback,
            "sb-markdown-top-widget",
          ),
          side: -1,
          block: true,
        }).range(0),
      );
    }
    const bottomCallback = panelWidgetHook.callbacks.get("bottom");
    if (bottomCallback) {
      widgets.push(
        Decoration.widget({
          widget: new MarkdownWidget(
            undefined,
            editor,
            `bottom:${editor.currentPage}`,
            "",
            bottomCallback,
            "sb-markdown-bottom-widget",
          ),
          side: 1,
          block: true,
        }).range(state.doc.length),
      );
    }
    return Decoration.set(widgets);
  });
}
