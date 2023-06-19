import { queryRegex } from "$sb/lib/query.ts";
import { ParseTree, renderToText } from "$sb/lib/tree.ts";
import { replaceAsync } from "$sb/lib/util.ts";
import { markdown, space } from "$sb/silverbullet-syscall/mod.ts";
import Handlebars from "handlebars";

import { replaceTemplateVars } from "../core/template.ts";
import { extractFrontmatter } from "$sb/lib/frontmatter.ts";
import { directiveRegex } from "./directives.ts";
import { updateDirectives } from "./command.ts";
import { handlebarHelpers } from "./util.ts";
import { folderName, resolve } from "../../plug-api/lib/path.ts";

const templateRegex = /\[\[([^\]]+)\]\]\s*(.*)\s*/;

export async function templateDirectiveRenderer(
  directive: string,
  pageName: string,
  arg: string | ParseTree,
): Promise<string> {
  if (typeof arg !== "string") {
    throw new Error("Template directives must be a string");
  }
  const match = arg.match(templateRegex);
  if (!match) {
    throw new Error(`Invalid template directive: ${arg}`);
  }
  const template = match[1];
  const args = match[2];
  let parsedArgs = {};
  if (args) {
    try {
      parsedArgs = JSON.parse(args);
    } catch {
      throw new Error(`Failed to parse template instantiation args: ${arg}`);
    }
  }
  let templateText = "";
  if (template.startsWith("http://") || template.startsWith("https://")) {
    try {
      const req = await fetch(template);
      templateText = await req.text();
    } catch (e: any) {
      templateText = `ERROR: ${e.message}`;
    }
  } else {
    const absoluteTemplatePath = resolve(
      folderName(pageName),
      template,
    );
    console.log("Resolved template path", absoluteTemplatePath);
    templateText = await space.readPage(absoluteTemplatePath);
  }
  const tree = await markdown.parseMarkdown(templateText);
  await extractFrontmatter(tree, [], true); // Remove entire frontmatter section, if any
  let newBody = renderToText(tree);

  // if it's a template injection (not a literal "include")
  if (directive === "use") {
    const templateFn = Handlebars.compile(
      replaceTemplateVars(newBody, pageName),
      { noEscape: true, helpers: handlebarHelpers(pageName) },
    );
    if (typeof parsedArgs !== "string") {
      (parsedArgs as any).page = pageName;
    }
    newBody = templateFn(parsedArgs, { helpers: handlebarHelpers(pageName) });

    // Recursively render directives
    newBody = await updateDirectives(pageName, newBody);
  }
  return newBody.trim();
}

export function cleanTemplateInstantiations(text: string): Promise<string> {
  return replaceAsync(
    text,
    directiveRegex,
    (
      _fullMatch,
      startInst,
      type,
      _args,
      body,
      endInst,
    ): Promise<string> => {
      if (type === "use") {
        body = body.replaceAll(
          queryRegex,
          (
            _fullMatch: string,
            _startQuery: string,
            _query: string,
            body: string,
          ) => {
            return body.trim();
          },
        );
      }
      return Promise.resolve(`${startInst}${body}${endInst}`);
    },
  );
}
