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

function targetInstructionKind(clause, target) {
  let applicable = false;
  let contradicted = false;
  const directive = /\b(?:do\s+not|don['’]t|never|must\s+not|should\s+not|cannot|can['’]t|won['’]t)\s+(?:use|read|follow)\b|\b(?:use|read|follow|avoid|exclude|except|without|forbid|ignore|omit|skip|reject|instead\s+of|rather\s+than|not|but)\b/gi;
  for (const { index } of instructionTargetMentions(clause, target)) {
    let governing = null;
    for (const match of clause.slice(0, index).matchAll(directive)) governing = match[0].toLowerCase();
    if (governing === null) continue;
    if (/^(?:use|read|follow)$/.test(governing)) applicable = true;
    else contradicted = true;
  }
  return { applicable, contradicted };
}

function applicableInstructionPointer(content, target) {
  let fence = null;
  let commented = false;
  let applicable = false;
  let contradicted = false;
  for (const line of content.split(/\r?\n/)) {
    if (fence !== null) {
      const closing = line.match(/^ {0,3}(`+|~+)\s*$/);
      if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) fence = null;
      continue;
    }
    let visible = "";
    let index = 0;
    while (index < line.length) {
      if (commented) {
        const end = line.indexOf("-->", index);
        if (end === -1) break;
        commented = false;
        index = end + 3;
        continue;
      }
      const start = line.indexOf("<!--", index);
      if (start === -1) { visible += line.slice(index); break; }
      visible += line.slice(index, start);
      commented = true;
      index = start + 4;
    }
    if (/^(?: {4}|\t)/.test(line)) continue;
    const opening = visible.match(/^ {0,3}(`{3,}|~{3,})/);
    if (opening) { fence = opening[1]; continue; }
    for (const clause of visible.split(/;|[.!?]\s+(?=[A-Z])/)) {
      const result = targetInstructionKind(clause, target);
      applicable ||= result.applicable;
      contradicted ||= result.contradicted;
    }
  }
  return applicable && !contradicted;
}

export function applicableCorePointer(content) {
  return applicableInstructionPointer(content, ".agents/skills/forgerail/SKILL.md");
}

export function applicableContractPointer(content) {
  return applicableInstructionPointer(content, "FORGERAIL.md");
}
