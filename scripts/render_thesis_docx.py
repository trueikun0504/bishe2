from __future__ import annotations

import html
import re
import sys
from pathlib import Path


def apply_inline(text: str) -> str:
    escaped = html.escape(text)
    return re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)


def split_table_row(line: str) -> list[str]:
    stripped = line.strip().strip("|")
    return [cell.strip() for cell in stripped.split("|")]


def is_table_separator(line: str) -> bool:
    stripped = line.strip().strip("|").replace(" ", "")
    if not stripped:
        return False
    return all(ch in "-:|" for ch in line.strip())


def render_table(lines: list[str], start: int) -> tuple[str, int]:
    header = split_table_row(lines[start])
    rows: list[list[str]] = []
    index = start + 2
    while index < len(lines):
        line = lines[index]
        if "|" not in line or not line.strip():
            break
        rows.append(split_table_row(line))
        index += 1

    parts = ["<table>", "<thead><tr>"]
    for cell in header:
        parts.append(f"<th>{apply_inline(cell)}</th>")
    parts.append("</tr></thead><tbody>")
    for row in rows:
        parts.append("<tr>")
        for cell in row:
            parts.append(f"<td>{apply_inline(cell)}</td>")
        parts.append("</tr>")
    parts.append("</tbody></table>")
    return "".join(parts), index


def render_list(lines: list[str], start: int, ordered: bool) -> tuple[str, int]:
    pattern = r"^\s*\d+\.\s+(.*)$" if ordered else r"^\s*[-*]\s+(.*)$"
    tag = "ol" if ordered else "ul"
    parts = [f"<{tag}>"]
    index = start
    while index < len(lines):
        match = re.match(pattern, lines[index])
        if not match:
            break
        parts.append(f"<li>{apply_inline(match.group(1).strip())}</li>")
        index += 1
    parts.append(f"</{tag}>")
    return "".join(parts), index


def render_paragraph(lines: list[str], start: int) -> tuple[str, int]:
    buffer: list[str] = []
    index = start
    while index < len(lines):
        line = lines[index].rstrip()
        if not line.strip():
            break
        if line.startswith("```"):
            break
        if re.match(r"^\s*#{1,3}\s+", line):
            break
        if re.match(r"^\s*\d+\.\s+", line):
            break
        if re.match(r"^\s*[-*]\s+", line):
            break
        if "|" in line and index + 1 < len(lines) and is_table_separator(lines[index + 1]):
            break
        buffer.append(apply_inline(line.strip()))
        index += 1

    css_class = "signature-line" if any("签名" in item or "日期" in item or "日 期" in item for item in buffer) else ""
    class_attr = f' class="{css_class}"' if css_class else ""
    return f"<p{class_attr}>{'<br/>'.join(buffer)}</p>", index


def render_markdown(section_text: str) -> str:
    lines = section_text.splitlines()
    parts: list[str] = []
    index = 0
    in_code = False
    code_lang = ""
    code_buffer: list[str] = []

    while index < len(lines):
        line = lines[index].rstrip("\n")

        if in_code:
            if line.strip().startswith("```"):
                lang_class = f" lang-{html.escape(code_lang)}" if code_lang else ""
                parts.append(
                    f'<pre class="code-block{lang_class}">{html.escape(chr(10).join(code_buffer))}</pre>'
                )
                in_code = False
                code_lang = ""
                code_buffer = []
            else:
                code_buffer.append(line)
            index += 1
            continue

        if not line.strip():
            index += 1
            continue

        if line.strip().startswith("```"):
            in_code = True
            code_lang = line.strip()[3:].strip()
            index += 1
            continue

        heading = re.match(r"^\s*(#{1,3})\s+(.*)$", line)
        if heading:
            level = len(heading.group(1))
            title = apply_inline(heading.group(2).strip())
            parts.append(f"<h{level}>{title}</h{level}>")
            index += 1
            continue

        if "|" in line and index + 1 < len(lines) and is_table_separator(lines[index + 1]):
            table_html, index = render_table(lines, index)
            parts.append(table_html)
            continue

        if re.match(r"^\s*\d+\.\s+", line):
            list_html, index = render_list(lines, index, True)
            parts.append(list_html)
            continue

        if re.match(r"^\s*[-*]\s+", line):
            list_html, index = render_list(lines, index, False)
            parts.append(list_html)
            continue

        paragraph_html, index = render_paragraph(lines, index)
        parts.append(paragraph_html)

    return "".join(parts)


