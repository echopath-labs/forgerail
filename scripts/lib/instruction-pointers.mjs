function mentionsInstructionTarget(line, target) {
  for (let index = line.indexOf(target); index >= 0; index = line.indexOf(target, index + target.length)) {
    const before = index === 0 ? " " : line[index - 1];
    const after = line[index + target.length] ?? " ";
    const relativePrefix = index >= 2 && line.slice(index - 2, index) === "./";
    if ((/[\s`(\[]/.test(before) || relativePrefix) && /[\s`)\].,;:]/.test(after)) return true;
  }
  return false;
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
      if (!mentionsInstructionTarget(clause, target)) continue;
      if (/\b(?:not|never|avoid|exclude|except|without|but|cannot|forbid|ignore|omit|skip|reject|don['’]t|doesn['’]t|didn['’]t|can['’]t|won['’]t|shouldn['’]t|mustn['’]t|wouldn['’]t|isn['’]t|aren['’]t|couldn['’]t)\b|\b(?:instead of|rather than)\b/i.test(clause)) {
        contradicted = true;
        continue;
      }
      if (/^\s*(?:(?:[-*+]|[0-9]{1,9}[.)])\s+)?(?:use|read|follow)\b/i.test(clause)) applicable = true;
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
