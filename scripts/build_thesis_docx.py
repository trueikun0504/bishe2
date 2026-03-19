from __future__ import annotations

import re
import sys
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape


NAMESPACES = (
    'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" '
    'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" '
    'xmlns:o="urn:schemas-microsoft-com:office:office" '
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
    'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" '
    'xmlns:v="urn:schemas-microsoft-com:vml" '
    'xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" '
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
    'xmlns:w10="urn:schemas-microsoft-com:office:word" '
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
    'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" '
    'xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" '
    'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" '
    'xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" '
    'xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" '
    'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" '
    'mc:Ignorable="w14 w15 wp14"'
)


def xml_text(text: str) -> str:
    return escape(text, {'"': "&quot;", "'": "&apos;"})


def split_inline_code(text: str) -> list[tuple[bool, str]]:
    parts: list[tuple[bool, str]] = []
    pattern = re.compile(r"`([^`]+)`")
    last = 0
    for match in pattern.finditer(text):
        if match.start() > last:
            parts.append((False, text[last:match.start()]))
        parts.append((True, match.group(1)))
        last = match.end()
    if last < len(text):
        parts.append((False, text[last:]))
    return parts or [(False, text)]


def make_run(
    text: str,
    *,
    bold: bool = False,
    font_size: int = 24,
    font_name: str = "宋体",
    ascii_font: str = "Times New Roman",
) -> str:
    pieces = []
    for is_code, chunk in split_inline_code(text):
        if not chunk:
            continue
        font = "Consolas" if is_code else font_name
        ascii_name = "Consolas" if is_code else ascii_font
        props = [
            f'<w:rFonts w:ascii="{ascii_name}" w:hAnsi="{ascii_name}" w:eastAsia="{font}" />',
            f'<w:sz w:val="{font_size}" />',
            f'<w:szCs w:val="{font_size}" />',
        ]
        if bold:
            props.append("<w:b />")
            props.append("<w:bCs />")
        if is_code:
            props.append('<w:highlight w:val="lightGray" />')
        text_xml = xml_text(chunk)
        if chunk.startswith(" ") or chunk.endswith(" "):
            pieces.append(f'<w:r><w:rPr>{"".join(props)}</w:rPr><w:t xml:space="preserve">{text_xml}</w:t></w:r>')
        else:
            pieces.append(f'<w:r><w:rPr>{"".join(props)}</w:rPr><w:t>{text_xml}</w:t></w:r>')
    return "".join(pieces) or (
        f'<w:r><w:rPr><w:rFonts w:ascii="{ascii_font}" w:hAnsi="{ascii_font}" w:eastAsia="{font_name}" />'
        f'<w:sz w:val="{font_size}" /><w:szCs w:val="{font_size}" /></w:rPr><w:t></w:t></w:r>'
    )


def make_paragraph(
    text: str = "",
    *,
    align: str | None = None,
    bold: bool = False,
    font_size: int = 24,
    indent: bool = True,
    space_before: int = 0,
    space_after: int = 120,
    line_spacing: int = 360,
    font_name: str = "宋体",
    ascii_font: str = "Times New Roman",
) -> str:
    ppr = [f'<w:spacing w:before="{space_before}" w:after="{space_after}" w:line="{line_spacing}" w:lineRule="auto" />']
    if indent:
        ppr.append('<w:ind w:firstLine="420" />')
    if align:
        ppr.append(f'<w:jc w:val="{align}" />')

    runs = []
    lines = text.split("\n") if text else [""]
    for idx, line in enumerate(lines):
        if idx > 0:
            runs.append("<w:r><w:br /></w:r>")
        runs.append(
            make_run(
                line,
                bold=bold,
                font_size=font_size,
                font_name=font_name,
                ascii_font=ascii_font,
            )
        )

    return f"<w:p><w:pPr>{''.join(ppr)}</w:pPr>{''.join(runs)}</w:p>"


def make_empty_paragraph(space_after: int = 120) -> str:
    return make_paragraph("", indent=False, space_after=space_after)


def make_page_break() -> str:
    return '<w:p><w:r><w:br w:type="page" /></w:r></w:p>'


