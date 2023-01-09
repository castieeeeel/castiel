// import { mkdir, readdir, readFile, stat, unlink, writeFile } from "fs/promises";
import { path } from "../deps.ts";
import { readAll } from "../deps.ts";
import { FileMeta } from "../types.ts";
import { FileData, FileEncoding, SpacePrimitives } from "./space_primitives.ts";
import { Plug } from "../../plugos/plug.ts";
import { mime } from "https://deno.land/x/mimetypes@v1.0.0/mod.ts";
import {
  base64DecodeDataUrl,
  base64EncodedDataUrl,
} from "../../plugos/asset_bundle/base64.ts";
import { walk } from "../../plugos/deps.ts";

function lookupContentType(path: string): string {
  return mime.getType(path) || "application/octet-stream";
}

const excludedFiles = ["data.db", "sync.json"];

export class DiskSpacePrimitives implements SpacePrimitives {
  rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = Deno.realPathSync(rootPath);
  }

  safePath(p: string): string {
    const realPath = path.resolve(p);
    if (!realPath.startsWith(this.rootPath)) {
      throw Error(`Path ${p} is not in the space`);
    }
    return realPath;
  }

  filenameToPath(pageName: string) {
    return this.safePath(path.join(this.rootPath, pageName));
  }

  pathToFilename(fullPath: string): string {
    return fullPath.substring(this.rootPath.length + 1);
  }

  async readFile(
    name: string,
    encoding: FileEncoding,
  ): Promise<{ data: FileData; meta: FileMeta }> {
    const localPath = this.filenameToPath(name);
    try {
      const s = await Deno.stat(localPath);
      let data: FileData | null = null;
      const contentType = lookupContentType(name);
      switch (encoding) {
        case "string":
          data = await Deno.readTextFile(localPath);
          break;
        case "dataurl":
          {
            const f = await Deno.open(localPath, { read: true });
            const buf = await readAll(f);
            Deno.close(f.rid);

            data = base64EncodedDataUrl(contentType, buf);
          }
          break;
        case "arraybuffer":
          {
            const f = await Deno.open(localPath, { read: true });
            const buf = await readAll(f);
            Deno.close(f.rid);

            data = buf.buffer;
          }
          break;
      }
      return {
        data,
        meta: {
          name: name,
          lastModified: s.mtime!.getTime(),
          perm: "rw",
          size: s.size,
          contentType: contentType,
        },
      };
    } catch {
      // console.error("Error while reading file", name, e);
      throw Error(`Could not read file ${name}`);
    }
  }

  async writeFile(
    name: string,
    encoding: FileEncoding,
    data: FileData,
    _selfUpdate?: boolean,
    timestamp?: number,
  ): Promise<FileMeta> {
    const localPath = this.filenameToPath(name);
    try {
      // Ensure parent folder exists
      await Deno.mkdir(path.dirname(localPath), { recursive: true });

      const file = await Deno.open(localPath, {
        write: true,
        create: true,
        truncate: true,
      });

      // Actually write the file
      switch (encoding) {
        case "string":
          await Deno.write(file.rid, new TextEncoder().encode(data as string));
          break;
        case "dataurl":
          await Deno.write(file.rid, base64DecodeDataUrl(data as string));
          break;
        case "arraybuffer":
          await Deno.write(file.rid, new Uint8Array(data as ArrayBuffer));
          break;
      }

      if (timestamp) {
        console.log("Seting mtime to", new Date(timestamp));
        await Deno.futime(file.rid, new Date(), new Date(timestamp));
      }
      file.close();

      // Fetch new metadata
      const s = await Deno.stat(localPath);
      return {
        name: name,
        size: s.size,
        contentType: lookupContentType(name),
        lastModified: s.mtime!.getTime(),
        perm: "rw",
      };
    } catch (e) {
      console.error("Error while writing file", name, e);
      throw Error(`Could not write ${name}`);
    }
  }

  async getFileMeta(name: string): Promise<FileMeta> {
    const localPath = this.filenameToPath(name);
    try {
      const s = await Deno.stat(localPath);
      return {
        name: name,
        size: s.size,
        contentType: lookupContentType(name),
        lastModified: s.mtime!.getTime(),
        perm: "rw",
      };
    } catch {
      // console.error("Error while getting page meta", pageName, e);
      throw Error(`Could not get meta for ${name}`);
    }
  }

  async deleteFile(name: string): Promise<void> {
    const localPath = this.filenameToPath(name);
    await Deno.remove(localPath);
  }

  async fetchFileList(): Promise<{ files: FileMeta[]; timestamp: number }> {
    const allFiles: FileMeta[] = [];
    for await (
      const file of walk(this.rootPath, {
        includeDirs: false,
        // Exclude hidden directories
        skip: [
          // Dynamically builds a regexp that matches hidden directories INSIDE the rootPath
          // (but if the rootPath is hidden, it stil lists files inside of it, fixing #130)
          new RegExp(`^${escapeRegExp(this.rootPath)}.*\\/\\..+$`),
        ],
      })
    ) {
      const fullPath = file.path;
      try {
        const s = await Deno.stat(fullPath);
        const name = fullPath.substring(this.rootPath.length + 1);
        if (excludedFiles.includes(name)) {
          continue;
        }
        allFiles.push({
          name: name,
          lastModified: s.mtime!.getTime(),
          contentType: mime.getType(fullPath) || "application/octet-stream",
          size: s.size,
          perm: "rw",
        });
      } catch (e: any) {
        if (e instanceof Deno.errors.NotFound) {
          // Ignore, temporariy file already deleted by the time we got here
        } else {
          console.error("Failed to stat", fullPath, e);
        }
      }
    }

    return {
      files: allFiles,
      timestamp: Date.now(),
    };
  }

  // Plugs
  invokeFunction(
    plug: Plug<any>,
    _env: string,
    name: string,
    args: any[],
  ): Promise<any> {
    return plug.invoke(name, args);
  }

  proxySyscall(plug: Plug<any>, name: string, args: any[]): Promise<any> {
    return plug.syscall(name, args);
  }
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
