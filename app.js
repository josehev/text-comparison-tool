const originalInput = document.querySelector("#original");
const revisedInput = document.querySelector("#revised");
const output = document.querySelector("#diff-output");
const summary = document.querySelector("#result-summary");

function splitLines(text) {
  if (text === "") return [];
  return text.replace(/\r\n?/g, "\n").split("\n");
}

function updateLineNumbers(input) {
  const body = input.closest(".editor-body");
  const numbers = body.querySelector(".editor-line-numbers");
  const measure = body.querySelector(".editor-measure");
  const lines = input.value.replace(/\r\n?/g, "\n").split("\n");
  body.style.setProperty("--line-digits", String(lines.length).length);
  measure.style.width = `${input.clientWidth}px`;
  measure.replaceChildren(...lines.map((line) => {
    const element = document.createElement("span");
    element.textContent = line || "\u200b";
    return element;
  }));
  numbers.replaceChildren(...Array.from(measure.children, (line, index) => {
    const number = document.createElement("span");
    number.textContent = index + 1;
    number.style.height = `${line.getBoundingClientRect().height}px`;
    return number;
  }));
  numbers.style.transform = `translateY(${-input.scrollTop}px)`;
}

for (const input of [originalInput, revisedInput]) {
  input.addEventListener("input", () => updateLineNumbers(input));
  input.addEventListener("scroll", () => {
    input.closest(".editor-body").querySelector(".editor-line-numbers").style.transform =
      `translateY(${-input.scrollTop}px)`;
  });
  new ResizeObserver(() => updateLineNumbers(input)).observe(input);
  updateLineNumbers(input);
}

function myersDiff(a, b) {
  const max = a.length + b.length;
  const frontier = new Map([[1, 0]]);
  const trace = [];

  for (let distance = 0; distance <= max; distance += 1) {
    trace.push(new Map(frontier));
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      let x;
      if (
        diagonal === -distance ||
        (diagonal !== distance &&
          (frontier.get(diagonal - 1) ?? -Infinity) <
            (frontier.get(diagonal + 1) ?? -Infinity))
      ) {
        x = frontier.get(diagonal + 1) ?? 0;
      } else {
        x = (frontier.get(diagonal - 1) ?? 0) + 1;
      }

      let y = x - diagonal;
      while (x < a.length && y < b.length && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      frontier.set(diagonal, x);

      if (x >= a.length && y >= b.length) {
        return backtrack(trace, a, b);
      }
    }
  }

  return [];
}

function backtrack(trace, a, b) {
  let x = a.length;
  let y = b.length;
  const edits = [];

  for (let distance = trace.length - 1; distance >= 0; distance -= 1) {
    const frontier = trace[distance];
    const diagonal = x - y;
    const previousDiagonal =
      diagonal === -distance ||
      (diagonal !== distance &&
        (frontier.get(diagonal - 1) ?? -Infinity) <
          (frontier.get(diagonal + 1) ?? -Infinity))
        ? diagonal + 1
        : diagonal - 1;
    const previousX = frontier.get(previousDiagonal) ?? 0;
    const previousY = previousX - previousDiagonal;

    while (x > previousX && y > previousY) {
      edits.push({ type: "equal", left: a[x - 1], right: b[y - 1] });
      x -= 1;
      y -= 1;
    }

    if (distance === 0) break;
    if (x === previousX) {
      edits.push({ type: "added", right: b[y - 1] });
      y -= 1;
    } else {
      edits.push({ type: "removed", left: a[x - 1] });
      x -= 1;
    }
  }

  while (x > 0 && y > 0) {
    edits.push({ type: "equal", left: a[--x], right: b[--y] });
  }
  while (x > 0) edits.push({ type: "removed", left: a[--x] });
  while (y > 0) edits.push({ type: "added", right: b[--y] });

  return edits.reverse();
}

