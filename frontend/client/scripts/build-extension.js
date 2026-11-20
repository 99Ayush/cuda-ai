const fs = require("node:fs");
const path = require("node:path");
const source = path.resolve(__dirname, "../extension");
const publicDir = path.resolve(__dirname, "../public");
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const local = [], central = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const filename = Buffer.from(name), checksum = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6); header.writeUInt16LE(0x21, 12);
    header.writeUInt32LE(checksum, 14); header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22); header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, data);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x0800, 8); directory.writeUInt16LE(0x21, 14);
    directory.writeUInt32LE(checksum, 16); directory.writeUInt32LE(data.length, 20);
    directory.writeUInt32LE(data.length, 24); directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt32LE(offset, 42); central.push(directory, filename);
    offset += header.length + filename.length + data.length;
  }
  const index = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(index.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, index, end]);
}
function build() {
  const names = fs.readdirSync(source).filter(name => /\.(js|json|html|css|md)$/.test(name)).sort();
  const entries = names.map(name => [name, fs.readFileSync(path.join(source, name))]);
  const target = path.join(publicDir, "cuda-ai-extension");
  fs.mkdirSync(target, { recursive: true });
  for (const [name, data] of entries) fs.writeFileSync(path.join(target, name), data);
  fs.writeFileSync(path.join(publicDir, "cuda-ai-extension.zip"), zip(entries));
  console.log(`Packaged CUDA AI extension (${entries.length} files).`);
}
if (require.main === module) build();
module.exports = { zip, crc32, build };
