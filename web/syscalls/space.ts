import { Editor } from "../editor.tsx";
import { SysCallMapping } from "../../plugos/system.ts";
import { AttachmentMeta, PageMeta } from "../../common/types.ts";
import {
  FileData,
  FileEncoding,
} from "../../common/spaces/space_primitives.ts";

export function spaceSyscalls(editor: Editor): SysCallMapping {
  return {
    "space.listPages": (): PageMeta[] => {
      return [...editor.space.listPages()];
    },
    "space.readPage": async (
      _ctx,
      name: string,
    ): Promise<{ text: string; meta: PageMeta }> => {
      return await editor.space.readPage(name);
    },
    "space.getPageMeta": async (_ctx, name: string): Promise<PageMeta> => {
      return await editor.space.getPageMeta(name);
    },
    "space.writePage": async (
      _ctx,
      name: string,
      text: string,
    ): Promise<PageMeta> => {
      return await editor.space.writePage(name, text);
    },
    "space.deletePage": async (_ctx, name: string) => {
      // If we're deleting the current page, navigate to the index page
      if (editor.currentPage === name) {
        await editor.navigate("");
      }
      // Remove page from open pages in editor
      editor.openPages.delete(name);
      console.log("Deleting page");
      await editor.space.deletePage(name);
    },
    "space.listPlugs": (): Promise<string[]> => {
      return editor.space.listPlugs();
    },
    "space.listAttachments": (): Promise<AttachmentMeta[]> => {
      return editor.space.fetchAttachmentList();
    },
    "space.readAttachment": async (
      _ctx,
      name: string,
    ): Promise<{ data: FileData; meta: AttachmentMeta }> => {
      return await editor.space.readAttachment(name, "dataurl");
    },
    "space.getAttachmentMeta": async (
      _ctx,
      name: string,
    ): Promise<AttachmentMeta> => {
      return await editor.space.getAttachmentMeta(name);
    },
    "space.writeAttachment": async (
      _ctx,
      name: string,
      encoding: FileEncoding,
      data: FileData,
    ): Promise<AttachmentMeta> => {
      return await editor.space.writeAttachment(name, encoding, data);
    },
    "space.deleteAttachment": async (_ctx, name: string) => {
      await editor.space.deleteAttachment(name);
    },
  };
}
