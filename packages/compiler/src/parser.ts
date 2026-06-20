import type {
  AttributeCst,
  CommentCst,
  ConstTagCst,
  DebugDirectiveCst,
  DirectiveAttributeCst,
  EachBlockCst,
  ElementCst,
  ErrorCst,
  HtmlDirectiveCst,
  IfBlockCst,
  InterpolationCst,
  LetTagCst,
  RawTextCst,
  RawTextElementCst,
  SlateFileCst,
  SlateScriptElementCst,
  TagCst,
  TemplateCstNode,
  TextCst,
} from "./cst";
import { error, type Diagnostic } from "./diagnostics";
import { LineMap, type Range } from "./source";

export type ParseOptions = {
  filename?: string;
};

export type ParseResult = {
  cst: SlateFileCst;
  diagnostics: Diagnostic[];
  lineMap: LineMap;
};

type ChildrenStop =
  | {
      kind: "tag";
      tagName: string;
    }
  | {
      kind: "if";
    }
  | {
      kind: "each";
    }
  | undefined;

export function parse(source: string, _options: ParseOptions = {}): ParseResult {
  const parser = new Parser(source);
  return parser.parse();
}

class Parser {
  private pos = 0;
  private readonly diagnostics: Diagnostic[] = [];

  constructor(private readonly source: string) {}

  parse(): ParseResult {
    const children = this.parseChildren();
    const cst: SlateFileCst = {
      kind: "SlateFile",
      range: {
        start: 0,
        end: this.source.length,
      },
      children,
    };

    return {
      cst,
      diagnostics: this.diagnostics,
      lineMap: new LineMap(this.source),
    };
  }

  private parseChildren(stop?: ChildrenStop): TemplateCstNode[] {
    const children: TemplateCstNode[] = [];

    while (!this.isEof()) {
      if (stop?.kind === "tag" && this.startsWithClosingTag(stop.tagName)) {
        break;
      }

      if (stop?.kind === "if" && (this.startsWith("{:else}") || this.startsWith("{/if}"))) {
        break;
      }

      if (stop?.kind === "each" && (this.startsWith("{:else}") || this.startsWith("{/each}"))) {
        break;
      }

      if (this.startsWith("<!--")) {
        children.push(this.parseComment());
        continue;
      }

      if (this.current() === "<") {
        if (this.startsWith("</")) {
          children.push(this.parseUnexpectedClosingTag());
          continue;
        }

        children.push(this.parseElement());
        continue;
      }

      if (this.current() === "{") {
        children.push(this.parseBraceSyntax());
        continue;
      }

      children.push(this.parseText(stop));
    }

    return children;
  }

  private parseComment(): CommentCst {
    const start = this.pos;
    const bodyStart = start + 4;
    const close = this.source.indexOf("-->", bodyStart);

    if (close === -1) {
      this.pos = this.source.length;
      const node: CommentCst = {
        kind: "Comment",
        range: this.range(start, this.pos),
        text: this.source.slice(bodyStart),
        closed: false,
      };
      this.addDiagnostic("Expected `-->` to close comment.", node.range);
      return node;
    }

    this.pos = close + 3;
    return {
      kind: "Comment",
      range: this.range(start, this.pos),
      text: this.source.slice(bodyStart, close),
      closed: true,
    };
  }

  private parseElement(): TemplateCstNode {
    const openTag = this.parseTag(false);

    if (!openTag) {
      return this.parseText();
    }

    const rawTagName = openTag.rawTagName;
    const tagName = openTag.tagName;

    if (tagName === "script" && this.hasBooleanAttribute(openTag, "slate")) {
      return this.parseSlateScriptElement(openTag);
    }

    if (tagName === "script" || tagName === "style") {
      return this.parseRawTextElement(openTag, tagName);
    }

    if (openTag.selfClosing) {
      return {
        kind: "Element",
        range: openTag.range,
        tagName,
        rawTagName,
        openTag,
        children: [],
        selfClosing: true,
      };
    }

    const children = this.parseChildren({
      kind: "tag",
      tagName,
    });
    const closeTag = this.startsWithClosingTag(tagName) ? this.parseTag(true) : undefined;
    const end = closeTag?.range.end ?? (children.at(-1)?.range.end ?? openTag.range.end);

    const element: ElementCst = {
      kind: "Element",
      range: this.range(openTag.range.start, end),
      tagName,
      rawTagName,
      openTag,
      children,
      closeTag,
      selfClosing: false,
    };

    if (!closeTag) {
      this.addDiagnostic(`Expected closing </${rawTagName}>.`, element.range);
    }

    return element;
  }

