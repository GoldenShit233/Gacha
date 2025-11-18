"""
简单的 atlas 打包脚本（Python + Pillow）

用法示例：
  python tools/build_atlas.py --src icon --out assets/atlas --tile 68 --size 2048

说明：
- 会把 src 目录下（默认排除 hero.*）的小图缩放到 tile x tile，然后按网格排列到 atlas-0.png / atlas-1.png ...
- 生成 manifest.json，格式：
  {
    "basePath": "assets/atlas",
    "atlasSize": 2048,
    "map": {
      "foo.png": { "atlas": "atlas-0.png", "x": 0, "y": 0, "w": 68, "h": 68 },
      ...
    }
  }
- 推荐 pixel-art 图使用默认最近邻（--pixel-art 可关闭）。
"""
from PIL import Image
import os, sys, json, math, argparse
from pathlib import Path

def iter_images(src_dir, exts):
    for p in sorted(Path(src_dir).iterdir()):
        if p.is_file() and p.suffix.lower() in exts:
            # skip hero files
            if p.name.lower().startswith('hero.'):
                continue
            yield p

def ensure_dir(p):
    Path(p).mkdir(parents=True, exist_ok=True)

def build_atlas(src, out, tile=68, atlas_size=2048, keep_aspect=False, pixel_art=True, exts=('.png','.jpg','.jpeg','.webp')):
    src = Path(src)
    out = Path(out)
    if not src.exists():
        print("src not found:", src); sys.exit(1)
    ensure_dir(out)

    files = [p for p in iter_images(src, exts)]
    if not files:
        print("no images found in", src); return

    per_row = atlas_size // tile
    if per_row <= 0:
        raise ValueError("atlas size must be >= tile size")
    per_atlas = per_row * per_row

    manifest = { "basePath": str(out).replace('\\','/'), "atlasSize": atlas_size, "map": {} }
    atlas_index = 0
    i = 0
    while i < len(files):
        chunk = files[i:i+per_atlas]
        atlas_img = Image.new('RGBA', (atlas_size, atlas_size), (0,0,0,0))
        for idx, src_path in enumerate(chunk):
            row = idx // per_row
            col = idx % per_row
            sx = col * tile
            sy = row * tile
            try:
                im = Image.open(src_path).convert('RGBA')
            except Exception as e:
                print("open error", src_path, e); continue
            if keep_aspect:
                # fit inside tile, center
                im.thumbnail((tile, tile), resample=Image.NEAREST if pixel_art else Image.LANCZOS)
                bg = Image.new('RGBA', (tile, tile), (0,0,0,0))
                ox = (tile - im.width) // 2
                oy = (tile - im.height) // 2
                bg.paste(im, (ox, oy), im)
                im = bg
            else:
                resample = Image.NEAREST if pixel_art else Image.LANCZOS
                im = im.resize((tile, tile), resample=resample)
            atlas_img.paste(im, (sx, sy), im)
            manifest['map'][src_path.name] = { "atlas": f"atlas-{atlas_index}.png", "x": sx, "y": sy, "w": tile, "h": tile }
        out_path = out / f"atlas-{atlas_index}.png"
        atlas_img.save(out_path, optimize=True)
        print("wrote", out_path)
        atlas_index += 1
        i += per_atlas

    manifest_path = out / 'manifest.json'
    with manifest_path.open('w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print("wrote manifest", manifest_path)
    print("done. atlases:", atlas_index)

def main():
    p = argparse.ArgumentParser(description="Build texture atlas from icons")
    p.add_argument('--src', default='icon', help='source dir of icons')
    p.add_argument('--out', default='assets/atlas', help='output dir for atlases and manifest')
    p.add_argument('--tile', type=int, default=68, help='tile size (px)')
    p.add_argument('--size', type=int, default=2048, help='atlas size (px, square)')
    p.add_argument('--keep-aspect', action='store_true', help='keep original aspect ratio and center inside tile')
    p.add_argument('--no-pixel-art', dest='pixel_art', action='store_false', help='disable nearest-neighbor resampling')
    args = p.parse_args()
    try:
        build_atlas(args.src, args.out, tile=args.tile, atlas_size=args.size, keep_aspect=args.keep_aspect, pixel_art=args.pixel_art)
    except Exception as e:
        print("error:", e); sys.exit(1)

if __name__ == '__main__':
    main()
