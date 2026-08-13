"""Subset the licensed TTF sources into web-ready WOFF2 files.

The design uses Plateia Bold for display type and Disket Mono for technical
labels. Both ship as full TTFs, which are far too heavy to serve directly, so
they are subset to the character sets the site actually renders (Latin plus
Cyrillic for the Bulgarian locale) and recompressed as WOFF2.

Requires: pip install fonttools brotli
Run: python scripts/build-fonts.py
"""

from __future__ import annotations

from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "src/assets/fonts"
OUT_DIR = ROOT / "src/assets/generated"

SOURCES = {
    "PLATEIABOLD-LQ6W.TTF": "plateia-bold.woff2",
    "DISKET-MONO-REGULAR.TTF": "disket-mono-regular.woff2",
}

# Basic Latin + Latin-1 punctuation + Cyrillic, which covers both locales.
UNICODES = "U+0020-007E,U+00A0-00FF,U+0400-045F,U+2010-2027,U+20AC"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for source_name, out_name in SOURCES.items():
        source = SRC_DIR / source_name
        out = OUT_DIR / out_name

        subset.main(
            [
                str(source),
                f"--unicodes={UNICODES}",
                "--layout-features=*",
                "--flavor=woff2",
                f"--output-file={out}",
            ]
        )
        print(
            f"{out.name}: {source.stat().st_size / 1024:.1f} KB"
            f" -> {out.stat().st_size / 1024:.1f} KB"
        )


if __name__ == "__main__":
    main()
