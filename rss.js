export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Google News RSS queries - aggregates ET, Mint, BS, Reuters, Moneycontrol etc
  // Free, no API key, returns fresh articles from all major Indian business sources
  const queries = [
    { name: 'M&A India',           q: 'india+acquisition+merger+deal+company' },
    { name: 'PE/VC India',         q: 'private+equity+venture+capital+india+investment+fund' },
    { name: 'Companies buying',    q: 'india+company+acquires+buys+stake+buyout' },
    { name: 'Hospital deals',      q: 'hospital+healthcare+india+acquisition+beds+2026' },
    { name: 'FMCG deals',          q: 'FMCG+brand+india+acquisition+consumer+2026' },
    { name: 'Industrial M&A',      q: 'india+manufacturing+industrial+power+acquires+2026' },
    { name: 'Fintech deals',       q: 'fintech+payments+india+acquisition+investment+2026' },
    { name: 'Hotel hospitality',   q: 'hotel+hospitality+india+acquisition+portfolio+2026' },
    { name: 'Energy/Solar deals',  q: 'solar+energy+india+acquisition+EPC+2026' },
    { name: 'Fundraise/IPO',       q: 'india+fundraise+raises+crore+capital+2026' },
    { name: 'ET Business',         q: 'site:economictimes.indiatimes.com+acquisition+deal+india' },
    { name: 'BS Business',         q: 'site:business-standard.com+acquisition+merger+india' },
  ];

  const browser_ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const results = [];
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 72 hours

  await Promise.allSettled(
    queries.map(async ({ name, q }) => {
      try {
        const url = `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;
        const r = await fetch(url, {
          headers: { 'User-Agent': browser_ua },
          signal: AbortSignal.timeout(6000)
        });
        if (!r.ok) return;
        const xml = await r.text();

        // Parse items
        const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
        for (const item of items) {
          const block = item[1];
          const title = (block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim() || '';
          const desc = (block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1]
            ?.replace(/<[^>]+>/g, '')?.trim()?.substring(0, 300) || '';
          const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1]?.trim() || '';
          const link = (block.match(/<link>(.*?)<\/link>/) || [])[1]?.trim() || '';
          const source = (block.match(/<source[^>]*>(.*?)<\/source>/) || [])[1]?.trim() || name;

          if (!title || title === 'Google News') continue;

          let articleDate = pubDate ? new Date(pubDate) : null;
          if (articleDate && isNaN(articleDate.getTime())) articleDate = null;
          if (articleDate && articleDate < cutoff) continue;

          results.push({
            source: source || name,
            title: title.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"'),
            description: desc.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"'),
            date: articleDate ? articleDate.toISOString() : new Date().toISOString(),
            link,
            category: name
          });
        }
      } catch(e) { /* skip failed queries */ }
    })
  );

  // Sort newest first, deduplicate by title
  results.sort((a, b) => new Date(b.date) - new Date(a.date));
  const seen = new Set();
  const deduped = results.filter(r => {
    const key = r.title.substring(0, 50).toLowerCase().replace(/\s+/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  res.status(200).json({
    count: deduped.length,
    fetched_at: new Date().toISOString(),
    articles: deduped.slice(0, 120)
  });
}
