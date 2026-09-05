// Generuje proste placeholderowe ikony PNG (zielone kwadraty).
const fs = require('fs');
const zlib = require('zlib');

const TABLE = (() => {
  const t = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const td = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([td, data])));
  return Buffer.concat([len, td, data, crc]);
}

function makePng(size, rgb) {
  const row = Buffer.alloc(1 + size * 3);
  for (let i = 0; i < size; i++) {
    row[1 + i * 3] = rgb[0];
    row[1 + i * 3 + 1] = rgb[1];
    row[1 + i * 3 + 2] = rgb[2];
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync('assets', { recursive: true });
for (const n of ['icon', 'splash', 'adaptive-icon']) {
  fs.writeFileSync(`assets/${n}.png`, makePng(1024, [76, 175, 80]));
}
console.log('done:', fs.readdirSync('assets'));