def make_heading(text: str, level: int) -> str:
    size_map = {1: 36, 2: 32, 3: 28}
    return make_paragraph(
        text,
        align="left",
        bold=True,
        font_size=size_map.get(level, 28),
        indent=False,
        space_before=120,
        space_after=120,
        line_spacing=360,
        font_name="黑体",
        ascii_font="Times New Roman",
    )


def make_cover_line(text: str, *, size: int = 28, bold: bool = False) -> str:
    return make_paragraph(
        text,
        align="center",
        bold=bold,
        font_size=size,
        indent=False,
        space_after=140,
        line_spacing=360,
        font_name="宋体",
        ascii_font="Times New Roman",
    )


def make_table(headers: list[str], rows: list[list[str]]) -> str:
    tbl_pr = (
        "<w:tblPr>"
        '<w:tblW w:w="0" w:type="auto" />'
        "<w:tblBorders>"
        '<w:top w:val="single" w:sz="8" w:space="0" w:color="auto" />'
        '<w:left w:val="single" w:sz="8" w:space="0" w:color="auto" />'
        '<w:bottom w:val="single" w:sz="8" w:space="0" w:color="auto" />'
        '<w:right w:val="single" w:sz="8" w:space="0" w:color="auto" />'
        '<w:insideH w:val="single" w:sz="8" w:space="0" w:color="auto" />'
        '<w:insideV w:val="single" w:sz="8" w:space="0" w:color="auto" />'
        "</w:tblBorders>"
        "</w:tblPr>"
    )

    def cell(text: str, header: bool = False) -> str:
        para = make_paragraph(
            text,
            align="center" if header else "left",
            bold=header,
            font_size=22,
            indent=False,
            space_after=0,
            line_spacing=300,
            font_name="黑体" if header else "宋体",
            ascii_font="Times New Roman",
        )
        return f"<w:tc><w:tcPr><w:tcW w:w=\"2400\" w:type=\"dxa\" /></w:tcPr>{para}</w:tc>"

    rows_xml = ["<w:tr>" + "".join(cell(item, True) for item in headers) + "</w:tr>"]
    for row in rows:
        rows_xml.append("<w:tr>" + "".join(cell(item, False) for item in row) + "</w:tr>")
    return f"<w:tbl>{tbl_pr}{''.join(rows_xml)}</w:tbl>"


def split_table_row(line: str) -> list[str]:
    return [part.strip() for part in line.strip().strip("|").split("|")]


def is_table_separator(line: str) -> bool:
    stripped = line.strip()
    if "|" not in stripped:
        return False
    content = stripped.strip("|").replace(" ", "")
    return bool(content) and all(ch in "-:|" for ch in stripped)


def render_table(lines: list[str], start: int) -> tuple[str, int]:
    headers = split_table_row(lines[start])
    rows: list[list[str]] = []
    index = start + 2
    while index < len(lines):
        line = lines[index]
        if not line.strip() or "|" not in line:
            break
        rows.append(split_table_row(line))
        index += 1
    return make_table(headers, rows), index


def render_list(lines: list[str], start: int, ordered: bool) -> tuple[str, int]:
    pattern = r"^\s*\d+\.\s+(.*)$" if ordered else r"^\s*[-*]\s+(.*)$"
    blocks: list[str] = []
    index = start
    while index < len(lines):
        match = re.match(pattern, lines[index])
        if not match:
            break
        prefix = f"{index - start + 1}. " if ordered else "• "
        blocks.append(
            make_paragraph(
                prefix + match.group(1).strip(),
                indent=False,
                font_size=24,
                space_after=80,
            )
        )
        index += 1
    return "".join(blocks), index


def render_code_block(code_lines: list[str]) -> str:
    return make_paragraph(
        "\n".join(code_lines),
        indent=False,
        font_size=20,
        font_name="Consolas",
        ascii_font="Consolas",
        space_after=120,
        line_spacing=280,
    )


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
        buffer.append(line.strip())
        index += 1

    text = "\n".join(buffer)
    indent = not any("签名" in item or "日期" in item or "日 期" in item for item in buffer)
    return make_paragraph(text, indent=indent), index


