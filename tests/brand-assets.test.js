const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const worker = read('service-worker.js');
const homepage = read('index.html');

assert.match(homepage, /<img[^>]*src="\/logo\.png"[^>]*alt="Shell Designz"/);
assert(fs.existsSync(path.join(root, 'logo.png')));
assert(worker.includes('"/logo.png"'));
for (const size of [192, 512]) {
  const icon = manifest.icons.find((entry) => entry.sizes === `${size}x${size}`);
  assert(icon);
  assert.match(icon.purpose, /\bmaskable\b/);
  const bytes = fs.readFileSync(path.join(root, icon.src.slice(1)));
  assert.equal(bytes.readUInt32BE(16), size);
  assert.equal(bytes.readUInt32BE(20), size);
  assert(worker.includes(`"${icon.src}"`));
}
console.log('Brand asset tests passed.');
