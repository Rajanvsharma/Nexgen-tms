const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = n => new Date(Date.now() - n * 86400000);
const daysFrom = n => new Date(Date.now() + n * 86400000);
const money = (min, max) => Math.round((Math.random() * (max - min) + min) * 100) / 100;

// ─── Real TMS data ─────────────────────────────────────────────────────────────
const CITIES = [
  { city: 'Chicago', state: 'IL' }, { city: 'Dallas', state: 'TX' },
  { city: 'Los Angeles', state: 'CA' }, { city: 'Atlanta', state: 'GA' },
  { city: 'Houston', state: 'TX' }, { city: 'Phoenix', state: 'AZ' },
  { city: 'Philadelphia', state: 'PA' }, { city: 'San Antonio', state: 'TX' },
  { city: 'Detroit', state: 'MI' }, { city: 'Memphis', state: 'TN' },
  { city: 'Louisville', state: 'KY' }, { city: 'Indianapolis', state: 'IN' },
  { city: 'Columbus', state: 'OH' }, { city: 'Charlotte', state: 'NC' },
  { city: 'Nashville', state: 'TN' }, { city: 'El Paso', state: 'TX' },
  { city: 'Denver', state: 'CO' }, { city: 'Seattle', state: 'WA' },
  { city: 'Miami', state: 'FL' }, { city: 'Portland', state: 'OR' },
  { city: 'Kansas City', state: 'MO' }, { city: 'Cleveland', state: 'OH' },
  { city: 'Minneapolis', state: 'MN' }, { city: 'New Orleans', state: 'LA' },
];

