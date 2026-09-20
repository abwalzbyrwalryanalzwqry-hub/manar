"""Manar — generates the Android launcher icons from the brand mark.

The mark is the same nested-hexagon glyph used by the web UI (`Mark` in
src/components/manar/shell.tsx): gold (#C9A227) on the deep emerald background
(#0B1F1A). Everything is drawn at 4x and downsampled so the thin strokes stay
clean at every density.

Outputs:
  mipmap-<d>/ic_launcher.png            legacy square icon (API 24-25)
  mipmap-<d>/ic_launcher_round.png      legacy round icon
  mipmap-<d>/ic_launcher_foreground.png adaptive foreground (108dp canvas)
"""
from pathlib import Path
from PIL import Image, ImageDraw

RES = Path(__file__).resolve().parent.parent / "android/app/src/main/res"
GOLD = (201, 162, 39, 255)
BG = (11, 31, 26, 255)
SS = 4  # supersampling factor

OUTER = [(20, 4), (34, 12), (34, 28), (20, 36), (6, 28), (6, 12)]
INNER = [(20, 12), (28, 16), (28, 24), (20, 28), (12, 24), (12, 16)]

DENSITIES = {
    "mdpi": 1.0,
    "hdpi": 1.5,
    "xhdpi": 2.0,
    "xxhdpi": 3.0,
    "xxxhdpi": 4.0,
}


def draw_mark(draw, cx, cy, span):
    """Draws the mark centred on (cx, cy) fitting a `span` px box."""
    unit = span / 40.0

    def pts(points):
        return [(cx + (x - 20) * unit, cy + (y - 20) * unit) for x, y in points]

    draw.line(pts(OUTER) + [pts(OUTER)[0]], fill=GOLD, width=max(1, round(1.4 * unit)), joint="curve")
    draw.line(pts(INNER) + [pts(INNER)[0]], fill=GOLD, width=max(1, round(1.2 * unit)), joint="curve")
    r = 2.2 * unit
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=GOLD)


def render(size, mode):
    """mode: 'square' | 'round' | 'foreground'"""
    px = size * SS
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if mode == "square":
        radius = px * 0.18
        d.rounded_rectangle([0, 0, px - 1, px - 1], radius=radius, fill=BG)
        span = px * 0.60
    elif mode == "round":
        d.ellipse([0, 0, px - 1, px - 1], fill=BG)
        span = px * 0.55
    else:  # adaptive foreground: mark must sit inside the 66/108 safe zone
        span = px * (34.0 / 108.0) * 2
    draw_mark(d, px / 2, px / 2, span)
    return img.resize((size, size), Image.LANCZOS)


def main():
    for name, scale in DENSITIES.items():
        out = RES / f"mipmap-{name}"
        out.mkdir(parents=True, exist_ok=True)
        legacy = round(48 * scale)
        adaptive = round(108 * scale)
        render(legacy, "square").save(out / "ic_launcher.png")
        render(legacy, "round").save(out / "ic_launcher_round.png")
        render(adaptive, "foreground").save(out / "ic_launcher_foreground.png")
        print(f"[manar] mipmap-{name}: {legacy}px legacy, {adaptive}px adaptive")

    # Play Store / high-res marketing icon.
    store = RES.parent.parent.parent.parent / "manar-play-icon-512.png"
    render(512, "square").save(store)
    print(f"[manar] {store}")


if __name__ == "__main__":
    main()
