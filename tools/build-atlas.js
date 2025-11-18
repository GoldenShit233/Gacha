#!/usr/bin/env node
/**
 * 简单的 atlas 打包脚本（依赖 sharp）。
 * 用法示例：
 *   node tools/build-atlas.js --src icon --out assets/atlas --tile 68 --size 2048
 *
 * 输出：
 *   out/atlas-0.png, atlas-1.png, ...
 *   out/manifest.json  => { basePath: 'assets/atlas', map: { 'item.png': { atlas:'atlas-0.png', x,y,w,h } } }
 *
 * 说明：脚本会把每张源图缩放到 tileSize（方形）再排列到 atlas，
 * 适合大量小图（道具图标）且显示尺寸一致的场景。
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const argv = require('minimist')(process.argv.slice(2), {
    string: ['src','out'],
    integer: ['tile','size'],
    default: { src: 'icon', out: 'assets/atlas', tile: 68, size: 2048 }
});

(async () => {
    const srcDir = path.resolve(argv.src);
    const outDir = path.resolve(argv.out);
    const tile = Number(argv.tile) || 68;
    const atlasSize = Number(argv.size) || 2048;
    if (!fs.existsSync(srcDir)) {
        console.error('src dir not found:', srcDir); process.exit(1);
    }
    fs.mkdirSync(outDir, { recursive: true });

    const files = fs.readdirSync(srcDir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
        .filter(f => !/^hero\./i.test(f)); // exclude hero.*

    const perRow = Math.floor(atlasSize / tile);
    const perAtlas = perRow * perRow;
    const manifest = { basePath: path.relative(path.resolve('.'), outDir).replace(/\\/g,'/'), map: {} };

    let atlasIndex = 0;
    for (let i = 0; i < files.length; i += perAtlas) {
        const chunk = files.slice(i, i + perAtlas);
        const composites = [];
        let idx = 0;
        for (const fname of chunk) {
            const sx = (idx % perRow) * tile;
            const sy = Math.floor(idx / perRow) * tile;
            const inputPath = path.join(srcDir, fname);
            // resize to tile x tile
            const buffer = await sharp(inputPath).resize(tile, tile, { fit: 'cover' }).toBuffer();
            composites.push({ input: buffer, left: sx, top: sy });
            manifest.map[fname] = { atlas: `atlas-${atlasIndex}.png`, x: sx, y: sy, w: tile, h: tile };
            idx++;
        }
        const atlasBuf = await sharp({
            create: {
                width: atlasSize,
                height: atlasSize,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            }
        }).composite(composites).png().toBuffer();
        const outFile = path.join(outDir, `atlas-${atlasIndex}.png`);
        fs.writeFileSync(outFile, atlasBuf);
        console.log('written', outFile);
        atlasIndex++;
    }

    // write manifest
    const manifestPath = path.join(outDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('manifest written to', manifestPath);
})();
