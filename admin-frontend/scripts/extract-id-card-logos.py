"""Extract official vector emblems from published reports, without rasterizing.

Source PDFs are downloaded separately into scratch/id-card-logo-sources.
PyMuPDF is only needed for this offline preparation step, not at runtime.
"""
from pathlib import Path
import pymupdf as pdf

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "scratch/id-card-logo-sources"
OUT = ROOT / "admin-frontend/src/assets/id-card/logos"
OUT.mkdir(parents=True, exist_ok=True)


def extract(name, filename, page_number, coordinates):
    with pdf.open(SOURCE / filename) as document:
        page = document[page_number]
        clip = pdf.Rect(coordinates)
        w, h = page.rect.width, page.rect.height
        # Remove outside content, including report backgrounds that cross the
        # boundary. Unlike simple clipping, unrelated images are not embedded.
        for rect in [(0, 0, w, clip.y0), (0, clip.y1, w, h),
                     (0, clip.y0, clip.x0, clip.y1), (clip.x1, clip.y0, w, clip.y1)]:
            page.add_redact_annot(pdf.Rect(rect), fill=False)
        page.apply_redactions(images=1, graphics=2, text=0)
        page.set_cropbox(clip)
        svg = page.get_svg_image(text_as_path=True)
        # Preserve the crop even in PDF renderers that ignore root viewBox clipping.
        boundary = f'<defs><clipPath id="logo-boundary"><rect width="{clip.width}" height="{clip.height}"/></clipPath></defs>'
        offset = svg.index(">") + 1
        svg = svg[:offset] + boundary + '<g clip-path="url(#logo-boundary)">' + svg[offset:svg.rfind("</svg>")] + '</g></svg>'
        (OUT / f"{name}.svg").write_text(svg, encoding="utf-8")
        page.get_pixmap(matrix=pdf.Matrix(6, 6), alpha=False).save(str(SOURCE / f"{name}-vector.png"))
        print(name, len(svg), "bytes", len(page.get_image_info()), "embedded images")


extract("ioag", "ioag-old-report.pdf", 0, (454, 28, 536, 106))
extract("bgcl", "bgcl-report.pdf", 3, (51, 17, 87, 63))

# Use the official AGL emblem's two white paths in the supplied square lockup.
# The PDF header has an additional frame, which is not part of the ID template.
with pdf.open(SOURCE / "avantika-report.pdf") as document:
    paths = []
    for drawing in document[3].get_drawings():
        if not drawing["rect"].intersects(pdf.Rect(46, 21, 65, 43)):
            continue
        if not drawing.get("fill") or min(drawing["fill"]) < .99:
            continue
        commands = []
        for item in drawing["items"]:
            if not commands:
                commands.append(f'M{item[1].x} {item[1].y}')
            if item[0] == "l":
                commands.append(f'L{item[2].x} {item[2].y}')
            elif item[0] == "c":
                commands.append('C' + ' '.join(f'{point.x} {point.y}' for point in item[2:]))
        paths.append('<path d="' + ' '.join(commands) + ' Z"/>')
    assert len(paths) == 2, "Official AGL emblem paths changed; inspect before rebuilding"
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">'
    svg += '<rect width="96" height="96" fill="#499c50"/>'
    svg += '<g fill="white" transform="matrix(4 0 0 4 -176 -88)">' + ''.join(paths) + '</g>'
    svg += '<g fill="white" font-family="Helvetica,sans-serif">'
    for title, y, size in [("AAVANTIKA GAS LIMITED", 85, 5.2), ("A JV Company of GAIL & HPCL", 91, 3.4)]:
        x = (96 - pdf.get_text_length(title, fontname="helv", fontsize=size)) / 2
        svg += f'<text x="{x}" y="{y}" font-size="{size}">{title.replace("&", "&amp;")}</text>'
    svg += '</g></svg>'
    (OUT / "avantika-symbol.svg").write_text(svg, encoding="utf-8")
