// Additional carrier seed — richer data with all status types
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = n => new Date(Date.now() - n * 86400000);
const daysFrom = n => new Date(Date.now() + n * 86400000);

const FIRST_NAMES = ['James','Maria','Robert','Linda','Michael','Patricia','David','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen','Christopher','Lisa','Daniel','Nancy','Matthew','Betty','Anthony','Margaret','Mark','Sandra','Donald','Ashley','Steven','Dorothy','Paul','Kimberly','Andrew','Emily','Joshua','Donna','Kenneth','Michelle','Kevin','Carol','Brian','Amanda','George','Melissa','Edward','Deborah','Ronald','Stephanie','Timothy','Rebecca'];
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Wilson','Anderson','Taylor','Thomas','Moore','Jackson','Martin','Lee','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts'];

const CARRIER_EXTRA = [
  'Falcon Transport LLC', 'Summit Freight Co', 'Reliable Carriers Inc',
  'Swift Haul Solutions', 'Coastal Freight Services', 'Prairie Transport LLC',
  'NorthStar Logistics', 'Redwood Carriers', 'Desert Express LLC',
  'Glacier Freight Inc', 'Bayou Transport Co', 'Cascade Carriers LLC',
  'Emerald Logistics Inc', 'Copper State Freight', 'Silver State Transport',
  'Iron Horse Carriers', 'Thunder Freight LLC', 'Lightning Logistics',
  'Diamond Transport Inc', 'Platinum Carriers LLC', 'Ace Freight Solutions',
  'Arrow Transport LLC', 'Atlas Logistics Inc', 'Crown Carriers Co',
  'Duke Transport LLC', 'Empire Freight Inc', 'Flagship Carriers',
  'Golden Gate Logistics', 'Harbor Freight LLC', 'Imperial Transport Co',
];

const CITIES = [
  { city: 'Chicago', state: 'IL' }, { city: 'Dallas', state: 'TX' },
  { city: 'Los Angeles', state: 'CA' }, { city: 'Atlanta', state: 'GA' },
  { city: 'Houston', state: 'TX' }, { city: 'Phoenix', state: 'AZ' },
  { city: 'Sacramento', state: 'CA' }, { city: 'Detroit', state: 'MI' },
  { city: 'Memphis', state: 'TN' }, { city: 'Louisville', state: 'KY' },
  { city: 'Indianapolis', state: 'IN' }, { city: 'Columbus', state: 'OH' },
  { city: 'Charlotte', state: 'NC' }, { city: 'Nashville', state: 'TN' },
  { city: 'Denver', state: 'CO' }, { city: 'Seattle', state: 'WA' },
  { city: 'Miami', state: 'FL' }, { city: 'Portland', state: 'OR' },
  { city: 'Kansas City', state: 'MO' }, { city: 'Minneapolis', state: 'MN' },
  { city: 'San Diego', state: 'CA' }, { city: 'Fresno', state: 'CA' },
  { city: 'Sacramento', state: 'CA' }, { city: 'San Jose', state: 'CA' },
];