  private parseRawTextElement(
    openTag: TagCst,
    tagName: "script" | "style",
  ): RawTextElementCst {
    const bodyStart = this.pos;
    const closeStart = this.indexOfClosingTag(tagName, bodyStart);
    const bodyEnd = closeStart === -1 ? this.source.length : closeStart;

    this.pos = bodyEnd;

    const body: RawTextCst = {
      kind: "RawText",
      range: this.range(bodyStart, bodyEnd),
      text: this.source.slice(bodyStart, bodyEnd),
    };
    const closeTag = closeStart === -1 ? undefined : this.parseTag(true);
    const end = closeTag?.range.end ?? bodyEnd;
    const node: RawTextElementCst = {
      kind: "RawTextElement",
      range: this.range(openTag.range.start, end),
      tagName,
      rawTagName: openTag.rawTagName,
      openTag,
      body,
      closeTag,
    };

    if (!closeTag) {
      this.addDiagnostic(`Expected closing </${openTag.rawTagName}>.`, node.range);
    }

    return node;
  }

  private parseSlateScriptElement(openTag: TagCst): SlateScriptElementCst {
    const bodyStart = this.pos;
    const closeStart = this.indexOfClosingTag("script", bodyStart);
    const bodyEnd = closeStart === -1 ? this.source.length : closeStart;

    this.pos = bodyEnd;

    const body: RawTextCst = {
      kind: "RawText",
      range: this.range(bodyStart, bodyEnd),
      text: this.source.slice(bodyStart, bodyEnd),
    };
    const closeTag = closeStart === -1 ? undefined : this.parseTag(true);
    const end = closeTag?.range.end ?? bodyEnd;
    const node: SlateScriptElementCst = {
      kind: "SlateScriptElement",
      range: this.range(openTag.range.start, end),
      openTag,
      body,
      closeTag,
    };

    if (!closeTag) {
      this.addDiagnostic("Expected closing </script>.", node.range);
    }

    return node;
  }

  private parseTag(closing: boolean): TagCst | undefined {
    const start = this.pos;

    if (this.current() !== "<") {
      return undefined;
    }

    this.pos++;

    if (closing) {
      if (this.current() !== "/") {
        this.pos = start;
        return undefined;
      }

      this.pos++;
    }

    this.skipWhitespace();
    const rawTagName = this.readName();

    if (!rawTagName) {
      this.pos = start + 1;
      return undefined;
    }

    const tagName = rawTagName.toLowerCase();
    const attributes = closing ? [] : this.parseAttributes();
    this.skipWhitespace();

    let selfClosing = false;

    if (!closing && this.startsWith("/>")) {
      selfClosing = true;
      this.pos += 2;
    } else if (this.current() === ">") {
      this.pos++;
    } else {
      this.addDiagnostic("Expected `>` to close tag.", this.range(start, this.pos));
    }

    return {
      kind: "Tag",
      range: this.range(start, this.pos),
      tagName,
      rawTagName,
      attributes,
      selfClosing,
      closing,
    };
  }