function alignEdits(edits) {
  const rows = [];
  let leftLine = 1;
  let rightLine = 1;
  let index = 0;

  while (index < edits.length) {
    if (edits[index].type === "equal") {
      rows.push({
        type: "equal",
        left: edits[index].left,
        right: edits[index].right,
        leftLine: leftLine++,
        rightLine: rightLine++,
      });
      index += 1;
      continue;
    }

    const removed = [];
    const added = [];
    while (index < edits.length && edits[index].type !== "equal") {
      if (edits[index].type === "removed") removed.push(edits[index++]);
      else added.push(edits[index++]);
    }
    const count = Math.max(removed.length, added.length);
    for (let row = 0; row < count; row += 1) {
      rows.push({
        type: removed[row] && added[row] ? "changed" : removed[row] ? "removed" : "added",
        left: removed[row]?.left,
        right: added[row]?.right,
        leftLine: removed[row] ? leftLine++ : null,
        rightLine: added[row] ? rightLine++ : null,
      });
    }
  }

  return rows;
}

function tokenize(line) {
  return line.match(/\s+|\w+|[^\w\s]/gu) ?? [];
}

// Returns [text, isChanged] segments for each side of a replaced line pair.
function inlineSegments(leftLine, rightLine) {
  const edits = myersDiff(tokenize(leftLine), tokenize(rightLine));
  const left = [];
  const right = [];
  const push = (segments, text, changed) => {
    const last = segments[segments.length - 1];
    if (last && last[1] === changed) last[0] += text;
    else segments.push([text, changed]);
  };

  for (const edit of edits) {
    if (edit.type === "equal") {
      push(left, edit.left, false);
      push(right, edit.right, false);
    } else if (edit.type === "removed") {
      push(left, edit.left, true);
    } else {
      push(right, edit.right, true);
    }
  }
  return { left, right };
}

function addCell(row, content, lineNumber, type, segments) {
  const cell = document.createElement("div");
  cell.className = `diff-cell ${type || "empty"}`;

  const number = document.createElement("span");
  number.className = "line-number";
  number.textContent = lineNumber ?? "";

  const text = document.createElement("span");
  text.className = "line-content";
  if (segments) {
    for (const [value, changed] of segments) {
      if (changed && value.trim() !== "") {
        const mark = document.createElement("mark");
        mark.textContent = value;
        text.append(mark);
      } else {
        text.append(document.createTextNode(value));
      }
    }
  } else {
    text.textContent = content ?? "";
  }

  cell.append(number, text);
  row.append(cell);
}

function renderDiff(rows, edits) {
  output.replaceChildren();
  const table = document.createElement("div");
  table.className = "diff-table";
  let added = 0;
  let removed = 0;

  for (const edit of edits) {
    if (edit.type === "added") added += 1;
    if (edit.type === "removed") removed += 1;
  }

  for (const item of rows) {
    const row = document.createElement("div");
    row.className = `diff-row ${item.type}`;
    const inline = item.type === "changed" ? inlineSegments(item.left, item.right) : null;
    addCell(row, item.left, item.leftLine, item.type === "changed" || item.type === "removed" ? "removed" : "equal", inline?.left);
    addCell(row, item.right, item.rightLine, item.type === "changed" || item.type === "added" ? "added" : "equal", inline?.right);
    table.append(row);
  }
  output.append(table);

  if (added === 0 && removed === 0) {
    summary.textContent = "The texts are identical.";
  } else {
    summary.textContent = `${added} ${added === 1 ? "addition" : "additions"} and ${removed} ${removed === 1 ? "removal" : "removals"}`;
  }
}

function compare() {
  const edits = myersDiff(splitLines(originalInput.value), splitLines(revisedInput.value));
  renderDiff(alignEdits(edits), edits);
}

document.querySelector("#compare").addEventListener("click", compare);
document.querySelector("#swap").addEventListener("click", () => {
  [originalInput.value, revisedInput.value] = [revisedInput.value, originalInput.value];
  updateLineNumbers(originalInput);
  updateLineNumbers(revisedInput);
  compare();
});
document.querySelector("#clear").addEventListener("click", () => {
  originalInput.value = "";
  revisedInput.value = "";
  updateLineNumbers(originalInput);
  updateLineNumbers(revisedInput);
  output.replaceChildren();
  const message = document.createElement("p");
  message.className = "empty-state";
  message.textContent = "Add text above, then select Compare texts.";
  output.append(message);
  summary.textContent = "Your comparison will appear here.";
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") compare();
});
