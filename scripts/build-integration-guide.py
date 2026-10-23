#!/usr/bin/env python3
"""Build the client guide and handoff archive from the maintained Markdown.

Requires Python 3 and reportlab. No network or production access.
"""
from pathlib import Path
import html
import re
import zipfile

import reportlab
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    Preformatted,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/integration/INTEGRATION_API_FR.md'
OUTPUT = ROOT / 'output/pdf/ApisnixPhone-API-Guide-integration-FR.pdf'
ARCHIVE = ROOT / 'output/ApisnixPhone-API-Kit-integration-FR.zip'
FONT_DIR = Path(reportlab.__file__).parent / 'fonts'
for name, filename in [('Guide', 'Vera.ttf'), ('GuideBold', 'VeraBd.ttf'), ('GuideItalic', 'VeraIt.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / filename)))
pdfmetrics.registerFontFamily('Guide', normal='Guide', bold='GuideBold', italic='GuideItalic')

INK = colors.HexColor('#16233c')
GREEN = colors.HexColor('#08745c')
MUTED = colors.HexColor('#52637b')
WIDTH, HEIGHT = A4
CONTENT_WIDTH = WIDTH - 100
styles = {
    'body': ParagraphStyle('Body', fontName='Guide', fontSize=9.2, leading=12.3,
                           textColor=INK, spaceAfter=6, splitLongWords=True),
    'h1': ParagraphStyle('Title', fontName='GuideBold', fontSize=31, leading=37,
                         textColor=INK, spaceBefore=40, spaceAfter=20),
    'h2': ParagraphStyle('Section', fontName='GuideBold', fontSize=18, leading=23,
                         textColor=INK, spaceAfter=12, keepWithNext=True),
    'h3': ParagraphStyle('Subsection', fontName='GuideBold', fontSize=11, leading=15,
                         textColor=GREEN, spaceBefore=7, spaceAfter=5, keepWithNext=True),
    'cell': ParagraphStyle('Cell', fontName='Guide', fontSize=8.6, leading=11.5,
                           textColor=INK, spaceAfter=0),
    'head': ParagraphStyle('Head', fontName='GuideBold', fontSize=8.6, leading=11.5,
                           textColor=colors.white),
    'code': ParagraphStyle('Code', fontName='Courier', fontSize=7.7, leading=9.4,
                           textColor=INK, backColor=colors.HexColor('#f0f4f8'),
                           borderPadding=9, spaceBefore=4, spaceAfter=10),
}


def inline(text):
    # Keep the converter deliberately small: only the syntax used in this guide.
    text = html.escape(text)
    text = re.sub(r'`([^`]+)`', r'<font name="Courier">\1</font>', text)
    return re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)


def para(text, style='body'):
    return Paragraph(inline(text), styles[style])


def page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(GREEN)
    canvas.rect(50, HEIGHT - 36, 22, 3, fill=1, stroke=0)
    canvas.setFont('GuideBold', 8)
    canvas.setFillColor(INK)
    canvas.drawString(80, HEIGHT - 36, 'APISNIXPHONE API')
    canvas.setFont('Guide', 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(WIDTH - 50, HEIGHT - 36, 'INTÉGRATION CLIENT / ÉDITION 1.0')
    canvas.setStrokeColor(colors.HexColor('#d7e0e9'))
    canvas.line(50, 39, WIDTH - 50, 39)
    canvas.setFont('Guide', 7.5)
    canvas.drawString(50, 25, '23 octobre 2026  •  SDK navigateur v1')
    canvas.drawRightString(WIDTH - 50, 25, str(doc.page))
    canvas.restoreState()


def build():
    lines = SOURCE.read_text().splitlines()
    story = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line == '<!-- pagebreak -->':
            story.append(PageBreak())
            i += 1
            continue
        if line.startswith('```'):
            code = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                code.append(lines[i])
                i += 1
            for code_line in code:
                if pdfmetrics.stringWidth(code_line, 'Courier', 7.7) > CONTENT_WIDTH - 18:
                    raise ValueError(f'Code line too wide: {code_line}')
            story.append(Preformatted('\n'.join(code), styles['code']))
            i += 1
            continue
        if line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                cells = [s.strip() for s in lines[i].strip('|').split('|')]
                if not all(re.fullmatch(r'[- :]+', s) for s in cells):
                    rows.append([para(s, 'head' if not rows else 'cell') for s in cells])
                i += 1
            table = Table(rows, colWidths=[CONTENT_WIDTH * .36, CONTENT_WIDTH * .64],
                          repeatRows=1, hAlign='LEFT')
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), INK),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#f0f4f8'), colors.white]),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 9),
                ('RIGHTPADDING', (0, 0), (-1, -1), 9),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('LINEBELOW', (0, -1), (-1, -1), .5, colors.HexColor('#d7e0e9')),
            ]))
            story.extend([table, Spacer(1, 8)])
            continue
        heading = re.match(r'^(#{1,3}) (.*)', line)
        if heading:
            story.append(para(heading[2], f'h{len(heading[1])}'))
            i += 1
            continue
        if re.match(r'^(- |\d+\. )', line):
            story.append(para(line))
            i += 1
            continue
        paragraph = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r'^(#|\||```|<!--|- |\d+\. )', lines[i]):
            paragraph.append(lines[i])
            i += 1
        story.append(para(' '.join(paragraph)))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4, rightMargin=44, leftMargin=44,
                            topMargin=55, bottomMargin=45,
                            title='ApisnixPhone API - Guide technique d’intégration client',
                            author='APISNIX', subject='SDK navigateur v1 - Édition 1.0',
                            invariant=1)
    doc.build(story, onFirstPage=page, onLaterPages=page)
    files = [(OUTPUT, OUTPUT.name), (SOURCE, SOURCE.name)]
    files.extend((path, 'exemple/' + path.name) for path in sorted((SOURCE.parent / 'exemple').iterdir()) if path.is_file())
    with zipfile.ZipFile(ARCHIVE, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for path, name in files:
            info = zipfile.ZipInfo(name, date_time=(2026, 10, 23, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, path.read_bytes())
    print(OUTPUT.relative_to(ROOT))
    print(ARCHIVE.relative_to(ROOT))


if __name__ == '__main__':
    build()