  private parseAttributes(): AttributeCst[] {
    const attributes: AttributeCst[] = [];

    while (!this.isEof()) {
      this.skipWhitespace();

      if (this.current() === ">" || this.startsWith("/>")) {
        break;
      }

      const start = this.pos;
      const rawName = this.readAttributeName();

      if (!rawName) {
        this.pos++;
        continue;
      }

      const name = rawName;
      this.skipWhitespace();

      if (this.current() !== "=") {
        attributes.push(this.createAttribute(start, this.pos, rawName, name));
        continue;
      }

      this.pos++;
      this.skipWhitespace();

      if (this.current() === "\"" || this.current() === "'") {
        const quote = this.current() as "\"" | "'";
        this.pos++;
        const valueStart = this.pos;
        const valueEnd = this.source.indexOf(quote, valueStart);

        if (valueEnd === -1) {
          const value = this.source.slice(valueStart);
          this.pos = this.source.length;
          attributes.push({
            ...this.createAttributeBase(start, this.pos, rawName, name),
            kind: this.isDirectiveName(name) ? "DirectiveAttribute" : "StringAttribute",
            value,
            quote,
            namespace: this.directiveNamespace(name),
            directiveName: this.directiveName(name),
            valueKind: "string",
          } as AttributeCst);
          this.addDiagnostic(`Expected closing ${quote} for attribute value.`, this.range(start, this.pos));
          continue;
        }

        const value = this.source.slice(valueStart, valueEnd);
        this.pos = valueEnd + 1;

        if (this.isDirectiveName(name)) {
          attributes.push({
            ...this.createAttributeBase(start, this.pos, rawName, name),
            kind: "DirectiveAttribute",
            namespace: this.directiveNamespace(name),
            directiveName: this.directiveName(name),
            value,
            valueKind: "string",
          });
        } else {
          attributes.push({
            ...this.createAttributeBase(start, this.pos, rawName, name),
            kind: "StringAttribute",
            value,
            quote,
          });
        }

        continue;
      }

      if (this.current() === "{") {
        const expression = this.readBalancedBraces();

        if (this.isDirectiveName(name)) {
          const attr: DirectiveAttributeCst = {
            ...this.createAttributeBase(start, this.pos, rawName, name),
            kind: "DirectiveAttribute",
            namespace: this.directiveNamespace(name),
            directiveName: this.directiveName(name),
            value: expression.island,
            valueKind: "expression",
            closed: expression.closed,
          };
          attributes.push(attr);
        } else {
          attributes.push({
            ...this.createAttributeBase(start, this.pos, rawName, name),
            kind: "ExpressionAttribute",
            expression: expression.island,
            closed: expression.closed,
          });
        }

        if (!expression.closed) {
          this.addDiagnostic("Expected `}` to close attribute expression.", this.range(start, this.pos));
        }

        continue;
      }

      const valueStart = this.pos;
      while (!this.isEof() && !this.isWhitespace(this.current()) && this.current() !== ">") {
        this.pos++;
      }

      attributes.push({
        ...this.createAttributeBase(start, this.pos, rawName, name),
        kind: "StringAttribute",
        value: this.source.slice(valueStart, this.pos),
        quote: "\"",
      });
    }

    return attributes;
  }

  private parseBraceSyntax(): TemplateCstNode {
    const start = this.pos;

    if (this.startsWith("{@html", start)) {
      return this.parseNamedDirective("HtmlDirective", "{@html", start);
    }

    if (this.startsWith("{@debug", start)) {
      return this.parseNamedDirective("DebugDirective", "{@debug", start);
    }

    if (this.startsWith("{const", start)) {
      return this.parseStatementTag("ConstTag", "{const", start);
    }

    if (this.startsWith("{let", start)) {
      return this.parseStatementTag("LetTag", "{let", start);
    }

    if (this.startsWith("{#if", start)) {
      return this.parseIfBlock();
    }

    if (this.startsWith("{#each", start)) {
      return this.parseEachBlock();
    }

    const expression = this.readBalancedBraces();
    const node: InterpolationCst = {
      kind: "Interpolation",
      range: this.range(start, this.pos),
      expression: expression.island,
      closed: expression.closed,
    };

    if (!expression.closed) {
      this.addDiagnostic("Expected `}` to close interpolation.", node.range);
    }

    return node;
  }

  private parseStatementTag(
    kind: "ConstTag" | "LetTag",
    prefix: "{const" | "{let",
    start: number,
  ): ConstTagCst | LetTagCst {
    this.pos += prefix.length;
    const statementStart = start + 1;
    const close = this.findBraceClose(this.pos);
    const statementEnd = close === -1 ? this.source.length : close;
    const closed = close !== -1;
    this.pos = closed ? close + 1 : this.source.length;

    const node = {
      kind,
      range: this.range(start, this.pos),
      statement: {
        range: this.range(statementStart, statementEnd),
        text: this.source.slice(statementStart, statementEnd).trim(),
      },
      closed,
    } satisfies ConstTagCst | LetTagCst;

    if (!closed) {
      this.addDiagnostic(`Expected \`}\` to close ${prefix.slice(1)} tag.`, node.range);
    }

    return node;
  }

  private parseEachBlock(): EachBlockCst {
    const start = this.pos;
    const open = this.parseBlockTag("#each");
    const parsed = this.parseEachExpression(open.expression);
    const children = this.parseChildren({ kind: "each" });
    let elseChildren: TemplateCstNode[] | undefined;

    if (this.startsWith("{:else}")) {
      this.parseBlockTag(":else");
      elseChildren = this.parseChildren({ kind: "each" });
    }

    const close = this.startsWith("{/each}") ? this.parseBlockTag("/each") : undefined;
    const end = close?.range.end ?? (elseChildren?.at(-1)?.range.end ?? children.at(-1)?.range.end ?? open.range.end);
    const node: EachBlockCst = {
      kind: "EachBlock",
      range: this.range(start, end),
      open,
      expression: parsed.expression,
      item: parsed.item,
      index: parsed.index,
      children,
      else: elseChildren,
      close,
    };

    if (!parsed.valid) {
      this.addDiagnostic("Expected each block syntax `{#each expression as item}`.", open.range);
    }

    if (!close) {
      this.addDiagnostic("Expected `{/each}` to close each block.", node.range);
    }

    return node;
  }

