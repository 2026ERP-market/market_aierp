const http = require('node:http');

const BASE_URL = 'http://localhost:8000';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testPurchasesWorkflow() {
  console.log('🧪 [TEST] Starting Full ERP Purchases Workflow Verification...\n');

  // Step 0: Get recommendations
  console.log('Step 0: GET /api/v1/purchases/recommend?warehouse_id=WH-ASAN');
  const recRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: '/api/v1/purchases/recommend?warehouse_id=WH-ASAN',
    method: 'GET'
  });
  if (recRes.status !== 200 || !recRes.body.length) {
    throw new Error('Failed to retrieve recommendations');
  }
  console.log(`   ✅ Fetched ${recRes.body.length} recommendations from AI engine.`);
  const sampleRec1 = recRes.body[0];
  const sampleRec2 = recRes.body[1] || recRes.body[0];

  // Step 1: POST /api/v1/purchases/drafts (Multi-item draft creation with supplier splitting)
  console.log('\nStep 1: POST /api/v1/purchases/drafts (Multi-item draft creation)');
  const draftsRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: '/api/v1/purchases/drafts',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    warehouse_id: 'WH-ASAN',
    items: [
      { rec_id: sampleRec1.rec_id, item_id: sampleRec1.item_id, order_qty: Number(sampleRec1.recommended_qty) },
      { rec_id: sampleRec2.rec_id, item_id: sampleRec2.item_id, order_qty: Number(sampleRec2.recommended_qty) }
    ],
    memo: 'E2E 자동 발주 초안'
  });

  console.log(`   Status: ${draftsRes.status}, Created drafts: ${draftsRes.body.created_count}`);
  if (draftsRes.status !== 201 || !draftsRes.body.drafts.length) {
    throw new Error(`Draft creation failed: ${JSON.stringify(draftsRes.body)}`);
  }
  const targetDraft = draftsRes.body.drafts[0];
  const poId = targetDraft.po_id;
  console.log(`   ✅ Target Draft: ${poId} (Supplier: ${targetDraft.supplier_name}, Status: ${targetDraft.status}, Version: ${targetDraft.version})`);
  console.log(`   ✅ Allowed Actions: [${targetDraft.allowed_actions.join(', ')}]`);

  // Step 2: GET /api/v1/purchases/orders/{po_id} (Detail lookup)
  console.log(`\nStep 2: GET /api/v1/purchases/orders/${poId}`);
  const detailRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/purchases/orders/${poId}`,
    method: 'GET'
  });
  console.log(`   Status: ${detailRes.status}, Lines count: ${detailRes.body.lines.length}`);
  if (detailRes.status !== 200) throw new Error('Detail lookup failed');

  // Step 3: Attempt receiving unconfirmed draft (Expect 409 Conflict)
  console.log('\nStep 3: Attempt receiving unconfirmed draft PO (Expect 409)');
  const prematureReceiveRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/purchases/orders/${poId}/receive`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    received_items: [{ line_no: 1, additional_received_qty: 5 }]
  });
  console.log(`   Status: ${prematureReceiveRes.status} (Detail: ${prematureReceiveRes.body?.detail})`);
  if (prematureReceiveRes.status !== 409) {
    throw new Error(`Expected 409, got ${prematureReceiveRes.status}`);
  }
  console.log('   ✅ Correctly blocked receiving on draft PO');

  // Step 4: PATCH /api/v1/purchases/orders/{po_id} with wrong version (Expect 409 Conflict)
  console.log('\nStep 4: Test Optimistic Concurrency Control on PATCH (Wrong version -> Expect 409)');
  const stalePatchRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/purchases/orders/${poId}`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  }, {
    expected_version: 999, // Stale version
    lines: [{ line_no: 1, order_qty: 50 }]
  });
  console.log(`   Status: ${stalePatchRes.status} (Detail: ${stalePatchRes.body?.detail})`);
  if (stalePatchRes.status !== 409) {
    throw new Error(`Expected 409 for version conflict, got ${stalePatchRes.status}`);
  }
  console.log('   ✅ Correctly blocked stale version update');

  // Step 5: PATCH /api/v1/purchases/orders/{po_id} with correct version
  console.log('\nStep 5: PATCH /api/v1/purchases/orders/{po_id} with correct version');
  const validPatchRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/purchases/orders/${poId}`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  }, {
    expected_version: targetDraft.version,
    lines: [{ line_no: 1, order_qty: 20 }],
    memo: '수량 20개로 수정'
  });
  console.log(`   Status: ${validPatchRes.status}`);
  console.log(`   ✅ Updated Version: ${validPatchRes.body.version}, Total Amount: ${validPatchRes.body.total_amount.toLocaleString()} KRW`);
  const currentVersion = validPatchRes.body.version;

  // Step 6: POST /api/v1/purchases/orders/{po_id}/confirm (사장님 최종 확정)
  console.log(`\nStep 6: POST /api/v1/purchases/orders/${poId}/confirm`);
  const confirmRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/purchases/orders/${poId}/confirm`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    expected_version: currentVersion
  });
  console.log(`   Status: ${confirmRes.status}`);
  console.log(`   ✅ PO Status: ${confirmRes.body.status}, New Version: ${confirmRes.body.version}`);
  console.log(`   ✅ Allowed Actions after confirm: [${confirmRes.body.allowed_actions.join(', ')}]`);
  if (confirmRes.body.status !== 'ordered') throw new Error('Expected status to be ordered');

  // Step 7: Over-receipt rejection (Expect 400 Bad Request)
  console.log('\nStep 7: Over-receipt rejection (Order qty: 20, try receiving 25 -> Expect 400)');
  const overReceiveRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/purchases/orders/${poId}/receive`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    received_items: [{ line_no: 1, additional_received_qty: 25 }]
  });
  console.log(`   Status: ${overReceiveRes.status} (Detail: ${overReceiveRes.body?.detail})`);
  if (overReceiveRes.status !== 400) throw new Error(`Expected 400, got ${overReceiveRes.status}`);
  console.log('   ✅ Correctly rejected over-receipt');

  // Step 8: Partial Receive (Receive 8 out of 20 -> Expect partial)
  console.log('\nStep 8: Partial receive (Receive 8 out of 20 -> Expect partial)');
  const partialRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/purchases/orders/${poId}/receive`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    received_items: [{ line_no: 1, additional_received_qty: 8, expiry_date: '2026-11-25' }]
  });
  console.log(`   Status: ${partialRes.status}, Result Status: ${partialRes.body.status}`);
  console.log(`   ✅ Created Batch: ${partialRes.body.created_batches.join(', ')}`);
  if (partialRes.body.status !== 'partial') throw new Error('Expected status partial');

  // Step 9: Remaining Receive (Receive remaining 12 -> Expect received)
  console.log('\nStep 9: Complete remaining receive (Receive 12 -> Expect received)');
  const fullRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/purchases/orders/${poId}/receive`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    received_items: [{ line_no: 1, additional_received_qty: 12, expiry_date: '2026-11-25' }]
  });
  console.log(`   Status: ${fullRes.status}, Result Status: ${fullRes.body.status}`);
  if (fullRes.body.status !== 'received') throw new Error('Expected status received');

  // Step 10: Attempt receiving on completed PO (Expect 409 Conflict)
  console.log('\nStep 10: Attempt receiving on already completed PO (Expect 409)');
  const duplicateReceiveRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/purchases/orders/${poId}/receive`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    received_items: [{ line_no: 1, additional_received_qty: 1 }]
  });
  console.log(`   Status: ${duplicateReceiveRes.status} (Detail: ${duplicateReceiveRes.body?.detail})`);
  if (duplicateReceiveRes.status !== 409) throw new Error('Expected 409');
  console.log('   ✅ Correctly blocked receiving on already completed PO');

  // Step 11: Create separate draft and test cancel
  console.log('\nStep 11: Test draft cancellation (POST /api/v1/purchases/orders/{id}/cancel)');
  const cancelDraftRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: '/api/v1/purchases/draft',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { rec_id: sampleRec1.rec_id, warehouse_id: 'WH-ASAN' });

  const cancelPoId = cancelDraftRes.body.po_id;
  const cancelRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/purchases/orders/${cancelPoId}/cancel`,
    method: 'POST'
  });
  console.log(`   Status: ${cancelRes.status}, Status after cancel: ${cancelRes.body.status}`);
  if (cancelRes.body.status !== 'cancelled') throw new Error('Expected cancelled');
  console.log('   ✅ Correctly cancelled draft PO');

  console.log('\n🎉 [WORKFLOW SUCCESS] All 11 workflow tests, optimistic concurrency, and validation rules passed 100%!');
}

testPurchasesWorkflow().catch(err => {
  console.error('\n❌ Purchases Workflow Test Failed:', err);
  process.exit(1);
});
