export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

  const queries = [
    // ── DOWNGRADES — Rating agencies ──
    { cat: 'downgrade', q: 'ICRA+downgrade+rating+watch+negative+india' },
    { cat: 'downgrade', q: 'ICRA+revises+downgrades+rating+india+bank+facilities' },
    { cat: 'downgrade', q: 'CRISIL+downgrade+rating+negative+outlook+india' },
    { cat: 'downgrade', q: 'CRISIL+downgrades+rating+india+company' },
    { cat: 'downgrade', q: 'CARE+ratings+downgrade+watch+negative+india' },
    { cat: 'downgrade', q: 'CARE+downgrades+rating+watch+india' },
    { cat: 'downgrade', q: 'IndiaRatings+downgrades+rating+india' },
    { cat: 'downgrade', q: 'Brickwork+downgrades+rating+india' },
    { cat: 'downgrade', q: 'credit+rating+downgrade+outlook+negative+india+2026' },
    { cat: 'downgrade', q: 'credit+rating+revised+downward+india+sector' },
    { cat: 'downgrade', q: 'rating+watch+negative+india+ICRA+CRISIL' },
    { cat: 'downgrade', q: 'india+company+debt+rating+pressure+covenant' },
    // Sector-specific downgrades
    { cat: 'downgrade', q: 'real+estate+developer+india+rating+downgrade+default' },
    { cat: 'downgrade', q: 'pharma+chemicals+india+rating+downgrade' },
    { cat: 'downgrade', q: 'power+energy+india+rating+downgrade+DISCOM' },
    { cat: 'downgrade', q: 'telecom+media+india+rating+downgrade' },
    { cat: 'downgrade', q: 'NBFC+MFI+india+rating+downgrade+NPA+stress' },
    { cat: 'downgrade', q: 'hospital+healthcare+india+rating+downgrade+stress' },

    // ── DEBT STRESS / NPA ──
    { cat: 'stress', q: 'india+company+NPA+default+bank+account+stressed+2026' },
    { cat: 'stress', q: 'india+debt+restructuring+resolution+OTS+settlement+bank' },
    { cat: 'stress', q: 'NCLT+CIRP+insolvency+india+admitted+corporate+debtor' },
    { cat: 'stress', q: 'india+NCLT+insolvency+resolution+crore+admitted' },
    { cat: 'stress', q: 'india+IBC+section+7+9+admitted+NCLT+2026' },
    { cat: 'stress', q: 'india+CIRP+hearing+NCLT+bench+company+2026' },
    { cat: 'stress', q: 'india+company+insolvency+resolution+process+2026' },
    { cat: 'stress', q: 'india+wilful+defaulter+bank+list+RBI' },
    { cat: 'stress', q: 'india+bank+NPA+account+declared+stressed' },
    { cat: 'stress', q: 'india+bank+fraud+declared+CBI+ED+company' },
    { cat: 'stress', q: 'india+company+defaults+bond+payment+lender' },
    { cat: 'stress', q: 'india+ARC+bad+loan+acquisition+distressed' },
    { cat: 'stress', q: 'india+RBI+prompt+corrective+action+bank' },
    { cat: 'stress', q: 'india+stressed+asset+bad+loan+bank+recovery+2026' },
    { cat: 'stress', q: 'india+promoter+pledge+shares+margin+call+stress' },
    { cat: 'stress', q: 'india+IBC+insolvency+resolution+professional+2026' },

    // ── EXPANSION / CAPEX ──
    { cat: 'expansion', q: 'india+company+capex+expansion+investment+plant+crore+2026' },
    { cat: 'expansion', q: 'india+announces+capex+crore+expansion+plant+2026' },
    { cat: 'expansion', q: 'india+company+invest+crore+new+factory+facility' },
    { cat: 'expansion', q: 'india+greenfield+brownfield+expansion+manufacturing+2026' },
    { cat: 'expansion', q: 'india+brownfield+capacity+addition+manufacturing' },
    { cat: 'expansion', q: 'india+company+fundraise+growth+capital+raise+series+2026' },
    { cat: 'expansion', q: 'india+company+rights+issue+QIP+fund+expansion' },
    { cat: 'expansion', q: 'india+company+IPO+funds+expansion+capex+deploy' },
    { cat: 'expansion', q: 'india+company+strategic+acquisition+board+approved' },
    { cat: 'expansion', q: 'india+PE+fund+invests+growth+capital+company+2026' },
    // Sector expansion
    { cat: 'expansion', q: 'india+hospital+adds+beds+expansion+crore' },
    { cat: 'expansion', q: 'india+hotel+new+property+opens+portfolio+expand' },
    { cat: 'expansion', q: 'india+company+enters+new+market+vertical+launches+2026' },

    // ── UPGRADES ──
    { cat: 'upgrade', q: 'ICRA+CRISIL+CARE+upgrade+rating+positive+stable+india' },
    { cat: 'upgrade', q: 'ICRA+CRISIL+CARE+upgrades+rating+positive+stable+india' },
    { cat: 'upgrade', q: 'credit+rating+upgraded+outlook+positive+india+2026' },
    { cat: 'upgrade', q: 'india+company+rating+upgraded+improved+outlook' },
    { cat: 'upgrade', q: 'india+NPA+resolution+recovery+bank+upgraded' },
    { cat: 'upgrade', q: 'india+company+rating+improved+revised+upward' },
  ];

  const results = [];

  await Promise.allSettled(queries.map(async ({ cat, q }) => {
    try {
      const url = `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;
      const r = await fetch(url, {
        headers: { 'User-Agent': ua },
        signal: AbortSignal.timeout(8000)
      });
      if (!r.ok) return;
      const xml = await r.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

      for (const item of items) {
        const block = item[1];
        const title = (block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim() || '';
        const desc = (block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1]
          ?.replace(/<[^>]+>/g, '')?.trim()?.substring(0, 350) || '';
        const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1]?.trim() || '';
        const source = (block.match(/<source[^>]*>(.*?)<\/source>/) || [])[1]?.trim() || '';
        const link = (block.match(/<link>(.*?)<\/link>/) || [])[1]?.trim() || '';

        if (!title || title === 'Google News') continue;

        let articleDate = pubDate ? new Date(pubDate) : null;
        if (articleDate && isNaN(articleDate.getTime())) articleDate = null;
        if (articleDate && articleDate < cutoff) continue;

        results.push({
          category: cat,
          source: source || 'News',
          title: title.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"'),
          description: desc.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"'),
          date: articleDate ? articleDate.toISOString() : new Date().toISOString(),
          link
        });
      }
    } catch(e) {}
  }));

  // Sort newest first, deduplicate
  results.sort((a, b) => new Date(b.date) - new Date(a.date));
  const seen = new Set();
  const deduped = results.filter(r => {
    const key = r.title.substring(0, 60).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  res.status(200).json({
    fetched_at: new Date().toISOString(),
    lookback_days: 30,
    query_count: queries.length,
    downgrades: deduped.filter(r => r.category === 'downgrade'),
    stress: deduped.filter(r => r.category === 'stress'),
    expansion: deduped.filter(r => r.category === 'expansion'),
    upgrades: deduped.filter(r => r.category === 'upgrade'),
    total: deduped.length
  });
}
