import assert from 'assert';

const API = 'http://localhost:3001/api/v1';
const ts = Date.now();

async function call(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function run() {
  let r = await call('POST', '/auth/register-ceo', {
    companyName: `Concurrency Test ${ts}`, name: 'Admin', email: `admin_${ts}@test.com`, password: 'password123', state: 'Maharashtra',
  });
  const token = r.data.data.accessToken;

  r = await call('POST', '/masters/parties', { name: 'Customer A', type: 'CUSTOMER', state: 'Maharashtra' }, token);
  const customerId = r.data.data.id;

  r = await call('POST', '/masters/products', { name: 'Product X', price: 10 }, token);
  const productId = r.data.data.id;

  r = await call('POST', '/masters/batches', { productId, batchNumber: 'C1', expiryDate: '2027-01-01', mrp: 20, currentQty: 1000 }, token);
  const batchId = r.data.data.id;

  // Fire 15 concurrent sales
  const N = 15;
  const results = await Promise.all(
    Array.from({ length: N }, () =>
      call('POST', '/billing/sales', {
        customerId, saleDate: '2026-07-10',
        items: [{ batchId, qty: 1, rate: 10, gstAmount: 0 }],
      }, token)
    )
  );

  const failures = results.filter((r) => r.status !== 201);
  if (failures.length) {
    console.error('Some concurrent sales failed:', failures.map(f => f.data));
  }
  assert.strictEqual(failures.length, 0, 'All concurrent sales should succeed');

  const invoiceNumbers = results.map((r) => r.data.data.invoiceNumber);
  const uniqueInvoices = new Set(invoiceNumbers);
  assert.strictEqual(uniqueInvoices.size, N, `Expected ${N} unique invoice numbers, got ${uniqueInvoices.size}: ${invoiceNumbers.join(', ')}`);
  console.log(`✅ ${N} concurrent sales all succeeded with unique invoice numbers:`, [...uniqueInvoices].sort().join(', '));

  r = await call('GET', `/masters/batches/${batchId}`, null, token);
  assert.strictEqual(r.data.data.currentQty, 1000 - N);
  console.log('✅ Stock correctly decremented by exactly', N, '-> currentQty =', r.data.data.currentQty);

  console.log('\n🌟 CONCURRENCY TEST PASSED 🌟');
}

run().catch((err) => {
  console.error('❌ CONCURRENCY TEST FAILED:', err);
  process.exit(1);
});
