#!/usr/bin/env python3
"""Build the branded client PDF and ZIP. Requires ReportLab; no network access."""
from io import BytesIO
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
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Flowable, KeepInFrame

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/integration/INTEGRATION_API_FR.md'
LOGO = ROOT / 'branding/apisnix-mark.png'
OUTPUT = ROOT / 'output/pdf/ApisnixPhone-API-Guide-integration-FR.pdf'
ARCHIVE = ROOT / 'output/ApisnixPhone-API-Kit-integration-FR.zip'
FONT_DIR = Path(reportlab.__file__).parent / 'fonts'
for name, filename in [('Guide', 'Vera.ttf'), ('GuideBold', 'VeraBd.ttf'), ('GuideItalic', 'VeraIt.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / filename)))
pdfmetrics.registerFontFamily('Guide', normal='Guide', bold='GuideBold', italic='GuideItalic')
INK, NAVY, BLUE, YELLOW, MUTED, PALE, LINE = map(colors.HexColor,
    ['#17213b', '#10162e', '#1010ff', '#f3ee00', '#59657b', '#f3f4ff', '#dde2ef'])
WIDTH, HEIGHT = A4
LEFT = 49
CONTENT_WIDTH = WIDTH - 2 * LEFT
GROUPS = {1: 'ACTIVATION', 2: 'INSTALLATION', 3: 'RÉFÉRENCE SDK', 4: 'RÉFÉRENCE SDK',
          5: 'RÉFÉRENCE SDK', 6: 'DONNÉES CRM', 7: 'SÉCURITÉ', 8: 'SESSIONS & ENVIRONNEMENT',
          9: 'APPLICATIONS DYNAMIQUES', 10: 'ASSISTANCE', 11: 'VALIDATION', 12: 'LIVRAISON'}
styles = {
    'body': ParagraphStyle('Body', fontName='Guide', fontSize=9.4, leading=12.9, textColor=INK, spaceAfter=7),
    'intro': ParagraphStyle('Intro', fontName='GuideBold', fontSize=24, leading=29, textColor=INK, spaceAfter=18, keepWithNext=True),
    'h3': ParagraphStyle('Subsection', fontName='GuideBold', fontSize=11, leading=15, textColor=INK, spaceBefore=8, spaceAfter=6, keepWithNext=True),
    'cell': ParagraphStyle('Cell', fontName='Guide', fontSize=8.9, leading=11.8, textColor=INK),
    'head': ParagraphStyle('Head', fontName='GuideBold', fontSize=8.5, leading=12, textColor=colors.white),
    'bullet': ParagraphStyle('Bullet', fontName='Guide', fontSize=9.4, leading=12.9, textColor=INK, leftIndent=14, firstLineIndent=-14, spaceAfter=7),
    'callout': ParagraphStyle('Callout', fontName='Guide', fontSize=9.4, leading=13.4, textColor=INK),
}


def inline(text):
    text = html.escape(text)
    text = re.sub(r'`([^`]+)`', r'<font name="Courier" color="#302aad">\1</font>', text)
    return re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)


def para(text, style='body'):
    return Paragraph(inline(text), styles[style])


class SectionTitle(Flowable):
    def __init__(self, number, title, continuation=False):
        super().__init__()
        self.number, self.title, self.continuation = number, title, continuation
        self.keepWithNext, self.spaceAfter = True, 10
        self.label = Paragraph(html.escape(title), ParagraphStyle('SectionTitle',
            fontName='GuideBold', fontSize=18.5, leading=22, textColor=INK))

    def wrap(self, width, height):
        _, self.title_height = self.label.wrap(width - 54, height)
        self.width, self.height = width, self.title_height + 18
        return self.width, self.height

    def draw(self):
        c = self.canv
        c.setFillColor(BLUE)
        c.setFont('GuideBold', 28)
        c.drawString(0, self.height - 40, f'{self.number:02}')
        c.setFillColor(MUTED)
        c.setFont('GuideBold', 7.5)
        c.drawString(54, self.height - 7, GROUPS[self.number] + (' / SUITE' if self.continuation else ''))
        self.label.drawOn(c, 54, 0)


class CodeBlock(Flowable):
    """Selectable code on a real background, preserving indentation and text."""
    def __init__(self, lines, language, continuation=False):
        super().__init__()
        self.lines, self.language, self.continuation = lines, language, continuation
        self.font_size, self.leading = 8.0, 9.5
        self.spaceBefore, self.spaceAfter = 5, 12

    def wrap(self, width, height):
        longest = max((pdfmetrics.stringWidth(s, 'Courier', self.font_size) for s in self.lines), default=0)
        if longest > width - 28:
            raise ValueError(f'Code line too wide ({longest:.1f}): {max(self.lines, key=len)}')
        self.width, self.height = width, 35 + len(self.lines) * self.leading
        return self.width, self.height

    def split(self, width, height):
        count = int((height - 35) / self.leading)
        if count < 6 or len(self.lines) - count < 4:
            return []
        return [CodeBlock(self.lines[:count], self.language, self.continuation),
                CodeBlock(self.lines[count:], self.language, True)]

    def draw(self):
        c = self.canv
        c.setFillColor(PALE)
        c.setStrokeColor(LINE)
        c.setLineWidth(.5)
        c.roundRect(0, 0, self.width, self.height, 7, fill=1, stroke=1)
        c.setFillColor(BLUE)
        c.setFont('GuideBold', 7)
        language = {'js': 'JAVASCRIPT', 'jsx': 'REACT / JSX', 'html': 'HTML', 'text': 'CONFIGURATION'}.get(self.language, self.language.upper())
        c.drawString(14, self.height - 17, language + (' / SUITE' if self.continuation else ''))
        c.setStrokeColor(LINE)
        c.line(14, self.height - 25, self.width - 14, self.height - 25)
        for index, line in enumerate(self.lines):
            c.setFont('Courier', self.font_size)
            c.setFillColor(MUTED if line.lstrip().startswith('//') else INK)
            c.drawString(14, self.height - 33 - index * self.leading, line)


class GuideDoc(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, KeepInFrame):
            scale = getattr(flowable, '_scale', 1)
            if scale > 1.12:
                raise ValueError(f'Chapter needs repagination (scale {scale:.3f})')
        if isinstance(flowable, SectionTitle) and not flowable.continuation:
            key = f'section-{flowable.number}'
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(f'{flowable.number:02}  {flowable.title}', key, level=0)


def draw_paragraph(canvas, text, x, top, width, size=10, color=INK, bold=False):
    p = Paragraph(html.escape(text), ParagraphStyle('CanvasText', fontName='GuideBold' if bold else 'Guide',
        fontSize=size, leading=size * 1.45, textColor=color))
    _, height = p.wrap(width, HEIGHT)
    p.drawOn(canvas, x, top - height)


def cover(c, doc):
    c.saveState()
    c.setFillColor(NAVY)
    c.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)
    c.setStrokeColor(colors.HexColor('#242c50'))
    c.setLineWidth(.7)
    for offset in range(4):
        c.roundRect(WIDTH - 145 + offset * 30, 410 + offset * 30, 210, 270, 35, stroke=1, fill=0)
    c.setFillColor(colors.white)
    c.roundRect(LEFT, 684, 100, 100, 16, fill=1, stroke=0)
    c.drawImage(str(LOGO), LEFT + 5, 689, width=90, height=90, mask='auto')
    c.setFont('GuideBold', 16)
    c.drawString(171, 743, 'APISNIXPHONE API')
    c.setFillColor(colors.HexColor('#b5c1d9'))
    c.setFont('Guide', 9)
    c.drawString(172, 722, 'DOCUMENTATION DÉVELOPPEUR')
    c.setFillColor(YELLOW)
    c.roundRect(LEFT, 653, 44, 4, 2, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont('GuideBold', 39)
    c.drawString(LEFT, 592, 'Intégrez')
    c.setFont('GuideBold', 35)
    c.drawString(LEFT, 542, 'ApisnixPhone API')
    c.drawString(LEFT, 492, 'à votre CRM.')
    draw_paragraph(c, "Guide technique d'intégration client", LEFT, 455, 460, 15, colors.HexColor('#d3dbeb'))
    c.setFont('GuideBold', 10)
    c.setFillColor(YELLOW)
    c.drawString(LEFT, 406, 'SDK NAVIGATEUR V1  /  ACCÈS PAR PHONE')
    card_width = (CONTENT_WIDTH - 30) / 3
    for index, (title, subtitle) in enumerate([('Votre CRM', 'Contacts & activités'),
            ('SDK v1', 'Commandes & événements'), ('ApisnixPhone', 'Téléphonie intégrée')]):
        x = LEFT + index * (card_width + 15)
        c.setFillColor(colors.HexColor('#1c2442'))
        c.setStrokeColor(colors.HexColor('#343e60'))
        c.roundRect(x, 306, card_width, 65, 9, fill=1, stroke=1)
        c.setFont('GuideBold', 10)
        c.setFillColor(colors.white)
        c.drawString(x + 12, 345, title)
        c.setFont('Guide', 7.5)
        c.setFillColor(colors.HexColor('#b5c1d9'))
        c.drawString(x + 12, 327, subtitle)
        if index < 2:
            c.setStrokeColor(YELLOW)
            c.line(x + card_width + 3, 338, x + card_width + 12, 338)
    c.setFillColor(colors.white)
    c.roundRect(35, 56, WIDTH - 70, 217, 16, fill=1, stroke=0)
    draw_paragraph(c, "De l'activation à la mise en service", LEFT + 10, 248, 460, 17, INK, True)
    for y, number, label in [(195, 1, 'Autoriser votre CRM et connecter les agents'),
                            (160, 3, 'Intégrer le SDK et exploiter ses événements'),
                            (125, 11, 'Vérifier la sécurité et valider les appels')]:
        c.setFillColor(BLUE)
        c.setFont('GuideBold', 9)
        c.drawString(LEFT + 10, y, f'{number:02}')
        c.setFillColor(INK)
        c.setFont('Guide', 9.5)
        c.drawString(LEFT + 39, y, label)
        c.linkRect('', f'section-{number}', (LEFT + 8, y - 5, WIDTH - LEFT - 8, y + 14), relative=0, thickness=0)
    c.setStrokeColor(LINE)
    c.line(LEFT + 10, 105, WIDTH - LEFT - 10, 105)
    c.setFillColor(MUTED)
    c.setFont('Guide', 8)
    c.drawString(LEFT + 10, 82, 'Édition 1.0  •  23 octobre 2026')
    c.drawRightString(WIDTH - LEFT - 10, 82, 'Guide client / Français')
    c.restoreState()


def page(c, doc, total):
    c.saveState()
    c.drawImage(str(LOGO), LEFT - 3, HEIGHT - 51, width=34, height=34, mask='auto')
    c.setFont('GuideBold', 8)
    c.setFillColor(INK)
    c.drawString(LEFT + 41, HEIGHT - 34, 'APISNIXPHONE API')
    c.setFont('Guide', 7.3)
    c.setFillColor(MUTED)
    c.drawRightString(WIDTH - LEFT, HEIGHT - 34, "GUIDE D'INTÉGRATION  /  V1")
    c.setStrokeColor(LINE)
    c.setLineWidth(.5)
    c.line(LEFT, HEIGHT - 57, WIDTH - LEFT, HEIGHT - 57)
    c.line(LEFT, 42, WIDTH - LEFT, 42)
    c.setFillColor(BLUE)
    c.rect(LEFT, 41, 26, 2, fill=1, stroke=0)
    c.setFont('Guide', 7.3)
    c.setFillColor(MUTED)
    c.drawString(LEFT, 26, 'APISNIX  •  Documentation technique client')
    c.setFont('GuideBold', 8)
    c.setFillColor(INK)
    c.drawRightString(WIDTH - LEFT, 26, f'{doc.page:02} / {total:02}')
    c.restoreState()


def callout(text):
    table = Table([[para(text, 'callout')]], colWidths=[CONTENT_WIDTH])
    table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), PALE),
        ('LINEBEFORE', (0, 0), (0, -1), 3, BLUE), ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12), ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10)]))
    table.spaceAfter = 10
    return table


