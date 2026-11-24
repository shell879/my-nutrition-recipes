const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'store-management', 'store-management.js'), 'utf8');
const start = source.indexOf('let productsDirty = false;');
const end = source.indexOf('async function loadProducts()', start);
assert(start >= 0 && end > start);

class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.listeners = {};
    this.value = '';
  }
  appendChild(child) { this.children.push(child); }
  addEventListener(event, callback) { this.listeners[event] = callback; }
}

const products = new Element('div');
const context = {
  document: { createElement: (tag) => new Element(tag) },
  $: (id) => {
    assert.equal(id, 'products');
    return products;
  },
};
vm.runInNewContext(source.slice(start, end) + `
  globalThis.starters = starterProducts;
  globalThis.addProductRow = addProduct;
  globalThis.isDirty = () => productsDirty;
`, context);

const supplies = ['Baking Dish', 'Mixer', 'Knives', 'Baking Sheets', 'Measuring Cups'];
assert.equal(context.starters.length, 21);
for (const product of context.starters) {
  assert.equal(product.category, supplies.includes(product.name) ? 'supply' : 'ingredient', product.name);
}
context.addProductRow(context.starters.find((product) => product.name === 'Mixer'));
context.addProductRow({ name: 'Old', value: 'https://amazon.com/' });
context.addProductRow();
const categoryOf = (row) => row.children[2].children[0];
assert.equal(categoryOf(products.children[0]).value, 'supply');
assert.equal(categoryOf(products.children[1]).value, 'uncategorized');
assert.equal(categoryOf(products.children[2]).value, 'uncategorized');
assert.deepEqual(Array.from(categoryOf(products.children[0]).children, (option) => option.value),
  ['uncategorized', 'ingredient', 'supply']);
categoryOf(products.children[1]).listeners.change();
assert.equal(context.isDirty(), true);
console.log('Shop management category tests passed.');
