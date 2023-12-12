import { Application } from "../server/deps.ts";
import { HttpServer } from "../server/http_server.ts";
import clientAssetBundle from "../dist/client_asset_bundle.json" assert {
  type: "json",
};
import plugAssetBundle from "../dist/plug_asset_bundle.json" assert {
  type: "json",
};
import { AssetBundle, AssetJson } from "../plugos/asset_bundle/bundle.ts";
import { sleep } from "$sb/lib/async.ts";

import { determineDatabaseBackend } from "../server/db_backend.ts";
import { SpaceServerConfig } from "../server/instance.ts";
import { path } from "../common/deps.ts";

export async function serveCommand(
  options: {
    hostname?: string;
    port?: number;
    user?: string;
    auth?: string;
    cert?: string;
    key?: string;
    reindex?: boolean;
    syncOnly?: boolean;
  },
  folder?: string,
) {
  const hostname = options.hostname || Deno.env.get("SB_HOSTNAME") ||
    "127.0.0.1";
  const port = options.port ||
    (Deno.env.get("SB_PORT") && +Deno.env.get("SB_PORT")!) || 3000;
  const syncOnly = options.syncOnly || !!Deno.env.get("SB_SYNC_ONLY");
  const app = new Application();

  if (!folder) {
    // Didn't get a folder as an argument, check if we got it as an environment variable
    folder = Deno.env.get("SB_FOLDER");
    if (!folder) {
      console.error(
        "No folder specified. Please pass a folder as an argument or set SB_FOLDER environment variable.",
      );
      Deno.exit(1);
    }
  }
  folder = path.resolve(Deno.cwd(), folder);

  const baseKvPrimitives = await determineDatabaseBackend(folder);

  console.log(
    "Going to start SilverBullet binding to",
    `${hostname}:${port}`,
  );
  if (hostname === "127.0.0.1") {
    console.info(
      `SilverBullet will only be available locally (via http://localhost:${port}).
To allow outside connections, pass -L 0.0.0.0 as a flag, and put a TLS terminator on top.`,
    );
  }

  const userAuth = options.user ?? Deno.env.get("SB_USER");

  const configs = new Map<string, SpaceServerConfig>();
  configs.set("*", {
    hostname,
    namespace: "*",
    auth: userAuth,
    pagesPath: folder,
  });

  const httpServer = new HttpServer({
    app,
    hostname,
    port,
    clientAssetBundle: new AssetBundle(clientAssetBundle as AssetJson),
    plugAssetBundle: new AssetBundle(plugAssetBundle as AssetJson),
    baseKvPrimitives,
    syncOnly,
    keyFile: options.key,
    certFile: options.cert,
    configs,
  });
  httpServer.start();

  // Wait in an infinite loop (to keep the HTTP server running, only cancelable via Ctrl+C or other signal)
  while (true) {
    await sleep(10000);
  }
}
