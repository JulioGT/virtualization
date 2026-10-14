'use strict';
// product service - port 3001 - run:  node product.js
const { run } = require('./svc');

const PRODUCTS = [
  { id: 'p1', name: 'USB-C cable 1 m', price: 9.9 },
  { id: 'p2', name: 'Laptop stand', price: 24.5 },
  { id: 'p3', name: 'Wireless mouse', price: 15 },
  { id: 'p4', name: 'HDMI adapter', price: 12.75 },
  { id: 'p5', name: 'Webcam 1080p', price: 39 },
];

run('product', 3001, 10, (method, path) => {
  if (method === 'GET' && path === '/products') return [200, { products: PRODUCTS }];
  if (method === 'GET' && path.startsWith('/products/')) {
    const p = PRODUCTS.find(x => x.id === path.slice('/products/'.length));
    return p ? [200, p] : [404, { error: 'product not found' }];
  }
  return [404, { error: 'not found' }];
});