  private parseEachExpression(expression: { range: Range; text: string } | undefined): {
    expression: { range: Range; text: string };
    item: string;
    index?: string;
    valid: boolean;
  } {
    const fallback = {
      expression: expression ?? {
        range: this.range(this.pos, this.pos),
        text: "[]",
      },
      item: "item",
      valid: false,
    };

    if (!expression) {
      return fallback;
    }

    const match = /^(.*?)\s+as\s+([A-Za-z_$][\w$]*)(?:\s*,\s*([A-Za-z_$][\w$]*))?\s*$/.exec(expression.text);

    if (!match?.[1] || !match[2]) {
      return fallback;
    }

    const expressionText = match[1].trim();
    const expressionStart = expression.range.start + expression.text.indexOf(expressionText);

    return {
      expression: {
        range: this.range(expressionStart, expressionStart + expressionText.length),
        text: expressionText,
      },
      item: match[2],
      index: match[3],
      valid: true,
    };
  }

  private parseIfBlock(): IfBlockCst {
    const start = this.pos;
    const open = this.parseBlockTag("#if");
    const then = this.parseChildren({ kind: "if" });
    let elseChildren: TemplateCstNode[] | undefined;

    if (this.startsWith("{:else}")) {
      this.parseBlockTag(":else");
      elseChildren = this.parseChildren({ kind: "if" });
    }

    const close = this.startsWith("{/if}") ? this.parseBlockTag("/if") : undefined;
    const end = close?.range.end ?? (elseChildren?.at(-1)?.range.end ?? then.at(-1)?.range.end ?? open.range.end);
    const node: IfBlockCst = {
      kind: "IfBlock",
      range: this.range(start, end),
      open,
      then,
      else: elseChildren,
      close,
    };

    if (!close) {
      this.addDiagnostic("Expected `{/if}` to close if block.", node.range);
    }

    return node;
  }

  private parseBlockTag(name: "#if" | "#each" | ":else" | "/if" | "/each") {
    const start = this.pos;
    this.pos += name.length + 1;
    const expressionStart = this.pos;
    const close = this.findBraceClose(this.pos);
    const expressionEnd = close === -1 ? this.source.length : close;
    const closed = close !== -1;
    this.pos = closed ? close + 1 : this.source.length;

    return {
      kind: "BlockTag" as const,
      name,
      range: this.range(start, this.pos),
      expression:
        expressionEnd > expressionStart
          ? {
              range: this.range(expressionStart, expressionEnd),
              text: this.source.slice(expressionStart, expressionEnd).trim(),
            }
          : undefined,
      closed,
    };
  }

  private parseNamedDirective(
    kind: "HtmlDirective" | "DebugDirective",
    prefix: "{@html" | "{@debug",
    start: number,
  ): HtmlDirectiveCst | DebugDirectiveCst {
    this.pos += prefix.length;
    const expressionStart = this.pos;
    const close = this.findBraceClose(this.pos);
    const expressionEnd = close === -1 ? this.source.length : close;
    const closed = close !== -1;
    this.pos = closed ? close + 1 : this.source.length;

    const node = {
      kind,
      range: this.range(start, this.pos),
      expression: {
        range: this.range(expressionStart, expressionEnd),
        text: this.source.slice(expressionStart, expressionEnd).trim(),
      },
      closed,
    } satisfies HtmlDirectiveCst | DebugDirectiveCst;

    if (!closed) {
      this.addDiagnostic(`Expected \`}\` to close ${prefix.slice(1)} directive.`, node.range);
    }

    return node;
  }

  private parseText(stop?: ChildrenStop): TextCst {
    const start = this.pos;

    while (!this.isEof()) {
      if (this.startsWith("<!--") || this.current() === "{" || this.current() === "<") {
        break;
      }

      if (stop?.kind === "tag" && this.startsWithClosingTag(stop.tagName)) {
        break;
      }

      this.pos++;
    }

    if (this.pos === start) {
      this.pos++;
    }

    return {
      kind: "Text",
      range: this.range(start, this.pos),
      text: this.source.slice(start, this.pos),
    };
  }

  private parseUnexpectedClosingTag(): ErrorCst {
    const start = this.pos;
    const tag = this.parseTag(true);
    const end = tag?.range.end ?? this.pos;
    const node: ErrorCst = {
      kind: "Error",
      range: this.range(start, end),
      text: this.source.slice(start, end),
    };
    this.addDiagnostic("Unexpected closing tag.", node.range);
    return node;
  }

