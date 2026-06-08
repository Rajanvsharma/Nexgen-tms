const https = require('https');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function fmcsaRequest(dotNumber) {
  const apiKey = process.env.FMCSA_API_KEY;
  if (!apiKey) return Promise.resolve(null);

  return new Promise((resolve) => {
    const url = `https://mobile.fmcsa.dot.gov/qc/services/carriers/${dotNumber}?webKey=${apiKey}`;
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function interpretSafetyData(data) {
  if (!data || !data.content) return null;
  const c = data.content;

  const ratingMap = { 'Satisfactory': 'SATISFACTORY', 'Conditional': 'CONDITIONAL', 'Unsatisfactory': 'UNSATISFACTORY' };
  const rating = ratingMap[c.safetyRating] || c.safetyRating || 'UNRATED';

  const flags = [];
  if (c.oosStatus === 'Y') flags.push('Out-of-Service Order Active');
  if (c.insuranceStatus !== 'Active') flags.push('Insurance Not Active');
  if (c.bipd_RequiredFlag === 'Y' && c.bipd_OnFileFlag !== 'Y') flags.push('BIPD Insurance Not on File');
  if (c.safetyRating === 'Unsatisfactory') flags.push('Unsatisfactory Safety Rating');
  if (parseInt(c.crashTotal || '0') > 10) flags.push(`High crash count: ${c.crashTotal}`);
  if (parseInt(c.driverOosInsp || '0') > 0) flags.push(`${c.driverOosInsp} OOS driver inspections`);

  return {
    dotNumber: c.dotNumber,
    legalName: c.legalName,
    dbaName: c.dbaName,
    operatingStatus: c.carrierOperation || c.operatingStatus,
    safetyRating: rating,
    ratedDate: c.ratingDate,
    insuranceStatus: c.insuranceStatus,
    authorityStatus: c.authorityStatus,
    totalDrivers: c.totalDrivers,
    totalPowerUnits: c.totalPowerUnits,
    crashTotal: c.crashTotal,
    fatalCrash: c.fatalCrash,
    injuryCrash: c.injuryCrash,
    driverOosInsp: c.driverOosInsp,
    vehicleOosInsp: c.vehicleOosInsp,
    flags,
    riskLevel: flags.length === 0 ? 'LOW' : flags.length <= 2 ? 'MEDIUM' : 'HIGH',
    checkedAt: new Date().toISOString(),
  };
}

async function checkCarrierSafety(req, res) {
  try {
    const carrier = await prisma.carrier.findUnique({ where: { id: req.params.id } });
    if (!carrier) return res.status(404).json({ message: 'Carrier not found' });

    if (!carrier.dotNumber) {
      return res.json({
        configured: !!process.env.FMCSA_API_KEY,
        simulated: true,
        message: 'No DOT number on file for this carrier. Add a DOT number to enable safety checks.',
        carrier: { name: carrier.name, mcNumber: carrier.mcNumber },
      });
    }

    const data = await fmcsaRequest(carrier.dotNumber);

    if (!data) {
      // No API key — return simulated data with instructions
      return res.json({
        configured: false,
        simulated: true,
        dotNumber: carrier.dotNumber,
        legalName: carrier.name,
        message: 'FMCSA API key not configured. Add FMCSA_API_KEY to your Render env vars (free at https://mobile.fmcsa.dot.gov/developer/home.page)',
        manualCheckUrl: `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${carrier.dotNumber}`,
      });
    }

    const result = interpretSafetyData(data);
    if (!result) return res.status(500).json({ message: 'FMCSA returned unexpected data' });

    // Auto-flag carrier if high risk
    if (result.riskLevel === 'HIGH' && carrier.status === 'ACTIVE') {
      await prisma.carrier.update({
        where: { id: carrier.id },
        data: { status: 'IN_REVIEW', notes: `Auto-flagged: FMCSA check found ${result.flags.join(', ')}` },
      });
      result.autoFlagged = true;
    }

    res.json({ configured: true, simulated: false, ...result });
  } catch (err) {
    console.error('checkCarrierSafety error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { checkCarrierSafety };
