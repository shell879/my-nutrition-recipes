const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const shopHtml = fs.readFileSync(path.join(root, 'shop', 'index.html'), 'utf8');
assert.match(shopHtml, /<option value="amazon">/);
assert.doesNotMatch(shopHtml, /<option value="walmart"/);
const recipeSource = fs.readFileSync(path.join(root, 'Christmas', 'christmas.js'), 'utf8');
const start = recipeSource.indexOf('function shopRecipe(');
const end = recipeSource.indexOf('function addCategory()', start);
assert(start >= 0 && end > start, 'Recipe shop handler is missing');

function openShop(recipe, options = {}) {
  const storage = new Map();
  const messages = [];
  const tabs = [];
  const context = {
    storeDrinks: () => [recipe],
    setStatus: (...args) => messages.push(args),
    console: { error() {} },
    sessionStorage: {
      setItem(key, value) {
        if (options.storageError) throw new Error('Storage disabled');
        storage.set(key, value);
      },
      removeItem: (key) => storage.delete(key),
    },
    window: {
      open(url) {
        if (options.blocked) return null;
        const tab = { url, payload: JSON.parse(storage.get('recipe-shopping-list')), opener: true };
        tabs.push(tab);
        return tab;
      },
    },
  };
  vm.runInNewContext(`${recipeSource.slice(start, end)}\nshopRecipe(7);`, context);
  return { storage, messages, tabs };
}

const recipe = {
  id: 7,
  name: 'Private recipe name',
  ingredients: [
    { name: 'Flour', side: 'TOP' },
    { name: 'Sugar', side: 'top' },
    { name: 'Private instruction', side: 'BOTTOM' },
    { name: ' ', side: 'TOP' },
  ],
};
const opened = openShop(recipe);
assert.equal(opened.tabs[0].url, '/shop/');
assert.deepEqual(JSON.parse(JSON.stringify(opened.tabs[0].payload)), { version: 1, items: ['Flour', 'Sugar'] });
assert.equal(opened.tabs[0].opener, null);
assert.equal(opened.storage.size, 0);
const blocked = openShop(recipe, { blocked: true });
assert.match(blocked.messages[0][0], /blocked/);
assert.equal(blocked.storage.size, 0);
const unavailable = openShop(recipe, { storageError: true });
assert.match(unavailable.messages[0][0], /Storage disabled/);
assert.equal(unavailable.tabs.length, 0);

class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.value = '';
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }
  addEventListener(type, callback) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(callback);
  }
  trigger(type) { for (const callback of this.listeners[type] || []) callback({ target: this }); }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'href') delete this.href;
  }
  querySelector(selector) {
    for (const child of this.children) {
      if (child.tag === selector) return child;
      const match = child.querySelector(selector);
      if (match) return match;
    }
    return null;
  }
  querySelectorAll(selector) { return selector === '.shopping-item' ? this.children : []; }
  remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
  focus() {}
  get lastElementChild() { return this.children[this.children.length - 1]; }
}

function loadShop(raw) {
  const elements = {
    shoppingList: new Element('div'),
    status: new Element('p'),
    retailer: new Element('select'),
    addItem: new Element('button'),
  };
  elements.retailer.value = 'walmart';
  const storage = new Map();
  const listeners = {};
  if (raw !== null) storage.set('recipe-shopping-list', raw);
  const context = {
    URL,
    console: { error() {} },
    document: {
      getElementById: (id) => elements[id],
      createElement: (tag) => new Element(tag),
      addEventListener: (type, callback) => { listeners[type] = callback; },
    },
    sessionStorage: { getItem: (key) => storage.has(key) ? storage.get(key) : null, removeItem: (key) => storage.delete(key) },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'shop', 'shop.js'), 'utf8'), context);
  return { elements, storage, listeners };
}

