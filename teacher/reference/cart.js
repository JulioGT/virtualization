'use strict';
// cart service - port 3002 - run:  node cart.js
const { run } = require('./svc');

const items = new Map(); // productId -> qty (one shared cart, kept in memory)
const view = () => ({ items: [...items].map(([productId, qty]) => ({ productId, qty })) });

run('cart', 3002, 5, (method, path, body) => {
  if (path !== '/cart') return [404, { error: 'not found' }];
  if (method === 'GET') return [200, view()];
  if (method === 'DELETE') { items.clear(); return [200, view()]; }
  if (method === 'POST') {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return [400, { error: 'JSON body required' }];
    const { productId, qty } = body;
    if (typeof productId !== 'string' || !productId || !Number.isInteger(qty) || qty < 1)
      return [400, { error: 'productId (string) and qty (integer >= 1) required' }];
    items.set(productId, (items.get(productId) || 0) + qty);
    return [201, view()];
  }
  return [405, { error: 'method not allowed' }];
});
