import {
  CompletionParams,
  CompletionList,
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
  MarkupContent,
  InsertTextFormat,
  TextDocument,
  TextEdit
} from "vscode-languageserver";
import { ParserEvents } from "../../htmljs-parser";
import { TagLibLookup } from "../../compiler";
import { rangeFromEvent } from "../../utils";

export function attributeName(
  taglib: TagLibLookup,
  document: TextDocument,
  params: CompletionParams,
  event: ParserEvents.AttributeName
) {
  const completions: CompletionItem[] = [];
  const attrNameRange = rangeFromEvent(document, event);
  const tagDef =
    !event.tag.tagNameExpression && taglib.getTag(event.tag.tagName);
  const nestedTagAttrs: { [x: string]: boolean } = {};

  if (tagDef && tagDef.nestedTags) {
    for (const key in tagDef.nestedTags) {
      const nestedTagDef = tagDef.nestedTags[key];
      nestedTagAttrs[nestedTagDef.targetProperty] = true;
    }
  }

  taglib.forEachAttribute((tagDef && tagDef.name) || "*", (attr, parent) => {
    if (
      attr.deprecated ||
      nestedTagAttrs[attr.name] ||
      attr.name === "*" ||
      (attr.name[0] === "_" &&
        /\/node_modules\//.test(attr.filePath || parent.filePath))
    ) {
      return;
    }

    const type = attr.type || (attr.html ? "string" : null);
    const documentation: MarkupContent = {
      kind: MarkupKind.Markdown,
      value: attr.description || ""
    };
    let label = attr.name;
    let snippet = attr.name;

    if (attr.enum) {
      snippet += `="\${1|${attr.enum.join()}|}"$0`;
    } else {
      switch (type) {
        case "string":
          snippet += '="$1"$0';
          break;
        case "function":
          snippet += "=($1)$0";
          break;
        case "statement":
        case "boolean":
        case "flag":
          break;
        case "never":
          return;
        default:
          snippet += "=";
          break;
      }
    }

    const autocomplete =
      attr.autocomplete && Array.isArray(attr.autocomplete)
        ? attr.autocomplete[0]
        : attr.autocomplete;

    if (autocomplete) {
      label = autocomplete.displayText || label;
      snippet = autocomplete.snippet || snippet;

      if (autocomplete.descriptionMoreURL) {
        if (documentation.value) {
          documentation.value += `\n\n`;
        }

        documentation.value += `[More Info](${autocomplete.descriptionMoreURL})`;
      }
    }

    completions.push({
      label,
      documentation: documentation.value ? documentation : undefined,
      kind: CompletionItemKind.Property,
      insertTextFormat: InsertTextFormat.Snippet,
      textEdit: TextEdit.replace(attrNameRange, snippet)
    });
  });

  return CompletionList.create(completions);
}
