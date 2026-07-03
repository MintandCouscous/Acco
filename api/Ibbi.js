export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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

  function getRows(html) {
    const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) return [];
    const rows = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    return rows.map(r => [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => cleanCell(c[1])));
  }

  const HEADER_MARKERS = ['Name of Corporate Debtor', 'Type of PA', 'S. No.'];
  function isHeaderRow(cells) {
    return cells.some(c => HEADER_MARKERS.includes(c));
  }

  const results = { formA: [], formG: [], errors: [] };

  // Fetch Form A (Public Announcements) - 9 columns:
  // 0=Type, 1=AnnounceDate, 2=LastDateSubmit, 3=Company, 4=Applicant, 5=IP Name, 6=IP Address, 7=PDF size, 8=Remarks
  try {
    const r = await fetch('https://ibbi.gov.in/public-announcement', {
      headers: { 'User-Agent': ua },
      signal: AbortSignal.timeout(10000)
    });
    if (r.ok) {
      const html = await r.text();
      const rows = getRows(html);
      results.formA = rows
        .filter(c => c.length >= 9 && c[3] && !isHeaderRow(c))
        .map(c => ({
          type: c[0] || '',
          announcementDate: c[1] || '',
          lastDateSubmission: c[2] || '',
          company: c[3] || '',
          applicant: c[4] || '',
          resolutionProfessional: c[5] || '',
          ipAddress: c[6] || '',
          remarks: c[8] || ''
        }))
        .slice(0, 25);
    } else {
      results.errors.push('Form A fetch failed: ' + r.status);
    }
  } catch(e) {
    results.errors.push('Form A error: ' + e.message);
  }

  // Fetch Form G (Resolution Plans) - 7 columns:
  // 0=Company, 1=RP Name, 2=LastDateEOI, 3=DateIssueProspective, 4=LastDateObjections, 5=PDF size, 6=Remarks
  try {
    const r = await fetch('https://ibbi.gov.in/resolution-plans', {
      headers: { 'User-Agent': ua },
      signal: AbortSignal.timeout(10000)
    });
    if (r.ok) {
      const html = await r.text();
      const rows = getRows(html);
      results.formG = rows
        .filter(c => c.length >= 6 && c[0] && !isHeaderRow(c))
        .map(c => ({
          company: c[0] || '',
          resolutionProfessional: c[1] || '',
          lastDateEOI: c[2] || '',
          dateIssueProspective: c[3] || '',
          lastDateObjections: c[4] || '',
          remarks: c[6] || ''
        }))
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