const EQUIPMENT = ['Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'Power Only', 'Box Truck', 'RGN'];
const COMMODITIES = ['Frozen Foods', 'Electronics', 'Steel Coils', 'Auto Parts', 'Beverages', 'Chemicals', 'Lumber', 'Paper Products', 'Machinery', 'Consumer Goods', 'Medical Supplies', 'Fresh Produce', 'Packaged Goods', 'Building Materials', 'Agricultural Products'];

const CARRIER_NAMES = [
  'Apex Logistics LLC', 'Ironclad Freight Inc', 'Velocity Carriers',
  'Roadway Express Co', 'Sunbelt Trucking', 'Quik Haul Transport',
  'Midwest Freight Solutions', 'Blue Ridge Carriers', 'Eagle Transport LLC',
  'Premier Logistics Group', 'FastLane Trucking', 'Continental Freight',
  'Liberty Haulers Inc', 'Guardian Logistics', 'Titan Transport Co',
  'Pacific Rim Freight', 'Lone Star Carriers', 'Great Lakes Logistics',
  'Atlantic Freight Services', 'Southern Express LLC', 'Mountain States Trucking',
  'Keystone Freight Inc', 'Patriot Transport', 'Alliance Carriers',
  'Delta Freight Corp', 'Horizon Logistics', 'Summit Trucking LLC',
  'Crossroads Freight', 'Heritage Transport', 'National Freight Systems',
];

const CUSTOMER_NAMES = [
  'Midwest Foods Inc', 'Lone Star Beverages', 'Great Lakes Steel',
  'Pacific Produce Co', 'Atlantic Electronics Corp', 'Southern Manufacturing LLC',
  'National Paper Products', 'Cardinal Distribution', 'Beacon Chemical Co',
  'Frontier Lumber Inc', 'Metro Building Supplies', 'Coastal Seafood Corp',
  'Rocky Mountain Dairy', 'Prairie Grain Cooperative', 'Suncoast Medical Supplies',
  'Heritage Auto Parts', 'Precision Machinery Co', 'Global Consumer Goods',
  'American Apparel Dist.', 'Blue Ridge Agricultural',
];

const USERS_DATA = [
  { firstName: 'Sarah', lastName: 'Mitchell', email: 'sarah@nexgentms.com', role: 'DISPATCHER' },
  { firstName: 'Marcus', lastName: 'Williams', email: 'marcus@nexgentms.com', role: 'DISPATCHER' },
  { firstName: 'Priya', lastName: 'Sharma', email: 'priya@nexgentms.com', role: 'DISPATCHER' },
  { firstName: 'Owen', lastName: 'Reyes', email: 'owen@nexgentms.com', role: 'COMPLIANCE' },
  { firstName: 'Tasha', lastName: 'Kim', email: 'tasha@nexgentms.com', role: 'ACCOUNTING' },
  { firstName: 'Carlos', lastName: 'Rivera', email: 'carlos@nexgentms.com', role: 'DISPATCHER' },
  { firstName: 'Diana', lastName: 'Foster', email: 'diana@nexgentms.com', role: 'ACCOUNTING' },
];

const ANNOUNCEMENT_DATA = [
  { title: 'Q3 Insurance Audit Window Opens June 10', body: 'All carrier COIs must be re-verified before posting loads. Expiring certs are flagged on the Compliance board. Please review and update all carrier documents by June 10th.', role: 'COMPLIANCE' },
  { title: 'QuickBooks Sync Moved to Nightly 2am CT', body: 'Invoice exports now batch overnight. Same-day push is available via the load Actions menu for urgent invoices. Contact accounting for manual exports.', role: 'ACCOUNTING' },
  { title: 'New Load Board: BulkLoads Now Live', body: 'BulkLoads posting is enabled for flatbed and bulk commodity loads. One-click posting works from any load detail page. Estimated reach: 12,000+ additional carriers.', role: 'ADMIN' },
  { title: 'Rate Alert: Chicago-Dallas Lane Up 8%', body: 'Market rates on the Chicago to Dallas reefer lane have increased 8% this week. Please reprice any pending quotes on this lane. Current market band: $2.50-$2.80/mi.', role: 'ADMIN' },
  { title: 'Carrier Onboarding Process Updated', body: 'New carrier onboarding now requires Highway verification before any load assignment. The compliance team will review all new carriers within 24 hours of submission.', role: 'COMPLIANCE' },
];

async function main() {
  console.log('🌱 Starting demo data seed...\n');

  // ─── 1. Hash password ─────────────────────────────────────────────────────
  const hashed = await bcrypt.hash('Admin@1234', 12);

  // ─── 2. Admin user ────────────────────────────────────────────────────────
  let admin = await prisma.user.findUnique({ where: { email: 'admin@nexgentms.com' } });
  if (!admin) {
    admin = await prisma.user.create({
      data: { email: 'admin@nexgentms.com', password: hashed, firstName: 'System', lastName: 'Admin', role: 'ADMIN', isActive: true },
    });
    console.log('✓ Admin user created');
  } else {
    console.log('✓ Admin user exists');
  }

  // ─── 3. Team users ────────────────────────────────────────────────────────
  const users = [admin];
  for (const u of USERS_DATA) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      const user = await prisma.user.create({
        data: { ...u, password: hashed, isActive: true },
      });
      users.push(user);
    } else {
      users.push(existing);
    }
  }
  console.log(`✓ ${users.length} users ready`);

  // ─── 4. Customers ─────────────────────────────────────────────────────────
  const customers = [];
  for (const name of CUSTOMER_NAMES) {
    const existing = await prisma.customer.findFirst({ where: { name } });
    if (!existing) {
      const city = pick(CITIES);
      const c = await prisma.customer.create({
        data: {
          name,
          email: `logistics@${name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
          phone: `(${rand(200,999)}) ${rand(200,999)}-${rand(1000,9999)}`,
          city: city.city, state: city.state,
          creditTerms: pick([15, 30, 45, 60]),
          isActive: Math.random() > 0.1,
          createdById: admin.id,
        },
      });
      customers.push(c);
    } else {
      customers.push(existing);
    }
  }
  console.log(`✓ ${customers.length} customers ready`);

  // ─── 5. Carriers ──────────────────────────────────────────────────────────
  const carriers = [];
  const usedMCs = new Set();
  for (const name of CARRIER_NAMES) {
    const existing = await prisma.carrier.findFirst({ where: { name } });
    if (!existing) {
      let mc;
      do { mc = `MC-${rand(100000, 999999)}`; } while (usedMCs.has(mc));
      usedMCs.add(mc);

      const city = pick(CITIES);
      const equipCount = rand(1, 4);
      const equips = [];
      const shuffled = [...EQUIPMENT].sort(() => Math.random() - 0.5);
      for (let i = 0; i < equipCount; i++) equips.push(shuffled[i]);

      const statusRoll = Math.random();
      const status = statusRoll > 0.85 ? 'SUSPENDED' : statusRoll > 0.7 ? 'INACTIVE' : 'ACTIVE';

      const c = await prisma.carrier.create({
        data: {
          name,
          mcNumber: mc,
          dotNumber: `DOT-${rand(1000000, 9999999)}`,
          email: `dispatch@${name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
          phone: `(${rand(200,999)}) ${rand(200,999)}-${rand(1000,9999)}`,
          city: city.city, state: city.state,
          equipmentTypes: equips,
          insuranceExpiry: Math.random() > 0.15 ? daysFrom(rand(10, 400)) : daysAgo(rand(1, 30)),
          authorityExpiry: Math.random() > 0.2 ? daysFrom(rand(20, 365)) : daysAgo(rand(1, 20)),
          w9OnFile: Math.random() > 0.2,
          status,
          notes: status === 'SUSPENDED' ? 'Suspended due to expired documents. Reactivate after renewal.' : null,
        },
      });
      carriers.push(c);

      // Add carrier lanes
      const laneCount = rand(2, 5);
      for (let l = 0; l < laneCount; l++) {
        const o = pick(CITIES); const d = pick(CITIES);
        if (o.city !== d.city) {
          await prisma.carrierLane.create({
            data: { carrierId: c.id, origin: `${o.city}, ${o.state}`, destination: `${d.city}, ${d.state}`, equipment: pick(equips), rate: money(1.80, 3.50), lastUsed: daysAgo(rand(1, 90)) },
          }).catch(() => {});
        }
      }
    } else {
      carriers.push(existing);
    }
  }
  console.log(`✓ ${carriers.length} carriers ready`);

  // ─── 6. Quotes ────────────────────────────────────────────────────────────
  let quoteNum = 1001;
  const lastQuote = await prisma.quote.findFirst({ orderBy: { createdAt: 'desc' }, select: { quoteNumber: true } });
  if (lastQuote) quoteNum = parseInt(lastQuote.quoteNumber.replace('Q-', '')) + 1;

  const quotes = [];
  const quoteStatuses = ['PENDING', 'PENDING', 'APPROVED', 'APPROVED', 'APPROVED', 'REJECTED', 'CONVERTED'];

  for (let i = 0; i < 35; i++) {
    const customer = pick(customers);
    const o = pick(CITIES); const d = pick(CITIES);
    if (o.city === d.city) continue;
    const equip = pick(EQUIPMENT);
    const rate = money(800, 4500);
    const status = pick(quoteStatuses);
    const createdDays = rand(1, 60);

    try {
      const q = await prisma.quote.create({
        data: {
          quoteNumber: `Q-${String(quoteNum++).padStart(5, '0')}`,
          customerId: customer.id,
          status,
          pickupCity: o.city, pickupState: o.state,
          deliveryCity: d.city, deliveryState: d.state,
          commodity: pick(COMMODITIES),
          weight: rand(15000, 45000),
          equipment: equip,
          pickupDate: daysFrom(rand(-5, 30)),
          deliveryDate: daysFrom(rand(1, 35)),
          rate,
          source: pick(['Manual', 'Email', 'Manual', 'Screenshot', 'Manual']),
          createdById: pick(users).id,
          createdAt: daysAgo(createdDays),
          updatedAt: daysAgo(rand(0, createdDays)),
        },
      });
      quotes.push(q);
    } catch { /* skip duplicates */ }
  }
  console.log(`✓ ${quotes.length} quotes created`);

  // ─── 7. Loads ─────────────────────────────────────────────────────────────
  let loadNum = 10001;
  const lastLoad = await prisma.load.findFirst({ orderBy: { createdAt: 'desc' }, select: { loadNumber: true } });
  if (lastLoad) loadNum = parseInt(lastLoad.loadNumber.replace('PRO-', '')) + 1;

  const loadStatuses = [
    ...Array(8).fill('CREATED'),
    ...Array(10).fill('DISPATCHED'),
    ...Array(12).fill('IN_TRANSIT'),
    ...Array(20).fill('DELIVERED'),
    ...Array(8).fill('INVOICED'),
    ...Array(2).fill('CANCELLED'),
  ];

  const createdLoads = [];
  for (let i = 0; i < 60; i++) {
    const customer = pick(customers);
    const o = pick(CITIES); const d = pick(CITIES);
    if (o.city === d.city) continue;
    const equip = pick(EQUIPMENT);
    const status = pick(loadStatuses);
    const customerRate = money(900, 5200);
    const hasCarrier = status !== 'CREATED';
    const carrier = hasCarrier ? pick(carriers.filter(c => c.status === 'ACTIVE')) : null;
    const carrierRate = carrier ? Math.round(customerRate * (Math.random() * 0.25 + 0.65)) : null;
    const createdDays = rand(1, 90);
    const margin = carrierRate ? Math.round((customerRate - carrierRate) / customerRate * 100 * 10) / 10 : null;

    try {
      const load = await prisma.load.create({
        data: {
          loadNumber: `PRO-${String(loadNum++).padStart(6, '0')}`,
          customerId: customer.id,
          carrierId: carrier?.id || null,
          status,
          pickupCity: o.city, pickupState: o.state,
          deliveryCity: d.city, deliveryState: d.state,
          commodity: pick(COMMODITIES),
          weight: rand(18000, 44000),
          equipment: equip,
          pickupDate: status === 'CREATED' ? daysFrom(rand(1, 14)) : daysAgo(rand(1, 60)),
          deliveryDate: status === 'DELIVERED' || status === 'INVOICED' ? daysAgo(rand(0, 45)) : daysFrom(rand(1, 10)),
          customerRate,
          carrierRate,
          margin,
          driverName: carrier ? `${pick(['James','Maria','Robert','Linda','Michael','Patricia','David','Barbara'])} ${pick(['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis'])}` : null,
          driverPhone: carrier ? `(${rand(200,999)}) ${rand(200,999)}-${rand(1000,9999)}` : null,
          isDuplicate: Math.random() < 0.03,
          createdById: pick(users).id,
          createdAt: daysAgo(createdDays),
          updatedAt: daysAgo(rand(0, createdDays)),
        },
      });
      createdLoads.push(load);

      // Add notes to some loads
      if (Math.random() > 0.5) {
        const noteTexts = [
          'Customer requested temperature monitoring every 2 hours.',
          'Carrier confirmed pickup window 8am-10am.',
          'Lumper service required at delivery — $150 charged to receiver.',
          'HAZMAT placard required. Carrier confirmed proper certification.',
          'Customer approved detention charges of $75/hr after 2 hours.',
          'Team drive required — 1,800+ mile run.',
          'Live load — 4 hours at shipper.',
          'Appointment confirmed for delivery dock #3.',
        ];
        await prisma.note.create({
          data: {
            body: pick(noteTexts),
            authorId: pick(users).id,
            loadId: load.id,
            createdAt: daysAgo(rand(0, createdDays)),
          },
        }).catch(() => {});
      }
    } catch { /* skip */ }
  }
  console.log(`✓ ${createdLoads.length} loads created`);

  // ─── 8. Invoices ──────────────────────────────────────────────────────────
  let invNum = 1001;
  const invoiceStatuses = ['DRAFT', 'SENT', 'SENT', 'PAID', 'PAID', 'PAID', 'OVERDUE'];
  let invoiceCount = 0;

  for (const load of createdLoads.filter(l => ['DELIVERED', 'INVOICED'].includes(l.status))) {
    const existing = await prisma.invoice.findUnique({ where: { loadId: load.id } });
    if (!existing) {
      const status = pick(invoiceStatuses);
      const dueDate = daysFrom(rand(-30, 45));
      try {
        await prisma.invoice.create({
          data: {
            invoiceNumber: `INV-${String(invNum++).padStart(5, '0')}`,
            loadId: load.id,
            customerId: load.customerId,
            amount: load.customerRate,
            status,
            dueDate,
            paidDate: status === 'PAID' ? daysAgo(rand(1, 30)) : null,
            isFactored: Math.random() < 0.15,
            createdAt: daysAgo(rand(1, 60)),
          },
        });
        invoiceCount++;
      } catch { /* skip */ }
    }
  }
  console.log(`✓ ${invoiceCount} invoices created`);

  // ─── 9. Carrier Payments ──────────────────────────────────────────────────
  let payCount = 0;
  const payStatuses = ['PENDING', 'PENDING', 'PAID', 'PAID', 'PAID', 'SCHEDULED'];

  for (const load of createdLoads.filter(l => l.carrierId && l.carrierRate && ['DELIVERED','INVOICED'].includes(l.status))) {
    const existing = await prisma.carrierPayment.findUnique({ where: { loadId: load.id } });
    if (!existing) {
      const status = pick(payStatuses);
      try {
        await prisma.carrierPayment.create({
          data: {
            loadId: load.id,
            carrierId: load.carrierId,
            amount: load.carrierRate,
            status,
            dueDate: daysFrom(rand(-10, 45)),
            paidDate: status === 'PAID' ? daysAgo(rand(1, 25)) : null,
            createdAt: daysAgo(rand(1, 50)),
          },
        });
        payCount++;
      } catch { /* skip */ }
    }
  }
  console.log(`✓ ${payCount} carrier payments created`);

  // ─── 10. Load Performance Records ────────────────────────────────────────
  let perfCount = 0;
  for (const load of createdLoads.filter(l => l.carrierId && l.status === 'DELIVERED').slice(0, 25)) {
    const existing = await prisma.loadPerformance.findUnique({ where: { loadId: load.id } });
    if (!existing) {
      const onTime = Math.random() > 0.25;
      try {
        await prisma.loadPerformance.create({
          data: {
            loadId: load.id,
            carrierId: load.carrierId,
            scheduledPickup: daysAgo(rand(3, 20)),
            actualPickup: daysAgo(rand(2, 18)),
            scheduledDelivery: daysAgo(rand(1, 15)),
            actualDelivery: daysAgo(rand(0, 14)),
            pickupOnTime: onTime,
            deliveryOnTime: Math.random() > 0.2,
            hasDetention: Math.random() < 0.2,
            detentionHours: Math.random() < 0.2 ? rand(1, 6) : null,
            hasClaim: Math.random() < 0.05,
            claimAmount: Math.random() < 0.05 ? money(500, 5000) : null,
            rating: rand(3, 5),
            notes: onTime ? null : 'Carrier ran 45 minutes late on pickup. Traffic delay reported.',
          },
        });
        perfCount++;
      } catch { /* skip */ }
    }
  }
  console.log(`✓ ${perfCount} performance records created`);

  // ─── 11. Announcements ───────────────────────────────────────────────────
  let annCount = 0;
  for (const ann of ANNOUNCEMENT_DATA) {
    const poster = users.find(u => u.role === ann.role) || admin;
    const exists = await prisma.announcement.findFirst({ where: { title: ann.title } });
    if (!exists) {
      await prisma.announcement.create({
        data: {
          title: ann.title,
          body: ann.body,
          postedBy: poster.id,
          createdAt: daysAgo(rand(1, 14)),
        },
      });
      annCount++;
    }
  }
  console.log(`✓ ${annCount} announcements created`);

  // ─── 12. Agent Logs ──────────────────────────────────────────────────────
  const agentNames = ['Compliance Guardian', 'Fraud Sentinel', 'Invoice Aging Agent', 'Rate Intelligence Agent', 'Duplicate Detector', 'AI Insights Agent'];
  let agentCount = 0;
  for (const agentName of agentNames) {
    for (let r = 0; r < rand(3, 8); r++) {
      const findings = rand(0, 12);
      const actions = rand(0, findings);
      const started = daysAgo(rand(0, 7));
      await prisma.agentLog.create({
        data: {
          agentName,
          status: Math.random() > 0.05 ? 'COMPLETED' : 'ERROR',
          findings,
          actions,
          summary: getSummary(agentName, findings, actions),
          startedAt: started,
          completedAt: new Date(started.getTime() + rand(2000, 15000)),
        },
      });
      agentCount++;
    }
  }
  console.log(`✓ ${agentCount} agent logs created`);

  // ─── 13. Conversations (Console) ─────────────────────────────────────────
  const convSubjects = [
    'Please approve this shipper — Midwest Foods Inc',
    'Carrier insurance renewal needed — Apex Logistics',
    'Please attach the Lumper Receipt to load PRO-010042',
    'Rate confirmation needed for Dallas → Houston run',
    'Customer dispute on detention charges — load PRO-010019',
    'CarrierQ match request — Chicago to Atlanta flatbed',
    'Invoice INV-01022 payment follow-up',
    'New carrier onboarding — Falcon Transport LLC',
    'Compliance question: W9 not on file for Velocity Carriers',
    'Emergency: Load at risk — driver unresponsive',
  ];
  const convStatuses = ['NEW', 'OPEN', 'OPEN', 'ESCALATED', 'RESOLVED', 'RESOLVED', 'REOPENED'];
  let convCount = 0;

  for (let i = 0; i < convSubjects.length; i++) {
    const subject = convSubjects[i];
    const status = convStatuses[i % convStatuses.length];
    const creator = pick(users);
    const load = pick(createdLoads);
    const customer = pick(customers);

    const conv = await prisma.conversation.create({
      data: {
        subject,
        status,
        priority: status === 'ESCALATED' ? 'HIGH' : pick(['NORMAL', 'NORMAL', 'LOW']),
        createdById: creator.id,
        loadId: Math.random() > 0.4 ? load.id : null,
        customerId: Math.random() > 0.5 ? customer.id : null,
        createdAt: daysAgo(rand(0, 14)),
        updatedAt: daysAgo(rand(0, 3)),
      },
    });

    // Add messages
    const msgCount = rand(1, 6);
    const msgTexts = [
      'Hi team, can you please review and approve this shipper account?',
      'Carrier has provided updated COI — please verify with compliance team.',
      'Driver confirmed ETA 2:30pm. Lumper receipt attached to BOL.',
      'Customer approved the rate — please generate rate confirmation.',
      'We need to resolve this today. Customer is calling every hour.',
      'I\'ve reviewed the documents. Everything looks good, approved.',
      'Flagging this as escalated — need manager review ASAP.',
      'Rate confirmed. Carrier dispatched, pickup window 8-10am.',
      'Payment processed and sent via ACH. Reference #TRN-4821.',
      'Issue resolved. Customer was satisfied with the outcome.',
    ];

    for (let m = 0; m < msgCount; m++) {
      await prisma.convMessage.create({
        data: {
          conversationId: conv.id,
          senderId: pick(users).id,
          content: pick(msgTexts),
          isInternal: m > 0 && Math.random() < 0.2,
          createdAt: new Date(conv.createdAt.getTime() + m * rand(300000, 3600000)),
        },
      });
    }
    convCount++;
  }
  console.log(`✓ ${convCount} conversations with messages created`);

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('\n✅ Demo data seed complete!\n');
  console.log('📊 Database summary:');
  console.log(`   Users:         ${users.length}`);
  console.log(`   Customers:     ${customers.length}`);
  console.log(`   Carriers:      ${carriers.length}`);
  console.log(`   Quotes:        ${quotes.length}`);
  console.log(`   Loads:         ${createdLoads.length}`);
  console.log(`   Invoices:      ${invoiceCount}`);
  console.log(`   Payments:      ${payCount}`);
  console.log(`   Conversations: ${convCount}`);
  console.log('\n🔑 Login: admin@nexgentms.com / Admin@1234');
}

function getSummary(name, findings, actions) {
  const msgs = {
    'Compliance Guardian': `Scanned carriers. Blocked ${actions} with expired docs. Flagged ${findings - actions} expiring soon.`,
    'Fraud Sentinel': `Scanned active loads. Found ${findings} high-risk carrier assignments requiring review.`,
    'Invoice Aging Agent': `Scanned sent invoices. ${findings} overdue. Marked ${actions} as OVERDUE status.`,
    'Rate Intelligence Agent': `Scanned active loads. Flagged ${findings} loads with margin below 10%.`,
    'Duplicate Detector': `Checked active loads. Flagged ${findings} potential duplicates for review.`,
    'AI Insights Agent': findings > 0 ? `Generated daily AI briefing and posted as announcement. ${findings} insights identified.` : 'Skipped — ANTHROPIC_API_KEY not configured.',
  };
  return msgs[name] || `Completed with ${findings} findings and ${actions} actions.`;
}

main()
  .catch(e => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