def make_story():
    lines = SOURCE.read_text().splitlines()
    story = [Spacer(1, 1), PageBreak()]
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
            language, code = line[3:], []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                code.append(lines[i])
                i += 1
            story.append(CodeBlock(code, language))
            i += 1
            continue
        if line.startswith('|'):
            if line.startswith('| Valeur actuelle de connection'):
                story.extend([PageBreak(), SectionTitle(4, 'États de la ligne et résultats', continuation=True)])
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                cells = [s.strip() for s in lines[i].strip('|').split('|')]
                if not all(re.fullmatch(r'[- :]+', s) for s in cells):
                    rows.append([para(s, 'head' if not rows else 'cell') for s in cells])
                i += 1
            table = Table(rows, colWidths=[CONTENT_WIDTH * .36, CONTENT_WIDTH * .64], repeatRows=1, hAlign='LEFT')
            table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), NAVY),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#f6f7fc'), colors.white]),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10), ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4), ('LINEBELOW', (0, 0), (-1, 0), 2, BLUE),
                ('LINEBELOW', (0, 1), (-1, -1), .3, LINE)]))
            story.extend([table, Spacer(1, 10)])
            continue
        heading = re.match(r'^(#{1,3}) (.*)', line)
        if heading:
            level, title = len(heading[1]), heading[2]
            if level == 1:
                story.append(para("Votre guide d'intégration", 'intro'))
            elif level == 2:
                match = re.match(r'(\d+)\. (.*)', title)
                if match:
                    story.append(SectionTitle(int(match[1]), match[2]))
            else:
                story.append(para(title, 'h3'))
            i += 1
            continue
        if line.startswith('- '):
            story.append(para('•  ' + line[2:], 'bullet'))
            i += 1
            continue
        if re.match(r'^\d+\. ', line):
            story.append(para(line, 'bullet'))
            i += 1
            continue
        paragraph = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r'^(#|\||```|<!--|- |\d+\. )', lines[i]):
            paragraph.append(lines[i])
            i += 1
        text = ' '.join(paragraph)
        story.append(callout(text) if text.startswith(('**Service :**', '**Module JavaScript :**')) else para(text))
    # Keep each short chapter on its intended page. Only modest scaling is
    # allowed; an expanded chapter must be repaginated rather than made tiny.
    pages = [[]]
    for item in story:
        if isinstance(item, PageBreak):
            pages.append([])
        else:
            pages[-1].append(item)
    fitted = []
    for index, items in enumerate(pages):
        if index:
            fitted.append(PageBreak())
        if items and isinstance(items[0], SectionTitle):
            title, body = items[0], items[1:]
            _, title_height = title.wrap(CONTENT_WIDTH, HEIGHT)
            available = HEIGHT - 68 - 50 - 12 - title_height - title.spaceAfter
            frame = KeepInFrame(CONTENT_WIDTH, available, body, mode='shrink', hAlign='LEFT', vAlign='TOP')
            fitted.extend([title, frame])
        else:
            fitted.extend(items)
    return fitted


def render(target, total):
    doc = GuideDoc(target, pagesize=A4, rightMargin=LEFT - 6, leftMargin=LEFT - 6,
        topMargin=68, bottomMargin=50, title='ApisnixPhone API - Guide technique d’intégration client',
        author='APISNIX', subject='SDK navigateur v1 - Édition 1.0', invariant=1)
    doc.build(make_story(), onFirstPage=cover, onLaterPages=lambda c, doc: page(c, doc, total))
    return doc.page


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    # Two passes preserve valid bookmarks and links while adding the page total.
    total = render(BytesIO(), 0)
    assert render(str(OUTPUT), total) == total
    files = [(OUTPUT, OUTPUT.name), (SOURCE, SOURCE.name)]
    files.extend((p, 'exemple/' + p.name) for p in sorted((SOURCE.parent / 'exemple').iterdir()) if p.is_file())
    with zipfile.ZipFile(ARCHIVE, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for path, name in files:
            info = zipfile.ZipInfo(name, date_time=(2026, 10, 23, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, path.read_bytes())
    print(f'{OUTPUT.relative_to(ROOT)} ({total} pages)')
    print(ARCHIVE.relative_to(ROOT))


if __name__ == '__main__':
    build()
