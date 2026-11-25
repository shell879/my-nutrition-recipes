const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
for (const [directory, script] of [['Christmas', 'christmas.js'], ['recipe-builder-demo', 'demo.js']]) {
  const source = fs.readFileSync(path.join(root, directory, script), 'utf8');
  const html = fs.readFileSync(path.join(root, directory, 'index.html'), 'utf8');
  assert.match(html, /id="categoryFilterWrap"[^>]*hidden/);
  assert.match(html, /<label for="categoryFilter">Category<\/label>/);
  assert.match(source, /async function loadData\(\) \{(?:\s*storeSharing\.hide\(\);)?\s*state\.categoryId = '';/);

  const nodes = new Map();
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {
      value: '', innerHTML: '', textContent: '', hidden: false,
      listeners: {},
      querySelectorAll: () => [],
      addEventListener(type, callback) { this.listeners[type] = callback; },
    });
    return nodes.get(selector);
  }
  const state = {
    storeId: 1, categoryId: '', query: '',
    data: {
      stores: [{ id: 1, name: 'Album', flavorProfiles: [] }],
      categories: [
        { id: 1, storeId: 1, name: 'Cookies & Bars' },
        { id: 2, storeId: 1, name: 'Cakes', active: false },
        { id: 3, storeId: 2, name: 'Another album' },
      ],
      drinkRecipes: [
        { id: 1, storeId: 1, categoryId: 1, name: 'Cookie', ingredients: [{ name: 'Chocolate', side: 'TOP' }] },
        { id: 2, storeId: 1, categoryId: 2, name: 'Cake', ingredients: [{ name: 'Vanilla', side: 'TOP' }] },
        { id: 3, storeId: 1, categoryId: 99, name: 'Other', ingredients: [] },
        { id: 4, storeId: 2, categoryId: 3, name: 'Other album', ingredients: [] },
      ],
    },
  };
  const context = {
    state, $: node, document: { title: '' },
    defaultStoreColors: { buttonColor: '#126e68' },
    applyStoreTheme() {}, contrastingTextColor() { return '#ffffff'; },
    storeCategories: () => state.data.categories.filter((item) => item.storeId === state.storeId),
    storeDrinks: () => state.data.drinkRecipes.filter((item) => item.storeId === state.storeId),
    storeFlavorProfiles: () => [],
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
  };
  const renderStart = source.indexOf('function render() {');
  const renderEnd = source.indexOf('function openDrinkPicker()', renderStart);
  assert(renderStart >= 0 && renderEnd > renderStart);
  vm.runInNewContext(source.slice(renderStart, renderEnd), context);
  const listenerStart = source.indexOf("$('#categoryFilter').addEventListener('change'");
  const listenerEnd = source.indexOf('\n});', listenerStart) + '\n});'.length;
  assert(listenerStart >= 0 && listenerEnd > listenerStart);
  vm.runInNewContext(source.slice(listenerStart, listenerEnd), context);

  context.render();
  assert.equal(node('#categoryFilterWrap').hidden, false);
  assert.match(node('#categoryFilter').innerHTML, /Cookies &amp; Bars/);
  assert.match(node('#categoryFilter').innerHTML, /Cakes \(inactive\)/);
  assert.doesNotMatch(node('#categoryFilter').innerHTML, /Another album/);
  assert.match(node('#drinkList').innerHTML, /Cookie/);
  assert.match(node('#drinkList').innerHTML, /Cake/);
  assert.match(node('#drinkList').innerHTML, /Other/);

  node('#categoryFilter').listeners.change({ target: { value: '1' } });
  assert.equal(state.categoryId, '1');
  assert.equal(node('#categoryFilter').value, '1');
  assert.match(node('#drinkList').innerHTML, /Cookie/);
  assert.doesNotMatch(node('#drinkList').innerHTML, /Cake|Other/);
  state.query = 'vanilla';
  context.render();
  assert.match(node('#drinkList').innerHTML, /No recipes match/);
  node('#categoryFilter').listeners.change({ target: { value: '2' } });
  assert.match(node('#drinkList').innerHTML, /Cake/);
  state.query = '';
  node('#categoryFilter').listeners.change({ target: { value: '' } });
  assert.match(node('#drinkList').innerHTML, /Cookie/);
  assert.match(node('#drinkList').innerHTML, /Other/);

  state.categoryId = '2';
  state.data.categories = state.data.categories.filter((category) => category.id !== 2);
  context.render();
  assert.equal(state.categoryId, '');
  assert.equal(node('#categoryFilter').value, '');
  state.data.categories = [];
  context.render();
  assert.equal(node('#categoryFilterWrap').hidden, true);
  assert.match(node('#drinkList').innerHTML, /Cake/);

  state.categoryId = '1';
  context.pickerDrinks = [{ name: 'Cookie' }];
  context.lastPickedIndex = 0;
  context.updateSearchClearButton = () => {};
  context.drinkPicker = { close() {} };
  context.setStatus = () => {};
  const pickerStart = source.indexOf('function showPickedRecipe()');
  const pickerEnd = source.indexOf('function updateSearchClearButton()', pickerStart);
  assert(pickerStart >= 0 && pickerEnd > pickerStart);
  vm.runInNewContext(source.slice(pickerStart, pickerEnd), context);
  context.showPickedRecipe();
  assert.equal(state.categoryId, '');
  assert.equal(state.query, 'cookie');
  assert.match(node('#drinkList').innerHTML, /Cookie/);
}
console.log('Recipe category filter tests passed.');