  private readBalancedBraces(): { island: { range: Range; text: string }; closed: boolean } {
    const start = this.pos;
    let depth = 0;
    let index = this.pos;
    let quote: "\"" | "'" | "`" | undefined;

    while (index < this.source.length) {
      const char = this.source[index]!;

      if (quote) {
        if (char === "\\") {
          index += 2;
          continue;
        }

        if (char === quote) {
          quote = undefined;
        }

        index++;
        continue;
      }

      if (char === "\"" || char === "'" || char === "`") {
        quote = char;
        index++;
        continue;
      }

      if (char === "{") {
        depth++;
        index++;
        continue;
      }

      if (char === "}") {
        depth--;
        index++;

        if (depth === 0) {
          const expressionStart = start + 1;
          const expressionEnd = index - 1;
          this.pos = index;
          return {
            island: {
              range: this.range(expressionStart, expressionEnd),
              text: this.source.slice(expressionStart, expressionEnd).trim(),
            },
            closed: true,
          };
        }

        continue;
      }

      index++;
    }

    this.pos = this.source.length;
    return {
      island: {
        range: this.range(start + 1, this.source.length),
        text: this.source.slice(start + 1).trim(),
      },
      closed: false,
    };
  }

  private findBraceClose(start: number): number {
    let index = start;
    let quote: "\"" | "'" | "`" | undefined;

    while (index < this.source.length) {
      const char = this.source[index]!;

      if (quote) {
        if (char === "\\") {
          index += 2;
          continue;
        }

        if (char === quote) {
          quote = undefined;
        }

        index++;
        continue;
      }

      if (char === "\"" || char === "'" || char === "`") {
        quote = char;
        index++;
        continue;
      }

      if (char === "}") {
        return index;
      }

      index++;
    }

    return -1;
  }

  private createAttribute(start: number, end: number, rawName: string, name: string): AttributeCst {
    if (this.isDirectiveName(name)) {
      return {
        ...this.createAttributeBase(start, end, rawName, name),
        kind: "DirectiveAttribute",
        namespace: this.directiveNamespace(name),
        directiveName: this.directiveName(name),
      };
    }

    return {
      ...this.createAttributeBase(start, end, rawName, name),
      kind: "BooleanAttribute",
    };
  }

  private createAttributeBase(start: number, end: number, rawName: string, name: string) {
    return {
      range: this.range(start, end),
      name,
      rawName,
    };
  }

  private hasBooleanAttribute(tag: TagCst, name: string): boolean {
    return tag.attributes.some((attr) => attr.kind === "BooleanAttribute" && attr.name === name);
  }

  private readName(): string {
    const start = this.pos;

    while (!this.isEof()) {
      const char = this.current();

      if (this.isWhitespace(char) || char === "/" || char === ">") {
        break;
      }

      this.pos++;
    }

    return this.source.slice(start, this.pos);
  }

  private readAttributeName(): string {
    const start = this.pos;

    while (!this.isEof()) {
      const char = this.current();

      if (this.isWhitespace(char) || char === "=" || char === "/" || char === ">") {
        break;
      }

      this.pos++;
    }

    return this.source.slice(start, this.pos);
  }

  private startsWithClosingTag(tagName: string): boolean {
    if (!this.startsWith("</")) {
      return false;
    }

    const afterSlash = this.pos + 2;
    return this.source.slice(afterSlash, afterSlash + tagName.length).toLowerCase() === tagName;
  }

  private indexOfClosingTag(tagName: string, from: number): number {
    const lower = this.source.toLowerCase();
    return lower.indexOf(`</${tagName}`, from);
  }

  private isDirectiveName(name: string): boolean {
    return name.includes(":");
  }

  private directiveNamespace(name: string): string {
    return name.split(":", 1)[0]!;
  }

  private directiveName(name: string): string {
    return name.slice(this.directiveNamespace(name).length + 1);
  }

  private skipWhitespace(): void {
    while (!this.isEof() && this.isWhitespace(this.current())) {
      this.pos++;
    }
  }

  private isWhitespace(char: string): boolean {
    return char === " " || char === "\n" || char === "\r" || char === "\t" || char === "\f";
  }

  private current(): string {
    return this.source[this.pos] ?? "";
  }

  private startsWith(search: string, position = this.pos): boolean {
    return this.source.startsWith(search, position);
  }

  private isEof(): boolean {
    return this.pos >= this.source.length;
  }

  private range(start: number, end: number): Range {
    return { start, end };
  }

  private addDiagnostic(message: string, range: Range): void {
    this.diagnostics.push(error(message, range));
  }
}
