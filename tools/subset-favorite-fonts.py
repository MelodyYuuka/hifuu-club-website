#!/usr/bin/env python3
"""Regenerate local Noto SC web subsets after changing page/character text.
Requires fonttools[woff] (with Brotli); full fonts stay outside the repository.
"""
import argparse
import hashlib
import json
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--sans', type=Path, default=Path('C:/Windows/Fonts/NotoSansSC-VF.ttf'))
parser.add_argument('--serif', type=Path, default=Path('C:/Windows/Fonts/NotoSerifSC-VF.ttf'))
args = parser.parse_args()
output = ROOT / 'src/favorite/assets/fonts'
output.mkdir(parents=True, exist_ok=True)
text = ''.join(chr(code) for code in range(32, 127))
for source in sorted((ROOT / 'src/favorite').rglob('*')):
    if source.suffix in ('.html', '.js', '.css'):
        text += source.read_text(encoding='utf-8')
# The font-preview overlay uses Latin aliases; it is not part of deployed font coverage.
unicodes = {ord(ch) for ch in text if ord(ch) >= 32}
manifest = {'generator': 'tools/subset-favorite-fonts.py', 'fonts': {}}
for name, source in [('noto-sans-sc', args.sans), ('noto-serif-sc', args.serif)]:
    if not source.is_file():
        raise SystemExit(f'Missing source font: {source}; pass --sans/--serif paths to full Noto SC TTFs.')
    font = TTFont(source)
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    options.name_legacy = True
    options.name_languages = ['*']
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    font.flavor = 'woff2'
    target = output / f'{name}.woff2'
    font.save(target)
    codepoints = sorted(font.getBestCmap())
    required = {ord(ch) for ch in text if 0x4e00 <= ord(ch) <= 0x9fff or 0x3040 <= ord(ch) <= 0x30ff}
    missing = required - set(codepoints)
    if missing:
        raise SystemExit(f'{name} source lacks required glyphs: ' + ''.join(chr(code) for code in sorted(missing)))
    manifest['fonts'][name] = {
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'bytes': target.stat().st_size,
        'codepoints': codepoints,
    }
    print(f'{target.relative_to(ROOT)}: {len(codepoints)} glyphs, {target.stat().st_size} bytes')
(output / 'subset-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
