'use strict';
// payment service - port 3003 - run:  node payment.js
const { run } = require('./svc');

let count = 0;

run('payment', 3003, 30, (method, path, body) => {
  if (method !== 'POST' || path !== '/pay') return [404, { error: 'not found' }];
  const amount = body && body.amount, card = body && body.card;
  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0)
    return [400, { status: 'declined', error: 'amount must be a number greater than 0' }];
  if (typeof card !== 'string' || card.length < 4)
    return [400, { status: 'declined', error: 'card must be a string of at least 4 characters' }];
  count += 1;
  return [200, { status: 'approved', id: 'pay-' + count, amount }];
});