def render_markdown(section_text: str) -> str:
    lines = section_text.splitlines()
    blocks: list[str] = []
    index = 0
    in_code = False
    code_buffer: list[str] = []

    while index < len(lines):
        line = lines[index].rstrip("\n")

        if in_code:
            if line.strip().startswith("```"):
                blocks.append(render_code_block(code_buffer))
                in_code = False
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
            index += 1
            continue

        heading = re.match(r"^\s*(#{1,3})\s+(.*)$", line)
        if heading:
            blocks.append(make_heading(heading.group(2).strip(), len(heading.group(1))))
            index += 1
            continue

        if "|" in line and index + 1 < len(lines) and is_table_separator(lines[index + 1]):
            table_xml, index = render_table(lines, index)
            blocks.append(table_xml)
            continue

        if re.match(r"^\s*\d+\.\s+", line):
            list_xml, index = render_list(lines, index, True)
            blocks.append(list_xml)
            continue

        if re.match(r"^\s*[-*]\s+", line):
            list_xml, index = render_list(lines, index, False)
            blocks.append(list_xml)
            continue

        para_xml, index = render_paragraph(lines, index)
        blocks.append(para_xml)

    return "".join(blocks)


def render_cover(section_text: str, secondary: bool = False) -> str:
    lines = [line.strip() for line in section_text.splitlines() if line.strip()]
    blocks: list[str] = []
    blocks.extend(make_empty_paragraph(240) for _ in range(2 if secondary else 1))

    for idx, line in enumerate(lines):
        if line.startswith("# "):
            title = line[2:].strip()
            if idx == 0:
                blocks.append(make_cover_line(title, size=32 if secondary else 30, bold=True))
            else:
                blocks.append(make_cover_line(title, size=40 if secondary else 36, bold=True))
        else:
            blocks.append(make_cover_line(line, size=26 if secondary else 24, bold=False))

    return "".join(blocks)


def extract_sect_pr(template_docx: Path) -> str:
    with zipfile.ZipFile(template_docx, "r") as zf:
        xml_text_raw = zf.read("word/document.xml").decode("utf-8")
    match = re.search(r"(<w:sectPr[\s\S]*?</w:sectPr>)", xml_text_raw)
    if match:
        return match.group(1)
    return (
        "<w:sectPr>"
        '<w:pgSz w:w="11906" w:h="16838" />'
        '<w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800" '
        'w:header="851" w:footer="992" w:gutter="0" />'
        "</w:sectPr>"
    )


def build_document_xml(markdown_text: str, sect_pr: str) -> str:
    sections = re.split(r"(?m)^\s*---\s*$", markdown_text)
    body_blocks: list[str] = []

    for idx, raw_section in enumerate(sections):
        section = raw_section.strip()
        if not section:
            continue
        if idx == 0:
            body_blocks.append(render_cover(section, secondary=False))
        elif idx == 1:
            body_blocks.append(render_cover(section, secondary=True))
        else:
            body_blocks.append(render_markdown(section))
        body_blocks.append(make_page_break())

    if body_blocks:
        body_blocks.pop()

    body_blocks.append(sect_pr)
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f"<w:document {NAMESPACES}><w:body>{''.join(body_blocks)}</w:body></w:document>"
    )


def build_docx_from_template(input_md: Path, output_docx: Path, template_docx: Path) -> None:
    markdown_text = input_md.read_text(encoding="utf-8")
    sect_pr = extract_sect_pr(template_docx)
    document_xml = build_document_xml(markdown_text, sect_pr)

    with zipfile.ZipFile(template_docx, "r") as src, zipfile.ZipFile(output_docx, "w", zipfile.ZIP_DEFLATED) as dst:
        for item in src.infolist():
            if item.filename == "word/document.xml":
                continue
            dst.writestr(item, src.read(item.filename))
        dst.writestr("word/document.xml", document_xml.encode("utf-8"))


def main() -> int:
    if len(sys.argv) != 4:
        print("Usage: py -3 build_thesis_docx.py <input_md> <output_docx> <template_docx>")
        return 1

    input_md = Path(sys.argv[1])
    output_docx = Path(sys.argv[2])
    template_docx = Path(sys.argv[3])
    build_docx_from_template(input_md, output_docx, template_docx)
    print(output_docx)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
