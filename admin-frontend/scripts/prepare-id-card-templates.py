"""Build clean vector card artwork from the six supplied PDFs (requires PyMuPDF).

Run from the repository root. Sample portraits and personal fields are redacted
before export so they are not recoverable from the shipped artwork.
The original PDFs are never modified. This is an offline asset preparation step.
"""
from pathlib import Path
import pymupdf as pdf

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "admin-frontend/src/assets/id-card"
LOGOS = OUT / "logos"
CLIENT_LOGOS = {
    "north_star_avantika": ("avantika-symbol.svg", (73.25, 209.86, 108.16, 244.77)),
    "north_star_bgcl": ("bgcl.svg", (70.5, 203, 111.5, 247)),
    "north_star_ioag": ("ioag.svg", (75, 206, 107, 238)),
    "north_star_iocl": ("iocl.svg", (76.5, 207.45, 104, 240.15)),
}
FILES = {
    "north_star_avantika": "AVANTIKA GAS ID CARD format (NORTH STAR) format id.pdf",
    "north_star_bgcl": "BGCL North Star format id.pdf",
    "north_star_ioag": "IOAG format (NORTH STAR) format id.pdf",
    "north_star_iocl": "IOCL Gas ID CARD format (NORTH STAR) format id.pdf",
    "green_call": "green call format id.pdf",
    "talent_foundation": "Talent Foundation Format id.pdf",
}


def masks(brand, side):
    if brand.startswith("north_star"):
        if side == "front":
            return [(58, 59, 123.5, 132.5), (16, 141, 173, 154),
                    (16, 180, 170, 191), (16, 194, 172, 202)]
        # Retain the fixed company helpline and address, replace personal data.
        return [(24, 132, 172, 155)]
    if brand == "green_call":
        return ([(59, 62, 124, 136), (17, 153, 171, 166), (17, 180, 170, 192)]
                if side == "front" else [(32, 139, 165, 160)])
    return ([(56, 80, 126, 153), (30, 169, 154, 184),
             (40, 186, 149, 198), (40, 203, 149, 214)]
            if side == "front" else [(27, 157, 160, 183)])


OUT.mkdir(parents=True, exist_ok=True)
for brand, filename in FILES.items():
    with pdf.open(ROOT / filename) as document:
        assert len(document) == 2, filename
        for index, side in enumerate(("front", "back")):
            page = document[index]
            for coordinates in masks(brand, side):
                page.add_redact_annot(pdf.Rect(coordinates), fill=(1, 1, 1))
            if side == "front" and brand in CLIENT_LOGOS:
                page.add_redact_annot(pdf.Rect(63, 202.8, 119, 246), fill=(1, 1, 1))
            # Also remove outlined text and pixels intersecting the redactions.
            page.apply_redactions(images=2, graphics=2, text=0)
            if side == "front" and brand in CLIENT_LOGOS:
                logo, box = CLIENT_LOGOS[brand]
                with pdf.open(LOGOS / logo) as vector:
                    with pdf.open("pdf", vector.convert_to_pdf()) as stamp:
                        page.show_pdf_page(pdf.Rect(box), stamp, 0, keep_proportion=True)
            height = 255 if brand == "talent_foundation" else 262
            clip = page.rect if brand.startswith("north_star") else pdf.Rect(0, 0, 182.5, height)
            page.set_cropbox(clip)
            target = OUT / f"{brand}-{side}.svg"
            target.write_text(page.get_svg_image(text_as_path=True), encoding="utf-8")
            print(f"{target.name}: vector paths, {target.stat().st_size} bytes")
