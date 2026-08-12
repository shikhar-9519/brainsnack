// Rasterises the marketplace icon.
//
// Not qlmanage: it produces a Quick Look *thumbnail*, which padded the artwork
// into the corner of a mostly-white canvas. That shipped as the listing icon
// for several versions before anyone could see it was wrong.
import sharp from 'sharp';

const SOURCE = 'media/icon-marketplace.svg';
const OUT = 'media/icon.png';
const SIZE = 128;

const info = await sharp(SOURCE).resize(SIZE, SIZE).png().toFile(OUT);

if (info.width !== SIZE || info.height !== SIZE) {
  throw new Error(`Expected ${SIZE}x${SIZE}, got ${info.width}x${info.height}`);
}

// A correct render has the dark rounded square meeting every edge. If the
// corners come back light, the rasteriser padded it again.
const { data } = await sharp(OUT).raw().toBuffer({ resolveWithObject: true });
const at = (x, y) => {
  const i = (y * SIZE + x) * (data.length / (SIZE * SIZE));
  return (data[i] + data[i + 1] + data[i + 2]) / 3;
};
const centres = [at(64, 8), at(8, 64), at(120, 64), at(64, 120)];

if (centres.some(v => v > 120)) {
  throw new Error(`Icon looks padded — edge samples ${centres.map(Math.round)}`);
}

console.log(`${OUT} ${SIZE}x${SIZE}, edges dark — looks right`);
