import assert from 'assert';

const API = 'http://localhost:3001/api/v1';
const ts = Date.now();

async function call(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function run() {
  // 1. Register a company + admin
  let r = await call('POST', '/auth/register-ceo', {
    companyName: `Flow Test Pharma ${ts}`,
    name: 'Admin User',
    email: `admin_${ts}@test.com`,
    password: 'password123',
    state: 'Maharashtra',
  });
  assert.strictEqual(r.status, 201, JSON.stringify(r.data));
  const token = r.data.data.accessToken;
  console.log('✅ Company registered:', r.data.data.company.name);

  // 2. Create supplier + customer parties (same state -> intra-state GST)
  r = await call('POST', '/masters/parties', { name: 'Cipla Distributors', type: 'SUPPLIER', state: 'Maharashtra', gstin: '27AAACC2233M1Z5' }, token);
  assert.strictEqual(r.status, 201, JSON.stringify(r.data));
  const supplierId = r.data.data.id;
  console.log('✅ Supplier created');

  r = await call('POST', '/masters/parties', { name: 'Apollo Pharmacy', type: 'CUSTOMER', state: 'Maharashtra', gstin: '27AAAPA9876C1Z3' }, token);
  assert.strictEqual(r.status, 201, JSON.stringify(r.data));
  const customerId = r.data.data.id;
  console.log('✅ Customer created');

  // 3. Create a product + batch
  r = await call('POST', '/masters/products', { name: 'Amoxycillin 500mg', price: 85, hsnCode: '30041010', gstRate: 12 }, token);
  assert.strictEqual(r.status, 201, JSON.stringify(r.data));
  const productId = r.data.data.id;
  console.log('✅ Product created');

  r = await call('POST', '/masters/batches', { productId, batchNumber: 'B001', expiryDate: '2027-01-01', mrp: 100, currentQty: 0 }, token);
  assert.strictEqual(r.status, 201, JSON.stringify(r.data));
  const batchId = r.data.data.id;
  console.log('✅ Batch created');

  // 4. Purchase 100 units @ rate 80, GST 12% (=960) -> stock IN
  r = await call('POST', '/billing/purchases', {
    supplierId,
    billNumber: `SUP-BILL-${ts}`,
    purchaseDate: '2026-07-01',
    items: [{ batchId, qty: 100, rate: 80, gstAmount: 960 }],
  }, token);
  assert.strictEqual(r.status, 201, JSON.stringify(r.data));
  assert.strictEqual(r.data.data.items[0].batch.batchNumber, 'B001');
  console.log('✅ Purchase recorded, total:', r.data.data.totalAmount);

  // Duplicate bill number should be rejected
  r = await call('POST', '/billing/purchases', {
    supplierId,
    billNumber: `SUP-BILL-${ts}`,
    purchaseDate: '2026-07-01',
    items: [{ batchId, qty: 1, rate: 80, gstAmount: 9.6 }],
  }, token);
  assert.strictEqual(r.status, 400);
  console.log('✅ Duplicate supplier bill number correctly rejected');

  r = await call('GET', `/masters/batches/${batchId}`, null, token);
  assert.strictEqual(r.data.data.currentQty, 100);
  console.log('✅ Batch stock incremented to 100');

  // 5. Sale of 30 units @ rate 120, GST 12% (=432) -> stock OUT
  r = await call('POST', '/billing/sales', {
    customerId,
    saleDate: '2026-07-05',
    items: [{ batchId, qty: 30, rate: 120, gstAmount: 432 }],
  }, token);
  assert.strictEqual(r.status, 201, JSON.stringify(r.data));
  const saleId = r.data.data.id;
  const invoiceNumber = r.data.data.invoiceNumber;
  console.log('✅ Sale recorded, invoice:', invoiceNumber, 'total:', r.data.data.totalAmount);

  r = await call('GET', `/masters/batches/${batchId}`, null, token);
  assert.strictEqual(r.data.data.currentQty, 70);
  console.log('✅ Batch stock decremented to 70');

  // 6. Oversell should fail with insufficient stock
  r = await call('POST', '/billing/sales', {
    customerId,
    saleDate: '2026-07-05',
    items: [{ batchId, qty: 9999, rate: 120, gstAmount: 1 }],
  }, token);
  assert.strictEqual(r.status, 400);
  console.log('✅ Oversell correctly rejected:', r.data.message);

  // 7. Payment against the sale
  r = await call('POST', '/billing/payments', {
    partyId: customerId, saleId, amount: 4032, method: 'CASH', paymentDate: '2026-07-06',
  }, token);
  assert.strictEqual(r.status, 201, JSON.stringify(r.data));
  console.log('✅ Payment recorded');

  r = await call('GET', `/billing/sales/${saleId}`, null, token);
  assert.strictEqual(r.data.data.status, 'PAID');
  console.log('✅ Sale marked PAID');

  // 8. Reports
  for (const path of [
    '/reports/day-book?date=2026-07-05',
    '/reports/trial-balance',
    '/reports/balance-sheet',
    '/reports/profit-loss',
    '/reports/stock-summary',
    '/reports/outstanding/receivables',
    '/reports/outstanding/payables',
    '/reports/cash-flow',
  ]) {
    r = await call('GET', path, null, token);
    assert.strictEqual(r.status, 200, `${path} -> ${JSON.stringify(r.data)}`);
    console.log(`✅ ${path} -> 200`);
  }

  r = await call('GET', '/reports/trial-balance', null, token);
  assert.strictEqual(r.data.data.balanced, true, JSON.stringify(r.data.data));
  console.log('✅ Trial balance is balanced: Dr', r.data.data.totalDr, '= Cr', r.data.data.totalCr);

  r = await call('GET', '/reports/balance-sheet', null, token);
  assert.strictEqual(r.data.data.balanced, true, JSON.stringify(r.data.data));
  console.log('✅ Balance sheet balances: Assets', r.data.data.totalAssets, '= Liab+Eq', r.data.data.totalLiabEq);

  // 9. Banking
  r = await call('GET', '/accounts/ledgers?groupId=', null, token);
  const bankGroup = (await call('GET', '/accounts/groups', null, token)).data.data.find(g => g.name === 'Bank Accounts');
  r = await call('POST', '/accounts/ledgers', { name: 'HDFC Current AC', groupId: bankGroup.id, openingBalance: 5000, openingBalanceType: 'DEBIT' }, token);
  assert.strictEqual(r.status, 201, JSON.stringify(r.data));
  const bankLedgerId = r.data.data.id;

  r = await call('POST', '/banking/accounts', { name: 'HDFC Current AC', ledgerId: bankLedgerId, bankName: 'HDFC Bank', accountNumber: `ACC${ts}` }, token);
  assert.strictEqual(r.status, 201, JSON.stringify(r.data));
  console.log('✅ Bank account created');

  r = await call('GET', `/banking/accounts/${r.data.data.id}/statement`, null, token);
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  console.log('✅ Bank statement -> 200, closing balance:', r.data.data.closingBalance);

  // 10. Voucher cancellation (soft delete)
  r = await call('GET', '/vouchers?type=SALES', null, token);
  const saleVoucher = r.data.data.find(v => v.id); // any
  r = await call('DELETE', `/vouchers/${saleVoucher.id}`, null, token);
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  console.log('✅ Voucher cancelled (soft delete)');

  r = await call('GET', `/vouchers/${saleVoucher.id}`, null, token);
  assert.strictEqual(r.data.data.isDeleted, true);
  console.log('✅ Cancelled voucher still exists with isDeleted=true');

  r = await call('GET', '/reports/day-book?date=2026-07-05', null, token);
  assert.ok(!r.data.data.vouchers.some(v => v.id === saleVoucher.id));
  console.log('✅ Cancelled voucher excluded from day book');

  console.log('\n🌟 ALL BILLING FLOW TESTS PASSED 🌟');
}

run().catch((err) => {
  console.error('❌ FLOW TEST FAILED:', err);
  process.exit(1);
});
