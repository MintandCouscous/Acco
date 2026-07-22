export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Resolve Google News redirect URL to actual article URL
  async function resolveLink(gnUrl) {
    if (!gnUrl || !gnUrl.includes('news.google.com')) return gnUrl;
    try {
      const r = await fetch(gnUrl, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(3000),
        headers: { 'User-Agent': ua }
      });
      return r.url || gnUrl;
    } catch { return gnUrl; }
  }

  const queries = [
    // ── DOWNGRADES ──
    { cat: 'downgrade', q: 'ICRA+downgrade+rating+watch+negative+india' },
    { cat: 'downgrade', q: 'ICRA+revises+downgrades+rating+india+facilities' },
    { cat: 'downgrade', q: 'ICRA+places+rating+watch+negative+implications' },
    { cat: 'downgrade', q: 'CRISIL+downgrade+rating+negative+outlook+india' },
    { cat: 'downgrade', q: 'CRISIL+downgrades+credit+rating+india+company' },
    { cat: 'downgrade', q: 'CARE+ratings+downgrade+watch+negative+india' },
    { cat: 'downgrade', q: 'CARE+downgrades+rating+india+company+2026' },
    { cat: 'downgrade', q: 'IndiaRatings+downgrades+rating+india' },
    { cat: 'downgrade', q: 'India+Ratings+downgrade+negative+watch+2026' },
    { cat: 'downgrade', q: 'Brickwork+downgrades+rating+india+company' },
    { cat: 'downgrade', q: 'credit+rating+downgrade+outlook+negative+india+2026' },
    { cat: 'downgrade', q: 'rating+watch+negative+implications+india+company' },
    { cat: 'downgrade', q: 'india+company+credit+rating+revised+downward' },
    { cat: 'downgrade', q: 'india+NBFC+MFI+rating+downgrade+NPA+stress+2026' },
    { cat: 'downgrade', q: 'india+real+estate+developer+rating+downgrade+2026' },
    { cat: 'downgrade', q: 'india+power+energy+DISCOM+rating+downgrade+2026' },
    { cat: 'downgrade', q: 'india+pharma+chemicals+rating+downgrade+2026' },
    { cat: 'downgrade', q: 'india+steel+metals+rating+downgrade+stress+2026' },
    { cat: 'downgrade', q: 'india+hospital+healthcare+rating+downgrade+2026' },
    { cat: 'downgrade', q: 'india+textile+rating+downgrade+stress+2026' },
    { cat: 'downgrade', q: 'india+construction+infra+rating+downgrade+2026' },

    // ── DEBT STRESS / NPA ──
    { cat: 'stress', q: 'NCLT+CIRP+insolvency+india+admitted+corporate+debtor' },
    { cat: 'stress', q: 'india+IBC+section+7+9+admitted+NCLT+2026' },
    { cat: 'stress', q: 'india+CIRP+insolvency+resolution+process+2026' },
    { cat: 'stress', q: 'india+company+NPA+default+bank+account+stressed+2026' },
    { cat: 'stress', q: 'india+debt+restructuring+OTS+settlement+bank+2026' },
    { cat: 'stress', q: 'india+wilful+defaulter+bank+list+RBI+2026' },
    { cat: 'stress', q: 'india+company+defaults+bond+debenture+payment' },
    { cat: 'stress', q: 'india+bank+fraud+declared+CBI+ED+company+2026' },
    { cat: 'stress', q: 'india+ARC+bad+loan+acquisition+distressed+asset' },
    { cat: 'stress', q: 'india+promoter+pledge+shares+margin+call+stress' },
    { cat: 'stress', q: 'india+stressed+asset+resolution+recovery+bank+2026' },
    { cat: 'stress', q: 'india+company+insolvency+liquidation+NCLT+order' },

    // ── EXPANSION / CAPEX ──
    { cat: 'expansion', q: 'india+company+capex+expansion+investment+crore+2026' },
    { cat: 'expansion', q: 'india+announces+capex+crore+expansion+plant+2026' },
    { cat: 'expansion', q: 'india+greenfield+brownfield+expansion+manufacturing+2026' },
    { cat: 'expansion', q: 'india+company+fundraise+growth+capital+raise+series+2026' },
    { cat: 'expansion', q: 'india+company+rights+issue+QIP+fund+expansion+2026' },
    { cat: 'expansion', q: 'india+PE+fund+invests+growth+capital+company+2026' },
    { cat: 'expansion', q: 'india+hospital+adds+beds+expansion+crore+2026' },
    { cat: 'expansion', q: 'india+hotel+new+property+portfolio+expand+2026' },
    { cat: 'expansion', q: 'india+company+strategic+acquisition+board+approved' },
    { cat: 'expansion', q: 'india+company+enters+new+market+vertical+launches+2026' },

    // ── UPGRADES ──
    { cat: 'upgrade', q: 'ICRA+CRISIL+CARE+upgrades+rating+positive+stable+india' },
    { cat: 'upgrade', q: 'credit+rating+upgraded+outlook+positive+india+2026' },
    { cat: 'upgrade', q: 'india+company+rating+upgraded+improved+outlook+2026' },
    { cat: 'upgrade', q: 'india+NPA+resolution+recovery+rating+upgraded+bank' },
  ];

  const results = [];

  await Promise.allSettled(queries.map(async ({ cat, q }) => {
    try {
      const url = `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;
      const r = await fetch(url, { headers: { 'User-Agent': ua }, signal: AbortSignal.timeout(8000) });
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
        // Get the Google News redirect URL - we'll resolve it client-side
        const gnLink = (block.match(/<link>(.*?)<\/link>/) || [])[1]?.trim() || '';

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
          link: gnLink // Google News URL — opens in new tab, redirects to article
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
