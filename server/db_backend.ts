import { DenoKvPrimitives } from "../plugos/lib/deno_kv_primitives.ts";
import { KvPrimitives } from "../plugos/lib/kv_primitives.ts";
import { path } from "./deps.ts";

/**
 * Environment variables:
 * - SB_DB_BACKEND: "denokv" or "off" (default: denokv)
 * - SB_KV_DB (denokv only): path to the database file (default .silverbullet.db) or ":cloud:" for cloud storage
 */

export async function determineDatabaseBackend(
  singleTenantFolder?: string,
): Promise<
  KvPrimitives | undefined
> {
  const backendConfig = Deno.env.get("SB_DB_BACKEND") || "denokv";
  switch (backendConfig) {
    case "denokv": {
      let dbFile: string | undefined = Deno.env.get("SB_KV_DB") ||
        ".silverbullet.db";

      if (singleTenantFolder) {
        // If we're running in single tenant mode, we may as well use the tenant's space folder to keep the database
        dbFile = path.resolve(singleTenantFolder, dbFile);
      }

      if (dbFile === ":cloud:") {
        dbFile = undefined; // Deno Deploy will use the default KV store
      }
      const denoDb = await Deno.openKv(dbFile);
      console.info(
        `Using DenoKV as a database backend (${
          dbFile || "cloud"
        }), running in server-processing mode.`,
      );
      return new DenoKvPrimitives(denoDb);
    }
    default:
      console.info(
        "Running in databaseless mode: no server-side indexing and state keeping (beyond space files) will happen.",
      );
      return;
  }
}
