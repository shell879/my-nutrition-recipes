const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const worker = read('service-worker.js');
const homepage = read('index.html');

assert.match(homepage, /<img[^>]*src="\/logo\.png"[^>]*alt="Shell Designz"/);
assert.match(homepage, /href="\/Christmas\/"[^>]*>Open Recipe Builder\s*<span[^>]*>Login required<\/span>/);
assert.match(homepage, /href="\/recipe-builder-demo\/"[^>]*>[^<]*<span[^>]*>No login required<\/span>/);
const recipeCard = homepage.match(/<div id="recipeBuilderCard"[\s\S]*?<\/div>\s*<\/div>/);
assert(recipeCard, 'Recipe Builder card is missing');
const recipeActions = [...recipeCard[0].matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(recipeActions, ['/Christmas/', '/recipe-builder-demo/', '/recipe-builder/', '/shop/']);
assert.match(recipeCard[0], /Shop \(new and growing\)/);
for (const url of ['/recipe-builder/', '/shop/']) {
  assert(recipeCard[0].includes(`href="${url}"`));
  assert.match(recipeCard[0], new RegExp(`href="${url}"[^>]*>[^<]*<span[^>]*>No login required</span>`));
}
const nutritionCard = homepage.match(/<div id="nutritionCard"[\s\S]*?<\/div>\s*<\/div>/);
assert(nutritionCard, 'MyNutrition card is missing');
for (const [url, label] of [
  ['/demo/', 'No login required'],
  ['/slideshow/', 'No login required'],
  ['/mynutrition-guide/#request-access', 'No login required'],
  ['/mynutrition/', 'Inquiry access and login required'],
  ['/mynutritionadmin/', 'Admin access and login required'],
]) {
  assert.match(nutritionCard[0], new RegExp(`href="${url}"[^>]*>[^<]*<span class="landing-access-label">${label}</span>`));
}
assert(nutritionCard[0].includes('href="/mynutrition-guide/#request-access"'));
assert(nutritionCard[0].includes('href="/mynutrition-guide/"'));
assert.match(nutritionCard[0], /href="\/mynutrition-guide\/">See How It Works/);
assert.match(homepage, /href="\/store-management\/"[\s\S]*?<span class="landing-access-label">Website owner only — login required<\/span>/);
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
