const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'shop', 'products.js'), 'utf8');

async function load(products, responseOk = true) {
  const elements = {
    'curated-products': {
      children: [],
      replaceChildren(...children) { this.children = children; },
    },
    'products-status': {
      textContent: '',
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; },
    },
  };
  const events = [];
  const context = {
    URL,
    CustomEvent: class {
      constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
    },
    location: { hostname: 'example.com' },
    console: { error() {} },
    fetch: async (url) => {
      assert.equal(url, '/api/data/shop/products');
      return { ok: responseOk, status: responseOk ? 200 : 503, json: async () => ({ products }) };
    },
    document: {
      getElementById: (id) => elements[id],
      dispatchEvent: (event) => events.push(event),
      createElement: (tag) => ({
        tag, children: [],
        appendChild(child) { this.children.push(child); },
        append(...children) { this.children.push(...children); },
      }),
    },
  };
  await vm.runInNewContext(source.replace('loadProductPicks();', 'loadProductPicks()'), context);
  return { ...elements, events };
}

(async () => {
  let elements = await load([
    { name: 'Pan', value: 'https://www.amazon.com/dp/B000000001?tag=example-20', category: 'supply' },
    { name: 'Flour', value: 'https://amzn.to/example', category: 'ingredient' },
    { name: 'Old product', value: 'https://amazon.com/example' },
  ]);
  const sections = elements['curated-products'].children;
  assert.deepEqual(sections.map((section) => section.children[0].textContent),
    ['Ingredients', 'Kitchen supplies', 'Uncategorized']);
  assert.equal(sections[0].children[1].src, '/images/shop-cookie-ingredients-ai.jpg');
  assert.equal(sections[0].children[1].alt, '');
  assert.equal(sections[2].children.some((child) => child.tag === 'img'), false);
  const image = sections[1].children[1];
  assert.equal(image.tag, 'img');
  assert.equal(image.src, '/images/shop-baking-tools.jpg');
  assert.equal(image.alt, '');
  const link = sections[1].children[2].children[0].children[0];
  assert.equal(link.textContent, 'Pan');
  assert.equal(link.rel, 'sponsored noopener');
  assert.equal(new URL(link.href).searchParams.get('tag'), 'example-20');
  assert.equal(elements.events[0].type, 'shop-products-loaded');
  assert.equal(elements.events[0].detail[1].name, 'Flour');
  elements = await load([{ name: 'Bad category', value: 'https://amazon.com/', category: 'other' }]);
  assert.match(elements['products-status'].textContent, /category is invalid/);
  assert.equal(elements.events[0].type, 'shop-products-error');
  assert.equal(elements['curated-products'].children.length, 0);
  elements = await load([{ name: 'Bad', value: 'https://amazon.com.evil.example/' }]);
  assert.match(elements['products-status'].textContent, /invalid/);
  assert.equal(elements['curated-products'].children.length, 0);
  elements = await load([]);
  assert.match(elements['products-status'].textContent, /No product picks/);
  elements = await load([], false);
  assert.match(elements['products-status'].textContent, /503/);
  console.log('Shop product rendering tests passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