const EQUIPMENT = ['Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'Power Only', 'Box Truck', 'RGN'];

const STATUSES = [
  'ACTIVE','ACTIVE','ACTIVE','ACTIVE','ACTIVE','ACTIVE',
  'INACTIVE','INACTIVE',
  'SUSPENDED','SUSPENDED',
  'BLACKLISTED',
  'DNC',
  'IN_REVIEW','IN_REVIEW',
];

const BLACKLIST_REASONS = [
  'Double brokering confirmed — FMCSA investigation active',
  'Fake carrier identity — MC number belongs to different entity',
  'Multiple cargo theft incidents — Highway flagged high risk',
  'Fraudulent bank account change — payment diverted',
  'Driver arrested for cargo theft — carrier under investigation',
];

const BLACKLIST_NOTES = [
  'DO NOT USE — Do not assign any loads. Escalate all contact to compliance team.',
  'Carrier blacklisted pending FMCSA review. Contact legal@nexgentms.com for exceptions.',
  'All open loads reassigned. Carrier blocked from system on 2026-04-15.',
];

async function main() {
  console.log('🚛 Seeding additional carriers...\n');

  const usedMCs = new Set();
  const existingMCs = await prisma.carrier.findMany({ select: { mcNumber: true } });
  existingMCs.forEach(c => usedMCs.add(c.mcNumber));

  let created = 0;
  let updated = 0;

  // Update existing carriers with contactPerson
  const existing = await prisma.carrier.findMany({ where: { contactPerson: null } });
  for (const c of existing) {
    await prisma.carrier.update({
      where: { id: c.id },
      data: {
        contactPerson: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      },
    });
    updated++;
  }
  console.log(`✓ Updated ${updated} existing carriers with contact persons`);

  // Add new carriers
  for (const name of CARRIER_EXTRA) {
    const exists = await prisma.carrier.findFirst({ where: { name } });
    if (exists) continue;

    let mc;
    do { mc = `MC-${rand(100000, 999999)}`; } while (usedMCs.has(mc));
    usedMCs.add(mc);

    const city = pick(CITIES);
    const equipCount = rand(1, 3);
    const equips = [];
    const shuffled = [...EQUIPMENT].sort(() => Math.random() - 0.5);
    for (let i = 0; i < equipCount; i++) equips.push(shuffled[i]);

    const status = pick(STATUSES);
    const isBlacklisted = status === 'BLACKLISTED';
    const isDNC = status === 'DNC';

    await prisma.carrier.create({
      data: {
        name,
        mcNumber: mc,
        dotNumber: `DOT-${rand(1000000, 9999999)}`,
        contactPerson: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        email: `dispatch@${name.toLowerCase().replace(/[^a-z]/g, '').slice(0,12)}.com`,
        phone: `+1${rand(200,999)}${rand(2000000,9999999)}`,
        city: city.city,
        state: city.state,
        zipCode: `${rand(10000, 99999)}`,
        equipmentTypes: equips,
        insuranceExpiry: isBlacklisted || isDNC
          ? daysAgo(rand(30, 180))
          : Math.random() > 0.15
            ? daysFrom(rand(15, 400))
            : daysAgo(rand(1, 30)),
        authorityExpiry: isBlacklisted
          ? daysAgo(rand(10, 90))
          : daysFrom(rand(20, 365)),
        w9OnFile: status === 'ACTIVE' ? Math.random() > 0.1 : Math.random() > 0.5,
        status,
        blacklistReason: isBlacklisted ? pick(BLACKLIST_REASONS) : null,
        notes: isBlacklisted
          ? pick(BLACKLIST_NOTES)
          : isDNC
            ? 'Carrier requested DNC status. Do not contact for load opportunities.'
            : status === 'IN_REVIEW'
              ? 'Under compliance review. Awaiting FMCSA verification and insurance documents.'
              : null,
        createdAt: daysAgo(rand(30, 730)),
      },
    });

    // Add lanes for active carriers
    if (status === 'ACTIVE') {
      for (let l = 0; l < rand(2, 5); l++) {
        const o = pick(CITIES);
        const d = pick(CITIES.filter(c2 => c2.city !== o.city));
        await prisma.carrierLane.create({
          data: {
            carrierId: (await prisma.carrier.findFirst({ where: { mcNumber: mc } })).id,
            origin: `${o.city}, ${o.state}`,
            destination: `${d.city}, ${d.state}`,
            equipment: pick(equips),
            rate: Math.round((Math.random() * 1.5 + 1.8) * 100) / 100,
            lastUsed: daysAgo(rand(1, 90)),
          },
        }).catch(() => {});
      }
    }

    created++;
  }

  console.log(`✓ ${created} new carriers added`);

  // Final count
  const total = await prisma.carrier.count();
  const byStatus = await prisma.$queryRaw`SELECT status, COUNT(*) as count FROM "Carrier" GROUP BY status`;
  console.log(`\n✅ Carrier database total: ${total}`);
  console.log('📊 By status:');
  byStatus.forEach(r => console.log(`   ${r.status}: ${r.count}`));
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
