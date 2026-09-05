"""Objective visual-diff check against the North Star reference.
Resizes the new screenshot to the reference's width, computes a
per-pixel absolute difference, writes a diff heatmap, and prints the
percentage of pixels that differ beyond a small tolerance (anti-aliasing
noise). This is the pixelmatch-equivalent gate required before this pass
can be reported complete -- no new npm/pip dependency needed since PIL
is already used throughout this repo's visual-review tooling.
"""
import sys
from PIL import Image, ImageChops

REFERENCE = 'public/images/A63B5E0B-0AE1-4D9A-B05D-9C52403721C7.png'
TOLERANCE = 12  # per-channel value difference below this counts as "same"


def diff(reference_path: str, implementation_path: str, out_heatmap: str) -> float:
    ref = Image.open(reference_path).convert('RGB')
    impl = Image.open(implementation_path).convert('RGB')
    impl_resized = impl.resize(ref.size)

    delta = ImageChops.difference(ref, impl_resized)
    pixels = list(delta.getdata())
    differing = sum(1 for r, g, b in pixels if max(r, g, b) > TOLERANCE)
    percent = 100 * differing / len(pixels)

    delta.save(out_heatmap)
    return percent


if __name__ == '__main__':
    implementation_path = sys.argv[1]
    out_heatmap = sys.argv[2]
    percent = diff(REFERENCE, implementation_path, out_heatmap)
    print(f'{percent:.2f}% of pixels differ beyond tolerance (heatmap: {out_heatmap})')