const { elements, storage, listeners } = loadShop(JSON.stringify({ version: 1, items: ['Milk & sugar', 'Flour'] }));
assert.equal(storage.size, 0);
assert.equal(elements.shoppingList.children.length, 2);
const row = elements.shoppingList.children[0];
const search = row.querySelector('a');
assert.equal(new URL(search.href).searchParams.get('q'), 'Milk & sugar');
elements.retailer.value = 'amazon';
elements.retailer.trigger('change');
assert.match(search.textContent, /Loading/);
listeners['shop-products-loaded']({ detail: [
  { name: 'Flour', value: 'https://www.amazon.com/dp/B07Z78Q8TB?tag=example-20', category: 'ingredient' },
  { name: 'Milk & sugar', value: 'https://www.amazon.com/dp/B000000001', category: 'supply' },
] });
assert.match(search.textContent, /No matching/);
assert.equal(search.href, undefined);
const flour = elements.shoppingList.children[1].querySelector('a');
assert.equal(new URL(flour.href).pathname, '/dp/B07Z78Q8TB');
assert.equal(new URL(flour.href).searchParams.get('tag'), 'example-20');
assert.equal(flour.rel, 'sponsored noopener');
elements.shoppingList.children[1].querySelector('input').value = ' FLOUR ';
elements.shoppingList.children[1].querySelector('input').trigger('input');
assert.equal(new URL(flour.href).pathname, '/dp/B07Z78Q8TB');
listeners['shop-products-loaded']({ detail: [
  { name: 'Flour', value: 'https://amazon.com/dp/B000000001', category: 'ingredient' },
  { name: 'flour', value: 'https://amazon.com/dp/B000000002', category: 'ingredient' },
] });
assert.equal(flour.href, undefined);
assert.match(flour.textContent, /See Amazon picks/);
listeners['shop-products-error']();
assert.match(flour.textContent, /unavailable/);
assert.equal(flour.href, undefined);
listeners['shop-products-loaded']({ detail: [
  { name: 'Chocolate Chips', value: 'https://amazon.com/dp/B00932F6BO', category: 'ingredient' },
  { name: 'Vanilla Extract', value: 'https://amazon.com/dp/B08CYCRF2W', category: 'ingredient' },
  { name: 'Vanilla Coffee Creamer', value: 'https://amazon.com/dp/B0H6C95CSY', category: 'ingredient' },
  { name: 'Sugar', value: 'https://amazon.com/dp/B07FTX5JC4', category: 'ingredient' },
  { name: 'Brown Sugar', value: 'https://amazon.com/dp/B0D1LC2WRY', category: 'ingredient' },
] });
const ingredientInput = row.querySelector('input');
for (const [ingredient, expected] of [
  ['2 cups semi-sweet chocolate chips', '/dp/B00932F6BO'],
  ['1 chocolate chip', '/dp/B00932F6BO'],
  ['2 tsp vanilla extract', '/dp/B08CYCRF2W'],
  ['1 cup brown sugar', '/dp/B0D1LC2WRY'],
]) {
  ingredientInput.value = ingredient;
  ingredientInput.trigger('input');
  assert.equal(new URL(search.href).pathname, expected, ingredient);
  assert.match(search.textContent, /Suggested/);
}
ingredientInput.value = 'vanilla';
ingredientInput.trigger('input');
assert.equal(search.href, undefined);
ingredientInput.value = 'sugarcane';
ingredientInput.trigger('input');
assert.equal(search.href, undefined);
elements.retailer.value = 'walmart';
elements.retailer.trigger('change');
assert.equal(new URL(search.href).searchParams.get('q'), 'sugarcane');
assert.equal(search.rel, 'noopener noreferrer');
row.querySelector('input').value = '';
row.querySelector('input').trigger('input');
assert.equal(search.attributes['aria-disabled'], 'true');
assert.equal(search.href, undefined);
assert.match(loadShop('{invalid').elements.status.textContent, /Could not load/);
assert.match(loadShop(null).elements.status.textContent, /No recipe list/);
console.log('Shop handoff and retailer link tests passed.');
