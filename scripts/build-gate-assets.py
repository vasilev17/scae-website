"""Script to bake the gate-reveal artwork exported from Figma into web-ready assets.

Figma stacks three fills on each gate pane: a linear gradient, a "detail" metal
photo at 6% opacity, and a "main" metal photo at 20% opacity. CSS backgrounds
have no per-layer opacity, so the two photos are flattened here into a single
RGBA texture whose alpha carries those opacities. The gradient stays in CSS so
it can stretch to any viewport without distorting.

The full-resolution source photos are base64-embedded inside the pane SVG that
Figma produced, so they are read from there rather than from the downscaled
PNG exports.

Run: python scripts/build-gate-assets.py
"""

from __future__ import annotations

import base64
import re
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PANE_SVG = ROOT / "src/assets/images/gate-pane-top.svg"
LOGO_SVG = ROOT / "src/assets/logos/scae-logo.svg"
OUT_DIR = ROOT / "src/assets/generated"

# Fill opacities as authored in Figma, bottom layer first.
DETAIL_OPACITY = 0.06
MAIN_OPACITY = 0.20

# The pane is ~1920x540 on the reference frame and the texture is stretched to
# fill it, so the bake is pre-squashed to that aspect ratio.
TEXTURE_SIZE = (1600, 450)
TEXTURE_QUALITY = 80
LOGO_SIZE = 1024
LOGO_QUALITY = 90


def embedded_images(svg_path: Path) -> list[Image.Image]:
    svg = svg_path.read_text(encoding="utf-8")
    out = []
    for match in re.finditer(r'xlink:href="data:image/[a-z+]+;base64,([^"]+)"', svg):
        out.append(Image.open(BytesIO(base64.b64decode(match.group(1)))).convert("RGBA"))
    return out


def bake_texture(detail: Image.Image, main: Image.Image) -> Image.Image:
    """Composite main-over-detail onto transparency, preserving Figma opacities."""
    detail = detail.resize(TEXTURE_SIZE, Image.LANCZOS)
    main = main.resize(TEXTURE_SIZE, Image.LANCZOS)

    # Figma's pattern transform mirrors both axes (180 degree rotation)
    detail = detail.rotate(180)
    main = main.rotate(180)

    out_alpha = MAIN_OPACITY + DETAIL_OPACITY * (1 - MAIN_OPACITY)
    detail_weight = DETAIL_OPACITY * (1 - MAIN_OPACITY)

    baked = Image.new("RGBA", TEXTURE_SIZE)
    px_detail = detail.load()
    px_main = main.load()
    px_out = baked.load()
    alpha_byte = round(out_alpha * 255)

    for y in range(TEXTURE_SIZE[1]):
        for x in range(TEXTURE_SIZE[0]):
            dr, dg, db, _ = px_detail[x, y]
            mr, mg, mb, _ = px_main[x, y]
            px_out[x, y] = (
                round((mr * MAIN_OPACITY + dr * detail_weight) / out_alpha),
                round((mg * MAIN_OPACITY + dg * detail_weight) / out_alpha),
                round((mb * MAIN_OPACITY + db * detail_weight) / out_alpha),
                alpha_byte,
            )
    return baked


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    detail, main_metal = embedded_images(PANE_SVG)
    print(f"detail {detail.size}  main {main_metal.size}")

    texture = bake_texture(detail, main_metal)
    texture_path = OUT_DIR / "gate-metal.webp"
    texture.save(texture_path, "WEBP", quality=TEXTURE_QUALITY, method=6)
    print(f"{texture_path.name}: {texture_path.stat().st_size / 1024:.1f} KB")

    logo = embedded_images(LOGO_SVG)[0]
    logo = logo.resize((LOGO_SIZE, LOGO_SIZE), Image.LANCZOS)
    logo_path = OUT_DIR / "scae-logo.webp"
    logo.save(logo_path, "WEBP", quality=LOGO_QUALITY, method=6)
    print(f"{logo_path.name}: {logo_path.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
