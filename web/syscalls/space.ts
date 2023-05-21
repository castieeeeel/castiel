import { Editor } from "../editor.tsx";
import { SysCallMapping } from "../../plugos/system.ts";
import { AttachmentMeta, PageMeta } from "../types.ts";
import { FileData, FileEncoding } from "../space.ts";

export function spaceSyscalls(editor: Editor): SysCallMapping {
  const space = editor.space;
  return {
    "space.listPages": (): Promise<PageMeta[]> => {
      return space.fetchPageList();
    },
    "space.readPage": async (
      _ctx,
      name: string,
    ): Promise<string> => {
      return (await space.readPage(name)).text;
    },
    "space.getPageMeta": (_ctx, name: string): Promise<PageMeta> => {
      return space.getPageMeta(name);
    },
    "space.writePage": (
      _ctx,
      name: string,
      text: string,
    ): Promise<PageMeta> => {
      return space.writePage(name, text);
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
      return space.listPlugs();
    },
    "space.listAttachments": async (): Promise<AttachmentMeta[]> => {
      return await space.fetchAttachmentList();
    },
    "space.readAttachment": async (
      _ctx,
      name: string,
    ): Promise<FileData> => {
      return (await space.readAttachment(name, "dataurl")).data;
    },
    "space.getAttachmentMeta": async (
      _ctx,
      name: string,
    ): Promise<AttachmentMeta> => {
      return await space.getAttachmentMeta(name);
    },
    "space.writeAttachment": async (
      _ctx,
      name: string,
      encoding: FileEncoding,
      data: string,
    ): Promise<AttachmentMeta> => {
      return await space.writeAttachment(name, encoding, data);
    },
    "space.deleteAttachment": async (_ctx, name: string) => {
      await space.deleteAttachment(name);
    },
  };
}
