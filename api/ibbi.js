export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  function cleanCell(html) {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractPdfLink(cellHtml) {
    // Extract href from <a href=https://ibbi.gov.in//uploads/...pdf
    const m = cellHtml.match(/href=(https:\/\/ibbi\.gov\.in\/[^\s"']+\.pdf)/i);
    if (m) return m[1].replace('//', '/').replace('ibbi.gov.in/', 'ibbi.gov.in/');
    return '';
  }

  function extractPdfSize(cellHtml) {
    const m = cellHtml.match(/\(([0-9.]+ [KMG]B)\)/i);
    return m ? m[1] : '';
  }

  function getRows(html) {
    const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) return [];
    return [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map(r => [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map(c => ({ text: cleanCell(c[1]), raw: c[1] })));
  }

  const HEADER_MARKERS = ['Name of Corporate Debtor', 'Type of PA', 'S. No.'];
  function isHeaderRow(cells) {
    return cells.some(c => HEADER_MARKERS.includes(c.text));
  }

  // Determine company type/scale from name
  function inferScale(name) {
    const n = (name || '').toUpperCase();
    if (n.includes('LIMITED') && !n.includes('PRIVATE')) return 'Public Ltd';
    if (n.includes('PRIVATE LIMITED') || n.includes('PVT. LTD') || n.includes('PVT LTD')) return 'Pvt Ltd';
    if (n.includes('LLP')) return 'LLP';
    if (n.includes('CORPORATION')) return 'Corporation';
    if (n.includes('INDUSTRIES') || n.includes('MANUFACTURING') || n.includes('STEEL') || n.includes('TEXTILE')) return 'Manufacturing';
    if (n.includes('FINANCE') || n.includes('LEASING') || n.includes('CAPITAL') || n.includes('CREDIT')) return 'NBFC/Finance';
    if (n.includes('REAL') || n.includes('BUILD') || n.includes('INFRA') || n.includes('DEVELOPER') || n.includes('CONSTRUC')) return 'Real Estate';
    if (n.includes('FOOD') || n.includes('DAIRY') || n.includes('AGRI')) return 'Food/Agri';
    if (n.includes('TECH') || n.includes('SOFT') || n.includes('DIGITAL') || n.includes('IT')) return 'Tech';
    if (n.includes('HOSPITAL') || n.includes('HEALTH') || n.includes('PHARMA') || n.includes('MEDICAL')) return 'Healthcare';
    if (n.includes('HOTEL') || n.includes('HOSPITALITY') || n.includes('RESORT')) return 'Hospitality';
    if (n.includes('POWER') || n.includes('ENERGY') || n.includes('SOLAR') || n.includes('RENEW')) return 'Energy';
    if (n.includes('TRANSPORT') || n.includes('LOGISTIC') || n.includes('AUTO')) return 'Transport/Auto';
    return 'Other';
  }

  const results = { formA: [], formG: [], errors: [] };

  // ── FORM A ──
  try {
    const r = await fetch('https://ibbi.gov.in/public-announcement', {
      headers: { 'User-Agent': ua },
      signal: AbortSignal.timeout(10000)
    });
    if (r.ok) {
      const html = await r.text();
      const rows = getRows(html);
      results.formA = rows
        .filter(c => c.length >= 7 && !isHeaderRow(c))
        .map(c => {
          const pdfLink = extractPdfLink(c[7]?.raw || '');
          const pdfSize = extractPdfSize(c[7]?.raw || '');
          const company = c[3]?.text || '';
          return {
            type: c[0]?.text || '',
            announcementDate: c[1]?.text || '',
            lastDateSubmission: c[2]?.text || '',
            company,
            applicant: c[4]?.text || '',
            resolutionProfessional: c[5]?.text || '',
            pdfLink,
            pdfSize,
            scale: inferScale(company),
            remarks: c[8]?.text || ''
          };
        })
        .filter(r => r.company)
        .slice(0, 25);
    } else {
      results.errors.push('Form A fetch failed: ' + r.status);
    }
  } catch(e) {
    results.errors.push('Form A error: ' + e.message);
  }

  // ── FORM G ──
  try {
    const r = await fetch('https://ibbi.gov.in/resolution-plans', {
      headers: { 'User-Agent': ua },
      signal: AbortSignal.timeout(10000)
    });
    if (r.ok) {
      const html = await r.text();
      const rows = getRows(html);
      results.formG = rows
        .filter(c => c.length >= 5 && !isHeaderRow(c))
        .map(c => {
          const pdfLink = extractPdfLink(c[5]?.raw || '');
          const pdfSize = extractPdfSize(c[5]?.raw || '');
          const company = c[0]?.text || '';
          return {
            company,
            resolutionProfessional: c[1]?.text || '',
            lastDateEOI: c[2]?.text || '',
            dateIssueProspective: c[3]?.text || '',
            lastDateObjections: c[4]?.text || '',
            pdfLink,
            pdfSize,
            scale: inferScale(company),
            remarks: c[6]?.text || ''
          };
        })
        .filter(r => r.company)
        .slice(0, 25);
    } else {
      results.errors.push('Form G fetch failed: ' + r.status);
    }
  } catch(e) {
    results.errors.push('Form G error: ' + e.message);
  }

  res.status(200).json({
    fetched_at: new Date().toISOString(),
    formA: results.formA,
    formG: results.formG,
    errors: results.errors
  });
}
