export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  const queries = [
    // Rating downgrades
    { cat: 'downgrade', q: 'ICRA+downgrade+rating+watch+negative+india+2026' },
    { cat: 'downgrade', q: 'CRISIL+downgrade+rating+negative+outlook+india+2026' },
    { cat: 'downgrade', q: 'CARE+ratings+downgrade+watch+negative+india+2026' },
    { cat: 'downgrade', q: 'india+credit+rating+downgrade+outlook+negative+2026' },
    { cat: 'downgrade', q: '"India Ratings"+downgrade+negative+watch+2026' },
    // Debt stress / NPA
    { cat: 'stress', q: 'india+company+loan+NPA+default+stressed+bank+2026' },
    { cat: 'stress', q: 'india+debt+restructuring+resolution+OTS+settlement+2026' },
    { cat: 'stress', q: 'NCLT+CIRP+insolvency+india+admitted+company+2026' },
    { cat: 'stress', q: 'india+wilful+defaulter+bank+fraud+account+2026' },
    // Expansion / capex signals
    { cat: 'expansion', q: 'india+company+capex+expansion+investment+plant+2026' },
    { cat: 'expansion', q: 'india+greenfield+brownfield+expansion+manufacturing+2026' },
    { cat: 'expansion', q: 'india+company+enters+new+market+launches+vertical+2026' },
    { cat: 'expansion', q: 'india+company+fundraise+growth+expansion+crore+2026' },
    // Upgrade signals (positive momentum)
    { cat: 'upgrade', q: 'ICRA+CRISIL+CARE+upgrade+rating+positive+india+2026' },
  ];

  const results = [];
  const cutoff = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

  await Promise.allSettled(queries.map(async ({ cat, q }) => {
    try {
      const url = `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;
      const r = await fetch(url, { headers: { 'User-Agent': ua }, signal: AbortSignal.timeout(7000) });
      if (!r.ok) return;
      const xml = await r.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      for (const item of items.slice(0, 15)) {
        const block = item[1];
        const title = (block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim() || '';
        const desc = (block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1]
          ?.replace(/<[^>]+>/g, '')?.trim()?.substring(0, 300) || '';
        const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1]?.trim() || '';
        const source = (block.match(/<source[^>]*>(.*?)<\/source>/) || [])[1]?.trim() || '';
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
        });
      }
    } catch(e) {}
  }));

  // Sort newest first, deduplicate
  results.sort((a, b) => new Date(b.date) - new Date(a.date));
  const seen = new Set();
  const deduped = results.filter(r => {
    const key = r.title.substring(0, 60).toLowerCase().replace(/\s+/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  res.status(200).json({
    fetched_at: new Date().toISOString(),
    downgrades: deduped.filter(r => r.category === 'downgrade'),
    stress: deduped.filter(r => r.category === 'stress'),
    expansion: deduped.filter(r => r.category === 'expansion'),
    upgrades: deduped.filter(r => r.category === 'upgrade'),
    total: deduped.length
  });
}
