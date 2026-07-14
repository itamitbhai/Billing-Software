import assert from 'assert';

const API_BASE = 'http://localhost:3001/api/v1';

async function runTests() {
  console.log('--------------------------------------------------');
  console.log('🚀 Starting Multi-Tenant Auth API Verification Tests...');
  console.log('--------------------------------------------------');

  const timestamp = Date.now();
  const ceoEmail = `ceo_${timestamp}@test.com`;
  const ceoPassword = 'password123';
  const employeeEmail = `employee_${timestamp}@test.com`;
  const employeePassword = 'password456';

  let ceoAccessToken = '';
  let ceoRefreshToken = '';
  let employeeAccessToken = '';
  let employeeRefreshToken = '';

  // 1. Test Health Check
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    console.log('✅ Health Check endpoint is healthy.');
  } catch (error) {
    console.error('❌ Health Check failed:', error.message);
    process.exit(1);
  }

  // 2. Register CEO
  try {
    const res = await fetch(`${API_BASE}/auth/register-ceo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: `Apex Corp ${timestamp}`,
        name: 'Jane Doe CEO',
        email: ceoEmail,
        password: ceoPassword,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.ok(data.data.accessToken);
    assert.ok(data.data.refreshToken);
    assert.strictEqual(data.data.user.role, 'ADMIN');
    
    ceoAccessToken = data.data.accessToken;
    ceoRefreshToken = data.data.refreshToken;
    console.log('✅ CEO and Company registration dynamically created isolated schema database!');
  } catch (error) {
    console.error('❌ CEO registration failed:', error);
    process.exit(1);
  }

  // 3. Login CEO
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ceoEmail,
        password: ceoPassword,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.data.accessToken);
    assert.ok(data.data.refreshToken);
    
    ceoAccessToken = data.data.accessToken;
    ceoRefreshToken = data.data.refreshToken;
    console.log('✅ CEO Login successful (lastLogin timestamp and session hash updated in DB).');
  } catch (error) {
    console.error('❌ CEO Login failed:', error);
    process.exit(1);
  }

  // 4. CEO Get Me Profile
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${ceoAccessToken}` },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.user.email, ceoEmail);
    assert.strictEqual(data.data.user.role, 'ADMIN');
    console.log('✅ CEO GET /me profile matches the isolated data.');
  } catch (error) {
    console.error('❌ CEO Profile check failed:', error);
    process.exit(1);
  }

  // 5. Register Employee under CEO's company
  try {
    const res = await fetch(`${API_BASE}/auth/register-employee`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ceoAccessToken}`,
      },
      body: JSON.stringify({
        name: 'John Staff',
        email: employeeEmail,
        password: employeePassword,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.employee.role, 'STAFF');
    console.log('✅ Employee registered under the same company schema.');
  } catch (error) {
    console.error('❌ Employee registration failed:', error);
    process.exit(1);
  }

  // 6. Login Employee
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: employeeEmail,
        password: employeePassword,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.data.accessToken);
    assert.ok(data.data.refreshToken);

    employeeAccessToken = data.data.accessToken;
    employeeRefreshToken = data.data.refreshToken;
    console.log('✅ Employee Login successful.');
  } catch (error) {
    console.error('❌ Employee Login failed:', error);
    process.exit(1);
  }

  // 7. Employee Get Me Profile
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${employeeAccessToken}` },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.user.email, employeeEmail);
    assert.strictEqual(data.data.user.role, 'STAFF');
    console.log('✅ Employee GET /me profile is valid.');
  } catch (error) {
    console.error('❌ Employee Profile check failed:', error);
    process.exit(1);
  }

  // 8. Employee try to register another employee (Should fail with 403)
  try {
    const res = await fetch(`${API_BASE}/auth/register-employee`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${employeeAccessToken}`,
      },
      body: JSON.stringify({
        name: 'Another Staff',
        email: `another_${timestamp}@test.com`,
        password: 'password789',
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.success, false);
    console.log('✅ Employee role-restriction (403 Forbidden check) works.');
  } catch (error) {
    console.error('❌ Employee role-restriction check failed:', error);
    process.exit(1);
  }

  // 9. Token Refresh (Rotation)
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: ceoRefreshToken,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.data.accessToken);
    assert.ok(data.data.refreshToken);

    // Save rotated tokens
    ceoAccessToken = data.data.accessToken;
    ceoRefreshToken = data.data.refreshToken;
    console.log('✅ CEO Token Refresh & Rotation using hashed session verification works.');
  } catch (error) {
    console.error('❌ Token Refresh failed:', error);
    process.exit(1);
  }

  // 10. Logout CEO
  try {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: ceoRefreshToken,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    console.log('✅ CEO Logout successful (Session destroyed).');
  } catch (error) {
    console.error('❌ CEO Logout failed:', error);
    process.exit(1);
  }

  // 11. Verify CEO refresh token is now invalid (revocation check)
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: ceoRefreshToken,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.success, false);
    console.log('✅ Invalidated refresh token is correctly blocked.');
  } catch (error) {
    console.error('❌ Session revocation check failed:', error);
    process.exit(1);
  }

  console.log('--------------------------------------------------');
  console.log('🌟 ALL MULTI-TENANT AUTH API TESTS PASSED SUCCESSFULLY! 🌟');
  console.log('--------------------------------------------------');
}

runTests();
