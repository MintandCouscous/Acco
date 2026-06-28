export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const feeds = [
    // Economic Times — broad business
    { name: 'ET Markets', url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms' },
    { name: 'ET Companies', url: 'https://economictimes.indiatimes.com/company/rssfeeds/2143429.cms' },
    { name: 'ET Industry', url: 'https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms' },
    { name: 'ET M&A', url: 'https://economictimes.indiatimes.com/topic/mergers-and-acquisitions/rssfeeds/2647163.cms' },
    { name: 'ET Startups', url: 'https://economictimes.indiatimes.com/small-biz/startups/rssfeeds/7901299.cms' },

    // Mint — broad business
    { name: 'Mint Companies', url: 'https://www.livemint.com/rss/companies' },
    { name: 'Mint Industry', url: 'https://www.livemint.com/rss/industry' },
    { name: 'Mint Markets', url: 'https://www.livemint.com/rss/markets' },
    { name: 'Mint Money', url: 'https://www.livemint.com/rss/money' },

    // Business Standard
    { name: 'BS Companies', url: 'https://www.business-standard.com/rss/companies-101.rss' },
    { name: 'BS Markets', url: 'https://www.business-standard.com/rss/markets-106.rss' },
    { name: 'BS Finance', url: 'https://www.business-standard.com/rss/finance-103.rss' },
    { name: 'BS Economy', url: 'https://www.business-standard.com/rss/economy-policy-102.rss' },

    // VCCircle & Inc42
    { name: 'VCCircle', url: 'https://www.vccircle.com/feed' },
    { name: 'Inc42', url: 'https://inc42.com/feed/' },

    // Moneycontrol
    { name: 'Moneycontrol Business', url: 'https://www.moneycontrol.com/rss/business.xml' },
    { name: 'Moneycontrol Markets', url: 'https://www.moneycontrol.com/rss/marketreports.xml' },
  ];

  const results = [];
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 72 hours

  await Promise.allSettled(
    feeds.map(async (feed) => {
      try {
        const r = await fetch(feed.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AccoNewsBot/1.0)' },
          signal: AbortSignal.timeout(5000)
        });
        if (!r.ok) return;
        const xml = await r.text();

        // Parse items from RSS XML
        const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
        for (const item of items.slice(0, 15)) {
          const block = item[1];
          const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                        block.match(/<title>(.*?)<\/title>/))?.[1]?.trim() || '';
          const desc = (block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                       block.match(/<description>(.*?)<\/description>/))?.[1]
                       ?.replace(/<[^>]+>/g, '')?.trim()?.substring(0, 300) || '';
          const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/))?.[1]?.trim() || '';
          const link = (block.match(/<link>(.*?)<\/link>/) ||
                       block.match(/<link\s*\/?>(.*?)<\/link>/))?.[1]?.trim() || '';

          if (!title) continue;

          // Filter to last 72 hours
          let articleDate = null;
          if (pubDate) {
            articleDate = new Date(pubDate);
            if (isNaN(articleDate.getTime())) articleDate = null;
          }
          if (articleDate && articleDate < cutoff) continue;

          results.push({
            source: feed.name,
            title: title.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"'),
            description: desc.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"'),
            date: articleDate ? articleDate.toISOString() : new Date().toISOString(),
            link
          });
        }
      } catch(e) {
        // silently skip failed feeds
      }
    })
  );

  // Sort by date, newest first
  results.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Deduplicate by similar titles
  const seen = new Set();
  const deduped = results.filter(r => {
    const key = r.title.substring(0, 40).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  res.status(200).json({
    count: deduped.length,
    fetched_at: new Date().toISOString(),
    articles: deduped.slice(0, 120) // max 120 headlines
  });
}