def render_cover(section_text: str, secondary: bool = False) -> str:
    lines = [line.strip() for line in section_text.splitlines() if line.strip()]
    parts: list[str] = []
    for idx, line in enumerate(lines):
        if line.startswith("# "):
            title = apply_inline(line[2:].strip())
            css_class = "cover-title secondary" if secondary else "cover-title"
            if idx == 0:
                css_class = "cover-heading secondary" if secondary else "cover-heading"
            parts.append(f'<div class="{css_class}">{title}</div>')
        else:
            css = "cover-line cover-name-en" if re.fullmatch(r"[A-Za-z0-9 .,:()/-]+", line) else "cover-line"
            parts.append(f'<div class="{css}">{apply_inline(line)}</div>')
    return "".join(parts)


def build_html(markdown_text: str) -> str:
    sections = re.split(r"(?m)^\s*---\s*$", markdown_text)
    content: list[str] = []

    for idx, raw_section in enumerate(sections):
        section = raw_section.strip()
        if not section:
            continue

        if idx == 0:
            body = render_cover(section, secondary=False)
            content.append(f'<section class="cover-page first-cover">{body}</section>')
        elif idx == 1:
            body = render_cover(section, secondary=True)
            content.append(f'<section class="cover-page second-cover">{body}</section>')
        else:
            body = render_markdown(section)
            content.append(f'<section class="doc-page">{body}</section>')

    style = """
    <style>
      @page { margin: 2.54cm 3.18cm 2.54cm 3.18cm; }
      body {
        font-family: SimSun, "宋体", serif;
        font-size: 12pt;
        line-height: 1.75;
        color: #000;
      }
      .cover-page, .doc-page {
        page-break-after: always;
      }
      .doc-page:last-child, .cover-page:last-child {
        page-break-after: auto;
      }
      .cover-page {
        text-align: center;
        padding-top: 2cm;
      }
      .first-cover {
        padding-top: 1.4cm;
      }
      .second-cover {
        padding-top: 3.2cm;
      }
      .cover-heading {
        font-family: SimHei, "黑体", sans-serif;
        font-size: 18pt;
        font-weight: bold;
        margin: 12pt 0 28pt;
      }
      .cover-title {
        font-family: SimHei, "黑体", sans-serif;
        font-size: 22pt;
        font-weight: bold;
        margin: 20pt 0;
      }
      .cover-title.secondary {
        font-size: 20pt;
        margin: 16pt 0;
      }
      .cover-heading.secondary {
        font-size: 18pt;
        margin-bottom: 22pt;
      }
      .cover-line {
        margin: 10pt 0;
        text-indent: 0;
      }
      .cover-name-en {
        font-family: "Times New Roman", serif;
      }
      h1, h2, h3 {
        font-family: SimHei, "黑体", sans-serif;
        font-weight: bold;
        text-indent: 0;
      }
      h1 {
        font-size: 18pt;
        margin: 18pt 0 12pt;
      }
      h2 {
        font-size: 16pt;
        margin: 14pt 0 10pt;
      }
      h3 {
        font-size: 14pt;
        margin: 12pt 0 8pt;
      }
      p {
        margin: 0 0 10pt;
        text-indent: 2em;
      }
      .signature-line {
        text-indent: 0;
      }
      ol, ul {
        margin: 0 0 10pt 2em;
      }
      li {
        margin: 0 0 6pt 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 8pt 0 12pt;
        font-size: 11pt;
      }
      th, td {
        border: 1px solid #000;
        padding: 6pt;
        vertical-align: top;
      }
      th {
        text-align: center;
        font-family: SimHei, "黑体", sans-serif;
      }
      code {
        font-family: Consolas, "Courier New", monospace;
      }
      .code-block {
        font-family: Consolas, "Courier New", monospace;
        white-space: pre-wrap;
        border: 1px solid #999;
        padding: 8pt;
        background: #f7f7f7;
        margin: 8pt 0 12pt;
        font-size: 10.5pt;
      }
    </style>
    """

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>毕业论文终稿</title>
  {style}
</head>
<body>
{''.join(content)}
</body>
</html>
"""


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: py -3 render_thesis_docx.py <input_md> <output_html>")
        return 1

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    markdown_text = input_path.read_text(encoding="utf-8")
    html_text = build_html(markdown_text)
    output_path.write_text(html_text, encoding="utf-8")
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
