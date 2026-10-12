function instructionTargetMentions(line, target) {
  const mentions = [];
  for (let index = line.indexOf(target); index >= 0; index = line.indexOf(target, index + target.length)) {
    const relativePrefix = index >= 2 && line.slice(index - 2, index) === "./";
    const start = relativePrefix ? index - 2 : index;
    const before = start === 0 ? " " : line[start - 1];
    const after = line[index + target.length] ?? " ";
    if (/[\s`(\[]/.test(before) && /[\s`)\].,;:]/.test(after)) mentions.push({ index, start });
  }
  return mentions;
}

function containingCodeRange(ranges, position) {
  let low = 0, high = ranges.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (ranges.at(middle)[0] <= position) low = middle + 1;
    else high = middle;
  }
  const range = ranges.at(low - 1);
  return range && position < range[1] ? range : null;
}

function targetInstructionKind(clause, target, codeRanges, pathCodeStarts, offset) {
  let applicable = false;
  let contradicted = false;
  const directive = /\b(?:(?:do\s+not|don['’]t|never|must\s+not|should\s+not|cannot|can['’]t|won['’]t)(?:\s+[\p{L}\p{N}_-]+){0,4}|under\s+no\s+circumstances|by\s+no\s+means|on\s+no\s+account)\s+(?:use|read|follow)\b|\b(?:use|read|follow|avoid|exclude|except|without|forbid|ignore|omit|skip|reject|instead\s+of|rather\s+than|not|but)\b/giu;
  const directives = clause.matchAll(directive);
  let nextDirective = directives.next().value, governing = null;
  for (const { index } of instructionTargetMentions(clause, target)) {
    // Mentions and directive matches are ordered; never rescan the same clause
    // prefix for every target or the same range list for every directive.
    while (nextDirective && nextDirective.index < index) {
      const match = nextDirective;
      if (!containingCodeRange(codeRanges, offset + match.index)) governing = match[0].toLowerCase();
      nextDirective = directives.next().value;
    }
    const targetRange = containingCodeRange(codeRanges, offset + index);
    // Formatting a path is supported; an entire instruction in code remains
    // an example even when outer prose contains a directive such as "Use".
    if (targetRange && !pathCodeStarts.has(targetRange[0])) continue;
    if (governing === null) continue;
    if (/^(?:use|read|follow)$/.test(governing)) applicable = true;
    else contradicted = true;
  }
  return { applicable, contradicted };
}

// These HTML forms have literal terminators. Ordinary block/standalone tags
// are conservatively hidden until a blank line, which adoption framing supplies.
export function markdownRawHtmlOpening(line) {
  const named = line.match(/^ {0,3}<(script|pre|style|textarea)(?=[\s>]|$)/i);
  if (named) return { kind: named[1].toLowerCase(), end: `</${named[1].toLowerCase()}>`, caseInsensitive: true };
  if (/^ {0,3}<\?/.test(line)) return { kind: "processing instruction", end: "?>" };
  if (/^ {0,3}<!\[CDATA\[/.test(line)) return { kind: "CDATA", end: "]]>" };
  if (/^ {0,3}<![A-Z]/.test(line)) return { kind: "declaration", end: ">" };
  const block = /^ {0,3}<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?=[\s/>]|$)/i;
  const standalone = /^ {0,3}(?:<[A-Za-z][A-Za-z0-9-]*(?:[ \t]+[A-Za-z_:][A-Za-z0-9_.:-]*(?:[ \t]*=[ \t]*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*[ \t]*\/?>|<\/[A-Za-z][A-Za-z0-9-]*[ \t]*>)[ \t]*$/;
  if (block.test(line) || standalone.test(line)) return { kind: "HTML block", end: null };
  return null;
}

function visibleMarkdownLines(content) {
  content = content.replace(/\r\n?/g, "\n");
  let fence = null;
  let commented = false;
  let commentBlock = false;
  let commentQuoteDepth = 0;
  let paragraphDepth = null;
  let rawHtml = null, codeEnd = 0, spanIndex = 0, nextLineOffset = 0;
  const codeSpans = matchedInlineCodeSpans(content);
  const lines = [];
  for (const line of content.split("\n")) {
    // Preserve a blank barrier for removed blocks. A second inline pass must
    // never join backticks across a fence/HTML block that was masked above.
    lines.push("");
    const lineOffset = nextLineOffset;
    nextLineOffset += line.length + 1;
    const quotePrefix = line.match(/^(?: {0,3}> ?)+/)?.[0] ?? "";
    const quoteDepth = (quotePrefix.match(/>/g) ?? []).length;
    const unquoted = line.slice(quotePrefix.length);
    const block = inlineBlockLine(line);
    const effectiveDepth = paragraphQuoteDepth(paragraphDepth, block);
    // HTML-block bodies never start a lazy paragraph. Inline comments retain
    // the same paragraph context used by code-span boundary matching.
    paragraphDepth = block.after || (commented && commentBlock) ? null : effectiveDepth;
    if (commented && effectiveDepth < commentQuoteDepth) commented = false;
    // A fenced example ends with its quote container. It cannot suppress
    // subsequent top-level policy even when the example omits a closing fence.
    if (fence !== null && fence.quoteDepth > quoteDepth) fence = null;
    if (fence !== null) {
      const closing = unquoted.match(/^ {0,3}(`+|~+)\s*$/);
      if (quoteDepth === fence.quoteDepth && closing && closing[1][0] === fence.ticks[0] && closing[1].length >= fence.ticks.length) fence = null;
      continue;
    }
    if (rawHtml && quoteDepth < rawHtml.quoteDepth) rawHtml = null;
    if (!commented && codeEnd <= lineOffset && !rawHtml) {
      const opening = unquoted.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (opening && !(opening[1][0] === "`" && opening[2].includes("`"))) { fence = { ticks: opening[1], quoteDepth }; continue; }
      const html = markdownRawHtmlOpening(unquoted);
      if (html) rawHtml = { ...html, quoteDepth };
      else if (/^(?: {4}|\t)/.test(unquoted)) continue;
    }
    if (rawHtml) {
      let offset = 0;
      const tailOpening = /<!--|<(?:script|pre|style|textarea)(?=[\s>]|$)|<\?|<!\[CDATA\[|<![A-Z]/ig;
      while (offset < line.length || rawHtml?.end === null) {
        if (rawHtml) {
          if (rawHtml.end === null) {
            if (!unquoted.trim()) rawHtml = null;
            break;
          }
          const text = rawHtml.caseInsensitive ? line.toLowerCase() : line;
          const end = text.indexOf(rawHtml.end, offset);
          if (end < 0) break;
          offset = end + rawHtml.end.length; rawHtml = null;
        } else if (commented) {
          const end = line.indexOf("-->", offset);
          if (end < 0) break;
          offset = end + 3; commented = false;
        } else {
          tailOpening.lastIndex = offset;
          const next = tailOpening.exec(line);
          if (!next) break;
          if (next[0] === "<!--") { commented = true; commentBlock = true; paragraphDepth = null; commentQuoteDepth = quoteDepth; offset = next.index + 4; }
          else {
            const html = markdownRawHtmlOpening(line.slice(next.index));
            offset = next.index + next[0].length;
            if (html?.end) rawHtml = { ...html, quoteDepth };
          }
        }
      }
      // A raw block's entire closing line is still HTML, including its tail.
      continue;
    }
    let visible = "";
    let index = 0, visibleStart = 0;
    let commentStart = line.indexOf("<!--");
    while (index < line.length) {
      if (commented) {
        const end = line.indexOf("-->", index);
        if (end === -1) { visible += " ".repeat(line.length - index); visibleStart = line.length; break; }
        visible += " ".repeat(end + 3 - index);
        commented = false;
        index = end + 3;
        visibleStart = index;
        continue;
      }
      if (codeEnd > lineOffset + index) {
        const end = Math.min(line.length, codeEnd - lineOffset);
        index = end;
        continue;
      }
      if (commentStart !== -1 && commentStart < index) commentStart = line.indexOf("<!--", index);
      const start = commentStart;
      // Consume a matched code span before a comment delimiter. Skip spans
      // beginning in an earlier real comment or already-consumed code span.
      // Precomputed matches avoid rescanning every remaining line suffix.
      while (spanIndex < codeSpans.length && codeSpans.at(spanIndex)[0] < lineOffset + index) spanIndex++;
      const span = codeSpans.at(spanIndex);
      if (span && span[0] < lineOffset + (start < 0 ? line.length : start)) {
        codeEnd = span[1];
        const end = Math.min(line.length, codeEnd - lineOffset);
        index = end;
        continue;
      }
      if (start === -1) break;
      visible += line.slice(visibleStart, start);
      // Keep original columns so removing a comment cannot promote following
      // text into a heading or a fence at the beginning of the line.
      visible += " ".repeat(4);
      commented = true;
      commentBlock = /^ {0,3}<!--/.test(unquoted);
      commentQuoteDepth = effectiveDepth;
      index = start + 4;
      visibleStart = index;
    }
    visible += line.slice(visibleStart);
    lines[lines.length - 1] = visible;
  }
  return lines;
}

// Exact headings in supported prose; fenced/indented examples and comments
// are not source pointers. Quoted headings are not top-level headings.
export function markdownHeadingCount(content, heading) {
  return markdownHeadingCounts(content, [heading]).get(heading);
}

export function markdownHeadingCounts(content, headings) {
  const counts = new Map([...headings].map((heading) => [heading, 0]));
  if (counts.size === 0) return counts;
  const visible = visibleMarkdownLines(content).join("\n");
  const ranges = inlineCodeRanges(visible);
  let offset = 0;
  for (const line of visible.split("\n")) {
    if (counts.has(line) && !containingCodeRange(ranges, offset)) counts.set(line, counts.get(line) + 1);
    offset += line.length + 1;
  }
  return counts;
}

export function matchedInlineCodeSpans(content) {
  let count = 0;
  for (let index = content.indexOf("`"); index >= 0; index = content.indexOf("`", index)) {
    count++;
    while (content[index] === "`") index++;
  }
  // At most two integers per delimiter run. Regex match objects, per-run
  // maps and pair arrays must not multiply a bounded source's heap usage.
  const data = new Uint32Array(count * 2), next = new Map();
  if (count === 0) return codeRangeTable(data);
  let boundaryCount = 0;
  for (const _offset of inlineBlockBoundaries(content)) boundaryCount++;
  const boundaries = new Uint32Array(boundaryCount);
  let boundaryIndex = 0;
  for (const offset of inlineBlockBoundaries(content)) boundaries[boundaryIndex++] = offset;
  boundaryIndex--;
  let write = data.length;
  // One descending tick cursor prevents every tick-free line from searching
  // the complete earlier prefix again.
  for (let last = content.lastIndexOf("`"); last >= 0;) {
    const end = last + 1;
    while (last >= 0 && content[last] === "`") last--;
    const start = last + 1, length = end - start;
    while (boundaryIndex >= 0 && start < boundaries[boundaryIndex]) { next.clear(); boundaryIndex--; }
    const closing = next.get(length);
    next.set(length, end);
    let slashes = 0;
    for (let before = start - 1; before >= 0 && content[before] === "\\"; before--) slashes++;
    // Escapes affect opening delimiters in prose. Backslashes inside code do
    // not escape a closing delimiter, so the precomputed closers stay intact.
    if (slashes % 2 === 0 && closing !== undefined) {
      data[--write] = closing;
      data[--write] = start;
    }
    last = last < 0 ? -1 : content.lastIndexOf("`", last);
  }
  return codeRangeTable(data.subarray(write));
}

function* inlineBlockBoundaries(content) {
  let paragraphDepth = null, previous = -1;
  for (let offset = 0; offset <= content.length;) {
    const newline = content.indexOf("\n", offset);
    const end = newline < 0 ? content.length : newline;
    const block = inlineBlockLine(content.slice(offset, end));
    // Omitting some/all quote prefixes can lazily continue an existing
    // paragraph. A blank/explicit block or a deeper new container ends it.
    const effectiveDepth = paragraphQuoteDepth(paragraphDepth, block);
    if (block.before || paragraphDepth === null || effectiveDepth !== paragraphDepth) {
      if (offset !== previous) { yield offset; previous = offset; }
    }
    paragraphDepth = effectiveDepth;
    if (block.after) {
      const after = newline < 0 ? end : end + 1;
      if (after !== previous) { yield after; previous = after; }
      paragraphDepth = null;
    }
    if (newline < 0) break;
    offset = end + 1;
  }
}

function paragraphQuoteDepth(previousDepth, block) {
  return block.before || previousDepth === null || block.quoteDepth > previousDepth ? block.quoteDepth : previousDepth;
}

function inlineBlockLine(line) {
  const prefix = line.match(/^(?: {0,3}> ?)+/)?.[0] ?? "";
  const quoteDepth = (prefix.match(/>/g) ?? []).length;
  const text = line.slice(prefix.length);
  // Supported inline blocks never cross blank paragraphs, new containers or
  // explicit block syntax. Line-start HTML comments (type 2) interrupt a
  // paragraph before inline parsing; only inline comments can remain in code.
  const isolated = !text.trim() || /^(?: {4}|\t)/.test(text) || /^ {0,3}<!--/.test(text)
    || /^ {0,3}(?:#{1,6}(?:[ \t]|$)|`{3,}|~{3,}|(?:\*[ \t]*){3,}$|(?:_[ \t]*){3,}$|(?:-[ \t]*){3,}$|=+[ \t]*$|-+[ \t]*$)/.test(text)
    || markdownRawHtmlOpening(text) !== null;
  const item = /^ {0,3}(?:[-+*]|[0-9]{1,9}[.)])(?:[ \t]+|$)/.test(text);
  return { quoteDepth, before: isolated || item, after: isolated };
}

function codeRangeTable(data) {
  return {
    length: data.length / 2,
    at(index) {
      return index >= 0 && index < this.length ? [data[index * 2], data[index * 2 + 1]] : undefined;
    },
    *[Symbol.iterator]() {
      for (let index = 0; index < this.length; index++) yield this.at(index);
    },
  };
}

function inlineCodeRanges(content) {
  const spans = matchedInlineCodeSpans(content);
  const data = new Uint32Array(spans.length * 2);
  let count = 0, lastEnd = 0;
  for (const [start, end] of spans) {
    if (start < lastEnd) continue;
    data[count++] = start; data[count++] = end; lastEnd = end;
  }
  return codeRangeTable(data.subarray(0, count));
}

function applicableInstructionPointer(content, target) {
  const visible = visibleMarkdownLines(content).join("\n");
  const codeRanges = inlineCodeRanges(visible);
  const pathCodeStarts = new Set();
  for (const [start, end] of codeRanges) {
    const path = visible.slice(start, end).replace(/^`+|`+$/g, "").trim();
    if (path === target || path === `./${target}`) pathCodeStarts.add(start);
  }
  let applicable = false, contradicted = false, offset = 0;
  for (const line of visible.split("\n")) {
    // Explicit examples are weak evidence even when quoted; ordinary quoted
    // policy instructions remain eligible, as do backtick-formatted paths.
    const example = /^(?:\s*>\s*)*\s*(?:historical\s+)?(?:example|sample|示例|历史示例)\s*[:：]/i.test(line);
    if (!example && line.includes(target)) {
      let start = 0;
      const evaluate = (end) => {
        const clause = line.slice(start, end);
        if (!clause.includes(target)) return;
        const result = targetInstructionKind(clause, target, codeRanges, pathCodeStarts, offset + start);
        applicable ||= result.applicable;
        contradicted ||= result.contradicted;
      };
      for (const boundary of line.matchAll(/;|[.!?]\s+(?=[A-Z])/g)) {
        evaluate(boundary.index);
        start = boundary.index + boundary[0].length;
      }
      evaluate(line.length);
    }
    offset += line.length + 1;
  }
  return applicable && !contradicted;
}

export function applicableCorePointer(content) {
  return applicableInstructionPointer(content, ".agents/skills/forgerail/SKILL.md");
}

export function applicableContractPointer(content) {
  return applicableInstructionPointer(content, "FORGERAIL.md");
}
