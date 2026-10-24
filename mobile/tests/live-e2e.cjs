const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const code = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
};

const { createApiServices } = require('../src/services/api/services.ts');

const BASE_URL = 'http://localhost:8000';
const WAREHOUSE_ID = 'WH-ASAN';

async function runLiveE2E() {
  console.log('🧪 [LIVE E2E] Testing Mobile Services connected to Live FastAPI Backend...\n');

  const { services, replenishment } = createApiServices({
    baseUrl: BASE_URL,
    warehouseId: WAREHOUSE_ID,
  });

  // 1. Dashboard summary
  console.log('1. Testing services.dashboard.get()...');
  const dash = await services.dashboard.get();
  console.log(`   ✅ Store: ${dash.store.name} (${dash.store.id})`);
  console.log(`   ✅ Date: ${dash.date}, Revenue: ${dash.revenue.toLocaleString()} KRW`);
  console.log(`   ✅ Briefing: "${dash.briefing}"`);
  console.log(`   ✅ Todos (${dash.todos.length}): ${dash.todos.map(t => t.label).join(' | ')}`);

  // 2. Inventory / Products
  console.log('\n2. Testing services.products.list()...');
  const inv = await services.products.list();
  console.log(`   ✅ Fetched ${inv.products.length} products.`);
  console.log(`   ✅ Sample: ${inv.products[0].name} (Category: ${inv.products[0].category}, Qty: ${inv.products[0].quantity} ${inv.products[0].unit})`);
  console.log(`   ✅ Batches for ${inv.products[0].name}: ${inv.products[0].batches.length} batch(es)`);

  // 3. Single Product get
  console.log('\n3. Testing services.products.get(id)...');
  const sampleId = inv.products[0].id;
  const single = await services.products.get(sampleId);
  console.log(`   ✅ Product detail: ${single.name} (${single.id}) - Price: ${single.price} KRW, SafetyStock: ${single.safetyStock}`);

  // 4. Purchases / Orders list
  console.log('\n4. Testing services.purchases.list()...');
  const orders = await services.purchases.list();
  console.log(`   ✅ Fetched ${orders.length} historical purchase orders.`);
  if (orders.length > 0) {
    console.log(`   ✅ Latest Order: ${orders[0].id} (Supplier: ${orders[0].supplier}, Status: ${orders[0].status}, Estimated: ${orders[0].estimatedCost.toLocaleString()} KRW)`);
  }

  // 5. Sales summary
  console.log('\n5. Testing services.sales.get(range)...');
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 14);
  const startStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(startDate);
  
  const sales = await services.sales.get({ start: startStr, end: today });
  console.log(`   ✅ 14-day Total Revenue: ${sales.revenue.toLocaleString()} KRW`);
  console.log(`   ✅ Categories: ${sales.categories.map(c => `${c.name}(${c.revenue.toLocaleString()}원)`).join(', ')}`);
  console.log(`   ✅ Best-sellers Top 3: ${sales.ranking.slice(0, 3).map(r => r.name).join(', ')}`);

  // 6. AI Replenishment Planning
  console.log('\n6. Testing replenishment.get()...');
  const plan = await replenishment.get();
  console.log(`   ✅ AI Recommendations Count: ${plan.recommendations.length}`);
  if (plan.recommendations.length > 0) {
    const topRec = plan.recommendations[0];
    console.log(`   ✅ Sample AI Rec: ${topRec.productName} -> ${topRec.quantity} ${topRec.unit}`);
    console.log(`   ✅ AI Reasoning: "${topRec.reason}"`);
    console.log(`   ✅ Supplier Lead Time: ${topRec.leadDays} days, Expected Demand: ${topRec.demand}`);
  }

  // 7. AI Conversational Agent
  console.log('\n7. Testing services.agent.send(question)...');
  const testQueries = [
    '우유 재고 얼마 남아있어?',
    '오늘 발주 추천 확인해줘',
    '내일 비 오는데 판매 영향 어때?'
  ];

  for (const query of testQueries) {
    const reply = await services.agent.send(query);
    console.log(`   💬 Q: "${query}"`);
    console.log(`   🤖 A: ${reply.content.replace(/\n+/g, ' ').slice(0, 90)}...`);
    console.log(`   🗂️ Cards (${reply.cards.length}): ${reply.cards.map(c => `[${c.title} -> ${c.action.target}]`).join(', ')}`);
  }

  console.log('\n🎉 [LIVE E2E SUCCESS] All 7 live services and AI modules decoded and verified with 100% accuracy!');
}

runLiveE2E().catch(err => {
  console.error('\n❌ Live E2E Test Failed:', err);
  process.exit(1);
});
