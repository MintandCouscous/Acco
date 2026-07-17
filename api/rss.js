export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // Direct RSS feeds that work server-side
  const directFeeds = [
    // India PE/VC/M&A specific
    { name: 'M&A Critique',     url: 'https://mnacritique.mergersindia.com/feed/' },
    { name: 'Mergers India',    url: 'https://www.mergersindia.com/feed/' },
    { name: 'Inc42 Funding',    url: 'https://inc42.com/tag/funding/feed/' },
    { name: 'Inc42',            url: 'https://inc42.com/feed/' },
    { name: 'The Ken',          url: 'https://the-ken.com/feed/' },
    { name: 'PE Hub',           url: 'https://www.pehub.com/feed/' },
    { name: 'Equitypandit',     url: 'https://equitypandit.com/feed/' },
    { name: 'YourStory',        url: 'https://yourstory.com/feed' },
    // International with India coverage
    { name: 'Bloomberg Markets', url: 'https://feeds.bloomberg.com/markets/news.rss' },
    { name: 'Investing.com India', url: 'https://in.investing.com/rss/news.rss' },
    { name: 'Investing.com M&A', url: 'https://in.investing.com/rss/news_301.rss' },
    { name: 'NDTV Profit',      url: 'https://feeds.feedburner.com/ndtvprofit-latest' },
  ];

  // Google News RSS queries - aggregates ET, Mint, BS, Moneycontrol, Reuters etc
  const googleNewsQueries = [
    // Core M&A
    { name: 'M&A India',           q: 'india+acquisition+merger+deal+company+2026' },
    { name: 'PE India',            q: 'private+equity+india+acquires+buyout+investment+2026' },
    { name: 'VC India',            q: 'venture+capital+india+fund+raises+series+2026' },
    { name: 'Companies buying',    q: 'india+company+acquires+buys+stake+takeover+2026' },
    // Sector specific - matching Accomplir's mandate universe
    { name: 'Hospital deals',      q: 'hospital+healthcare+india+acquisition+beds+merger+2026' },
    { name: 'Hotel hospitality',   q: 'hotel+hospitality+india+acquisition+portfolio+resort+2026' },
    { name: 'FMCG brands',         q: 'FMCG+brand+india+acquisition+consumer+foods+2026' },
    { name: 'Industrial M&A',      q: 'india+manufacturing+industrial+power+acquires+plant+2026' },
    { name: 'Fintech deals',       q: 'fintech+payments+india+acquisition+NBFC+lending+2026' },
    { name: 'EV logistics',        q: 'EV+electric+vehicle+logistics+india+acquisition+2026' },
    { name: 'Energy solar',        q: 'solar+energy+renewable+india+acquisition+EPC+MW+2026' },
    { name: 'Real estate',         q: 'real+estate+proptech+india+acquisition+platform+2026' },
    { name: 'IT services GCC',     q: 'IT+services+GCC+india+acquisition+technology+2026' },
    { name: 'Education EdTech',    q: 'education+edtech+india+acquisition+school+coaching+2026' },
    // PE/VC fund activity
    { name: 'PE fund deploy',      q: 'PE+fund+india+deploys+invests+portfolio+crore+2026' },
    { name: 'VC new funds',        q: 'venture+fund+india+raises+corpus+AIF+SEBI+2026' },
    { name: 'PE exits',            q: 'PE+private+equity+exit+IPO+stake+sale+india+2026' },
    // Strategic acquirers
    { name: 'Conglomerate buys',   q: 'Adani+Tata+Reliance+Mahindra+acquires+buys+india+2026' },
    { name: 'MNC India',           q: 'MNC+multinational+india+acquisition+entry+joint+venture+2026' },
    // Source-specific
    { name: 'ET Deals',            q: 'site:economictimes.indiatimes.com+acquisition+deal+stake+2026' },
    { name: 'BS Deals',            q: 'site:business-standard.com+acquisition+merger+deal+2026' },
    { name: 'Mint Deals',          q: 'site:livemint.com+acquisition+merger+deal+stake+2026' },
    { name: 'VCCircle',            q: 'site:vccircle.com+investment+acquisition+fund+2026' },
  ];

  const results = [];
  const cutoff = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000); // 4 days

  // Fetch direct feeds
  await Promise.allSettled(directFeeds.map(async (feed) => {
    try {
      const r = await fetch(feed.url, {
        headers: { 'User-Agent': ua },
        signal: AbortSignal.timeout(6000)
      });
      if (!r.ok) return;
      const xml = await r.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      for (const item of items.slice(0, 20)) {
        const block = item[1];
        const title = (block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim() || '';
        const desc = (block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1]
          ?.replace(/<[^>]+>/g, '')?.trim()?.substring(0, 280) || '';
        const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1]?.trim() || '';
        const link = (block.match(/<link>(.*?)<\/link>/) || [])[1]?.trim() || '';
        if (!title) continue;
        let articleDate = pubDate ? new Date(pubDate) : null;
        if (articleDate && isNaN(articleDate.getTime())) articleDate = null;
        if (articleDate && articleDate < cutoff) continue;
        results.push({
          source: feed.name,
          title: title.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"'),
          description: desc.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"'),
          date: articleDate ? articleDate.toISOString() : new Date().toISOString(),
          link, category: feed.name
        });
      }
    } catch(e) { /* skip */ }
  }));

  // Fetch Google News RSS queries
  await Promise.allSettled(googleNewsQueries.map(async ({ name, q }) => {
    try {
      const url = `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;
      const r = await fetch(url, {
        headers: { 'User-Agent': ua },
        signal: AbortSignal.timeout(6000)
      });
      if (!r.ok) return;
      const xml = await r.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      for (const item of items.slice(0, 12)) {
        const block = item[1];
        const title = (block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim() || '';
        const desc = (block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1]
          ?.replace(/<[^>]+>/g, '')?.trim()?.substring(0, 280) || '';
        const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1]?.trim() || '';
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
          link: '', category: name
        });
      }
    } catch(e) { /* skip */ }
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
    count: deduped.length,
    fetched_at: new Date().toISOString(),
    articles: deduped.slice(0, 200) // increased from 120 to 200
  });
}
