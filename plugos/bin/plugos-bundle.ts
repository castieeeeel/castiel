#!/usr/bin/env deno

import { Manifest } from "../types.ts";
import { YAML } from "../../common/deps.ts";
import { compile, esbuild, sandboxCompileModule } from "../compile.ts";
import { path } from "../../server/deps.ts";

import * as flags from "https://deno.land/std@0.158.0/flags/mod.ts";

export async function bundle(
  manifestPath: string,
  debug: boolean,
  excludeModules: string[],
): Promise<Manifest<any>> {
  const rootPath = path.dirname(manifestPath);
  const manifest = YAML.parse(
    await Deno.readTextFile(manifestPath),
  ) as Manifest<any>;

  if (!manifest.name) {
    throw new Error(`Missing 'name' in ${manifestPath}`);
  }

  const allModulesToExclude = excludeModules.slice();

  for (let [name, moduleSpec] of Object.entries(manifest.dependencies || {})) {
    manifest.dependencies![name] = await sandboxCompileModule(moduleSpec);
    allModulesToExclude.push(name);
  }

  for (let [name, def] of Object.entries(manifest.functions || {})) {
    let jsFunctionName = "default",
      filePath = path.join(rootPath, def.path!);
    if (filePath.indexOf(":") !== -1) {
      [filePath, jsFunctionName] = filePath.split(":");
    }

    def.code = await compile(
      filePath,
      jsFunctionName,
      debug,
      allModulesToExclude,
      false,
    );
    delete def.path;
  }
  return manifest;
}

async function buildManifest(
  manifestPath: string,
  distPath: string,
  debug: boolean,
  excludeModules: string[],
) {
  const generatedManifest = await bundle(manifestPath, debug, excludeModules);
  const outFile = manifestPath.substring(
    0,
    manifestPath.length - path.extname(manifestPath).length,
  ) + ".json";
  const outPath = path.join(distPath, path.basename(outFile));
  console.log("Emitting bundle to", outPath);
  await Deno.writeTextFile(outPath, JSON.stringify(generatedManifest, null, 2));
  return { generatedManifest, outPath };
}

async function bundleRun(
  manifestFiles: string[],
  dist: string,
  debug: boolean,
  exclude: string[],
  watch: boolean,
) {
  // console.log("Args", arguments);
  let building = false;
  async function buildAll() {
    if (building) {
      return;
    }
    console.log("Building", manifestFiles);
    building = true;
    Deno.mkdirSync(dist, { recursive: true });
    for (const plugManifestPath of manifestFiles) {
      const manifestPath = plugManifestPath as string;
      try {
        await buildManifest(
          manifestPath,
          dist,
          debug,
          exclude,
        );
      } catch (e) {
        console.error(`Error building ${manifestPath}:`, e);
      }
    }
    console.log("Done.");
    building = false;
  }

  await buildAll();

  if (watch) {
    const watcher = Deno.watchFs(manifestFiles.map((p) => path.dirname(p)));
    for await (const event of watcher) {
      console.log("Change detected, rebuilding...");
      buildAll();
    }
  }
}

if (import.meta.main) {
  const args = flags.parse(Deno.args, {
    boolean: ["debug", "watch"],
    string: ["dist", "exclude"],
    alias: { w: "watch" },
    // collect: ["exclude"],
  });

  if (args._.length === 0) {
    console.log(
      "Usage: plugos-bundle [--debug] [--dist <path>] [--exclude=package1,package2] <manifest.plug.yaml> <manifest2.plug.yaml> ...",
    );
    Deno.exit(1);
  }

  if (!args.dist) {
    args.dist = path.resolve("dist");
  }

  await bundleRun(
    args._ as string[],
    args.dist,
    args.debug,
    typeof args.exclude === "string" ? args.exclude.split(",") : [],
    args.watch,
  );
  esbuild.stop();
}
