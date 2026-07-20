export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // ── DIRECT RSS FEEDS (13 confirmed working) ──
  const directFeeds = [
    { name: 'M&A Critique',       url: 'https://mnacritique.mergersindia.com/feed/' },
    { name: 'Mergers India',      url: 'https://www.mergersindia.com/feed/' },
    { name: 'Inc42 Funding',      url: 'https://inc42.com/tag/funding/feed/' },
    { name: 'Inc42 PE',           url: 'https://inc42.com/tag/private-equity/feed/' },
    { name: 'Inc42',              url: 'https://inc42.com/feed/' },
    { name: 'YourStory',          url: 'https://yourstory.com/feed' },
    { name: 'YourStory Funding',  url: 'https://yourstory.com/category/funding/feed' },
    { name: 'The Ken',            url: 'https://the-ken.com/feed/' },
    { name: 'Equitypandit',       url: 'https://equitypandit.com/feed/' },
    { name: 'NDTV Profit',        url: 'https://feeds.feedburner.com/ndtvprofit-latest' },
    { name: 'Bloomberg Markets',  url: 'https://feeds.bloomberg.com/markets/news.rss' },
    { name: 'Investing.com India', url: 'https://in.investing.com/rss/news.rss' },
    { name: 'Investing.com M&A',  url: 'https://in.investing.com/rss/news_301.rss' },
    { name: 'PE Hub',             url: 'https://www.pehub.com/feed/' },
  ];

  // ── GOOGLE NEWS QUERIES (42 targeted queries × ~6 articles = ~250 unique articles) ──
  const gnQueries = [
    // Core M&A deal announcements
    'india+acquisition+merger+deal+company+2026',
    'india+acquires+company+deal+signed+crore',
    'india+signs+definitive+agreement+acquisition',
    'india+completes+acquisition+merger+2026',
    'india+announces+strategic+investment+acquisition',
    'india+takeover+buyout+controlling+stake+2026',
    'india+enters+binding+term+sheet+deal',
    'india+cross+border+outbound+acquisition+2026',

    // PE / VC deal activity
    'india+private+equity+acquires+buyout+2026',
    'india+PE+buys+stake+majority+company',
    'india+venture+capital+fund+invests+series+2026',
    'india+AIF+category+fund+raises+corpus+2026',
    'india+family+office+invests+stake+company+2026',
    'india+PE+exit+secondary+sale+stake+2026',
    'india+sovereign+wealth+fund+GIC+Temasek+invests',
    'india+pension+CPPIB+CDPQ+APG+invests+india',
    'india+growth+equity+invests+company+2026',
    'india+private+credit+structured+debt+india+2026',

    // Sector — Accomplir mandate universe
    'india+hospital+healthcare+acquisition+beds+2026',
    'india+hospital+chain+acquired+merger+network',
    'india+diagnostic+lab+pathology+acquisition+2026',
    'india+hotel+resort+hospitality+acquisition+2026',
    'india+hotel+chain+portfolio+acquires+2026',
    'india+FMCG+brand+consumer+foods+acquisition+2026',
    'india+food+beverage+brand+acquired+2026',
    'india+pharma+drug+company+acquisition+2026',
    'india+medical+device+healthcare+acquisition+2026',
    'india+manufacturing+industrial+plant+acquisition+2026',
    'india+power+energy+transmission+acquisition+2026',
    'india+solar+EPC+renewable+acquisition+2026',
    'india+EV+electric+vehicle+acquisition+2026',
    'india+logistics+warehousing+supply+chain+acquisition+2026',
    'india+fintech+payments+NBFC+acquisition+2026',
    'india+lending+microfinance+NBFC+acquired+2026',
    'india+real+estate+proptech+platform+acquisition+2026',
    'india+IT+technology+GCC+services+acquisition+2026',
    'india+software+SaaS+technology+acquired+2026',
    'india+education+edtech+school+coaching+acquisition+2026',
    'india+media+entertainment+OTT+acquisition+2026',
    'india+retail+ecommerce+D2C+brand+acquisition+2026',
    'india+agri+agtech+food+processing+acquisition+2026',

    // Strategic acquirer specific  
    'Adani+acquires+buys+stake+deal+2026',
    'Tata+acquires+buys+stake+deal+2026',
    'Reliance+acquires+buys+stake+deal+2026',
    'Mahindra+acquires+buys+stake+deal+2026',
    'Birla+Bajaj+Godrej+acquires+deal+2026',
    'MNC+multinational+enters+india+acquisition+2026',
  ];

  const results = [];
  const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days

  function parseItems(xml, sourceName) {
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    const out = [];
    for (const item of items) {
      const block = item[1];
      const title = (block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim() || '';
      const desc = (block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1]
        ?.replace(/<[^>]+>/g, '')?.trim()?.substring(0, 300) || '';
      const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1]?.trim() || '';
      const source = (block.match(/<source[^>]*>(.*?)<\/source>/) || [])[1]?.trim() || sourceName;
      if (!title || title === 'Google News') continue;
      let articleDate = pubDate ? new Date(pubDate) : null;
      if (articleDate && isNaN(articleDate.getTime())) articleDate = null;
      if (articleDate && articleDate < cutoff) continue;
      out.push({
        source: source || sourceName,
        title: title.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"'),
        description: desc.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"'),
        date: articleDate ? articleDate.toISOString() : new Date().toISOString(),
      });
    }
    return out;
  }

  // Fetch all sources in parallel
  await Promise.allSettled([
    // Direct feeds
    ...directFeeds.map(async (feed) => {
      try {
        const r = await fetch(feed.url, { headers: { 'User-Agent': ua }, signal: AbortSignal.timeout(6000) });
        if (!r.ok) return;
        results.push(...parseItems(await r.text(), feed.name));
      } catch(e) {}
    }),
    // Google News queries
    ...gnQueries.map(async (q) => {
      try {
        const url = `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;
        const r = await fetch(url, { headers: { 'User-Agent': ua }, signal: AbortSignal.timeout(7000) });
        if (!r.ok) return;
        results.push(...parseItems(await r.text(), 'Google News'));
      } catch(e) {}
    }),
  ]);

  // Sort newest first, deduplicate by title
  results.sort((a, b) => new Date(b.date) - new Date(a.date));
  const seen = new Set();
  const deduped = results.filter(r => {
    const key = r.title.substring(0, 55).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  res.status(200).json({
    count: deduped.length,
    fetched_at: new Date().toISOString(),
    articles: deduped.slice(0, 300)
  });
}
