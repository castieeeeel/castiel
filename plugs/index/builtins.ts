import { ObjectValue } from "$sb/types.ts";
import { indexObjects } from "./api.ts";
import { AttributeObject } from "./attributes.ts";
import { TagObject } from "./tags.ts";

export const builtinPseudoPage = ":builtin:";

// Types marked with a ! are read-only, they cannot be set by the user
export const builtins: Record<string, Record<string, string>> = {
  page: {
    ref: "!string",
    name: "!string",
    displayName: "string",
    aliases: "array",
    created: "!date",
    lastModified: "!date",
    perm: "!rw|ro",
    contentType: "!string",
    size: "!number",
    tags: "array",
  },
  task: {
    ref: "!string",
    name: "!string",
    done: "!boolean",
    page: "!string",
    state: "!string",
    deadline: "string",
    pos: "!number",
    tags: "array",
  },
  taskstate: {
    ref: "!string",
    tags: "!array",
    state: "!string",
    count: "!number",
    page: "!string",
  },
  tag: {
    ref: "!string",
    name: "!string",
    page: "!string",
    context: "!string",
  },
  attribute: {
    ref: "!string",
    name: "!string",
    attributeType: "!string",
    type: "!string",
    page: "!string",
    readOnly: "!boolean",
  },
  anchor: {
    ref: "!string",
    name: "!string",
    page: "!string",
    pos: "!number",
  },
  link: {
    ref: "!string",
    name: "!string",
    page: "!string",
    pos: "!number",
    alias: "!string",
    asTemplate: "!boolean",
  },
  paragraph: {
    text: "!string",
    page: "!string",
    pos: "!number",
  },
  template: {
    ref: "!string",
    page: "!string",
    pageName: "string",
    pos: "!number",
    type: "string",
    trigger: "string",
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
          attributeType: attributeType.startsWith("!")
            ? attributeType.substring(1)
            : attributeType,
          readOnly: attributeType.startsWith("!"),
          page: builtinPseudoPage,
        };
      }),
    );
  }
  await indexObjects(builtinPseudoPage, allTags);
}
