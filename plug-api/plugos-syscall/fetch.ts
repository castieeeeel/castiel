import { base64Decode } from "../../plugos/asset_bundle/base64.ts";

export type SandboxFetchRequest = {
  method?: string;
  headers?: Record<string, string>;
};

export type SandboxFetchResponse = {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  // We base64 encode the body because the body can be binary data that we have to push through the worker boundary
  base64Body: string;
};

export function sandboxFetch(
  url: string,
  options?: SandboxFetchRequest,
): Promise<SandboxFetchResponse> {
  // @ts-ignore: monkey patching fetch
  return syscall("sandboxFetch.fetch", url, options);
}

export function monkeyPatchFetch() {
  // @ts-ignore: monkey patching fetch
  globalThis.fetch = async function (
    url: string,
    init?: RequestInit,
  ): Promise<Response> {
    const r = await sandboxFetch(
      url,
      init && {
        method: init.method,
        headers: init.headers as Record<string, string>,
      },
    );
    return new Response(base64Decode(r.base64Body), {
      status: r.status,
      headers: r.headers,
    });
  };
}
