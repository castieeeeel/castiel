import { Hook, Manifest, RuntimeEnvironment } from "./types.ts";
import { EventEmitter } from "./event.ts";
import { SandboxFactory } from "./sandbox.ts";
import { Plug } from "./plug.ts";

export interface SysCallMapping {
  [key: string]: (ctx: SyscallContext, ...args: any) => Promise<any> | any;
}

export type SystemJSON<HookT> = Manifest<HookT>[];

export type SystemEvents<HookT> = {
  plugLoaded: (plug: Plug<HookT>) => void | Promise<void>;
  plugUnloaded: (name: string) => void | Promise<void>;
};

export type SyscallContext = {
  plug: Plug<any>;
};

type SyscallSignature = (
  ctx: SyscallContext,
  ...args: any[]
) => Promise<any> | any;

type Syscall = {
  requiredPermissions: string[];
  callback: SyscallSignature;
};

export class System<HookT> extends EventEmitter<SystemEvents<HookT>> {
  readonly runtimeEnv: RuntimeEnvironment;
  protected plugs = new Map<string, Plug<HookT>>();
  protected registeredSyscalls = new Map<string, Syscall>();
  protected enabledHooks = new Set<Hook<HookT>>();

  constructor(env: RuntimeEnvironment) {
    super();
    this.runtimeEnv = env;
  }

  get loadedPlugs(): Map<string, Plug<HookT>> {
    return this.plugs;
  }

  addHook(feature: Hook<HookT>) {
    this.enabledHooks.add(feature);
    feature.apply(this);
  }

  registerSyscalls(
    requiredCapabilities: string[],
    ...registrationObjects: SysCallMapping[]
  ) {
    for (const registrationObject of registrationObjects) {
      for (const [name, callback] of Object.entries(registrationObject)) {
        this.registeredSyscalls.set(name, {
          requiredPermissions: requiredCapabilities,
          callback,
        });
      }
    }
  }

  syscallWithContext(
    ctx: SyscallContext,
    name: string,
    args: any[],
  ): Promise<any> {
    const syscall = this.registeredSyscalls.get(name);
    if (!syscall) {
      throw Error(`Unregistered syscall ${name}`);
    }
    for (const permission of syscall.requiredPermissions) {
      if (!ctx.plug) {
        throw Error(`Syscall ${name} requires permission and no plug is set`);
      }
      if (!ctx.plug.grantedPermissions.includes(permission)) {
        throw Error(`Missing permission '${permission}' for syscall ${name}`);
      }
    }
    return Promise.resolve(syscall.callback(ctx, ...args));
  }

  localSyscall(
    contextPlugName: string,
    syscallName: string,
    args: any[],
  ): Promise<any> {
    return this.syscallWithContext(
      // Mock the plug
      { plug: { name: contextPlugName } as any },
      syscallName,
      args,
    );
  }

  async load(
    manifest: Manifest<HookT>,
    sandboxFactory: SandboxFactory<HookT>,
  ): Promise<Plug<HookT>> {
    const name = manifest.name;
    if (this.plugs.has(name)) {
      await this.unload(name);
    }
    // Validate
    let errors: string[] = [];
    for (const feature of this.enabledHooks) {
      errors = [...errors, ...feature.validateManifest(manifest)];
    }
    if (errors.length > 0) {
      throw new Error(`Invalid manifest: ${errors.join(", ")}`);
    }
    // Ok, let's load this thing!
    const plug = new Plug(this, name, sandboxFactory);
    console.log("Loading", name);
    await plug.load(manifest);
    this.plugs.set(name, plug);
    await this.emit("plugLoaded", plug);
    return plug;
  }

  async unload(name: string) {
    // console.log("Unloading", name);
    const plug = this.plugs.get(name);
    if (!plug) {
      throw Error(`Plug ${name} not found`);
    }
    await plug.stop();
    this.emit("plugUnloaded", name);
    this.plugs.delete(name);
  }

  toJSON(): SystemJSON<HookT> {
    const plugJSON: Manifest<HookT>[] = [];
    for (const [_, plug] of this.plugs) {
      if (!plug.manifest) {
        continue;
      }
      plugJSON.push(plug.manifest);
    }
    return plugJSON;
  }

  async replaceAllFromJSON(
    json: SystemJSON<HookT>,
    sandboxFactory: SandboxFactory<HookT>,
  ) {
    await this.unloadAll();
    for (const manifest of json) {
      // console.log("Loading plug", manifest.name);
      await this.load(manifest, sandboxFactory);
    }
  }

  unloadAll(): Promise<void[]> {
    return Promise.all(
      Array.from(this.plugs.keys()).map(this.unload.bind(this)),
    );
  }
}
