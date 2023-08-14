import { events } from "$sb/plugos-syscall/mod.ts";
import { CompleteEvent } from "$sb/app_event.ts";
import { buildHandebarOptions } from "./util.ts";
import type { PageMeta } from "../../web/types.ts";
import {
  AttributeCompleteEvent,
  AttributeCompletion,
} from "../core/attributes.ts";

export async function queryComplete(completeEvent: CompleteEvent) {
  const querySourceMatch = /#query\s+([\w\-_]*)$/.exec(
    completeEvent.linePrefix,
  );
  if (querySourceMatch) {
    const allEvents = await events.listEvents();

    return {
      from: completeEvent.pos - querySourceMatch[1].length,
      options: allEvents
        .filter((eventName) => eventName.startsWith("query:"))
        .map((source) => ({
          label: source.substring("query:".length),
        })),
    };
  }

  if (completeEvent.parentNodes.includes("DirectiveStart")) {
    const querySourceMatch = /#query\s+([\w\-_]+)/.exec(
      completeEvent.linePrefix,
    );
    const whereMatch =
      /(where|order\s+by|and|select(\s+[\w\s,]+)?)\s+([\w\-_]*)$/.exec(
        completeEvent.linePrefix,
      );
    if (querySourceMatch && whereMatch) {
      const type = querySourceMatch[1];
      const attributePrefix = whereMatch[3];
      const completions = (await events.dispatchEvent(
        `attribute:complete:${type}`,
        {
          source: type,
          prefix: attributePrefix,
        } as AttributeCompleteEvent,
      )).flat() as AttributeCompletion[];
      return {
        from: completeEvent.pos - attributePrefix.length,
        options: attributeCompletionsToCMCompletion(completions),
      };
    }
  }
  return null;
}

export async function templateVariableComplete(completeEvent: CompleteEvent) {
  const match = /\{\{([\w@]*)$/.exec(completeEvent.linePrefix);
  if (!match) {
    return null;
  }

  const handlebarOptions = buildHandebarOptions({ name: "" } as PageMeta);
  let allCompletions: any[] = Object.keys(handlebarOptions.helpers).map(
    (name) => ({ label: name, detail: "helper" }),
  );
  allCompletions = allCompletions.concat(
    Object.keys(handlebarOptions.data).map((key) => ({
      label: `@${key}`,
      detail: "global variable",
    })),
  );

  const completions = (await events.dispatchEvent(
    `attribute:complete:*`,
    {
      source: "*",
      prefix: match[1],
    } as AttributeCompleteEvent,
  )).flat() as AttributeCompletion[];

  allCompletions = allCompletions.concat(
    attributeCompletionsToCMCompletion(completions),
  );

  return {
    from: completeEvent.pos - match[1].length,
    options: allCompletions,
  };
}

export function attributeCompletionsToCMCompletion(
  completions: AttributeCompletion[],
) {
  return completions.map(
    (completion) => ({
      label: completion.name,
      detail: `${completion.type} (${completion.source})`,
      type: "attribute",
    }),
  );
}
