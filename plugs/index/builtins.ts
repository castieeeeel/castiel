import { ObjectValue } from "$sb/types.ts";
import { indexObjects } from "./api.ts";
import { AttributeObject } from "./attributes.ts";
import { TagObject } from "./tags.ts";

export const builtinPseudoPage = ":builtin:";

export const builtins: Record<string, Record<string, string>> = {
  page: {
    name: "string",
    lastModified: "date",
    perm: "rw|ro",
    contentType: "string",
    size: "number",
    tags: "array",
  },
  task: {
    name: "string",
    done: "boolean",
    page: "string",
    state: "string",
    deadline: "string",
    pos: "number",
    tags: "array",
  },
  tag: {
    name: "string",
    page: "string",
    context: "string",
  },
  attribute: {
    name: "string",
    attributeType: "string",
    type: "string",
    page: "string",
  },
  anchor: {
    name: "string",
    page: "string",
    pos: "number",
  },
  link: {
    name: "string",
    page: "string",
    pos: "number",
    alias: "string",
    inDirective: "boolean",
    asTemplate: "boolean",
  },
  paragraph: {
    text: "string",
    page: "string",
    pos: "number",
  },
};

export async function loadBuiltinsIntoIndex() {
  console.log("Loading builtins attributes into index");
  const allTags: ObjectValue<TagObject>[] = [];
  for (const [tag, attributes] of Object.entries(builtins)) {
    allTags.push({
      ref: tag,
      tags: ["tag"],
      name: tag,
      page: builtinPseudoPage,
      parent: "builtin",
    });
    await indexObjects<AttributeObject>(
      builtinPseudoPage,
      Object.entries(attributes).map(([name, attributeType]) => {
        return {
          ref: `${tag}:${name}`,
          tags: ["attribute"],
          tag,
          name,
          attributeType,
          builtinPseudoPage,
          page: builtinPseudoPage,
        };
      }),
    );
  }
  await indexObjects(builtinPseudoPage, allTags);
}
