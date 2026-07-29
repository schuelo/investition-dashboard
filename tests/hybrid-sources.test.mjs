import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cacheIsFresh,
  gdeltDocUrl,
  googleNewsRssUrl,
  parseGdeltJson,
  parseRss,
  parseStooqCsv,
  publisherFeeds,
  rotateForUtcDay,
  stooqSymbol,
  yahooFinanceRssUrl,
  yahooFinanceSymbol
} from '../supabase/functions/_shared/multisource-sources-v294.ts';

test('Google-News-RSS wird mit Quelle, Datum und bereinigtem Titel gelesen', () => {
  const xml = `<?xml version="1.0"?>
    <rss><channel><item>
      <guid>article-1</guid>
      <title><![CDATA[SK hynix raises HBM outlook - Example News]]></title>
      <link>https://news.google.com/rss/articles/abc</link>
      <pubDate>Mon, 27 Jul 2026 08:15:00 GMT</pubDate>
      <description><![CDATA[<a href="#">SK hynix</a> reports stronger demand &amp; capacity.]]></description>
      <source url="https://example.com">Example News</source>
    </item></channel></rss>`;
  const articles = parseRss(xml, 'Google News RSS');

  assert.equal(articles.length, 1);
  assert.equal(articles[0].title, 'SK hynix raises HBM outlook');
  assert.equal(articles[0].sourceName, 'Example News');
  assert.equal(articles[0].publishedAt, '2026-07-27T08:15:00.000Z');
  assert.equal(
    articles[0].description,
    'SK hynix reports stronger demand & capacity.'
  );
});

test('Atom-Feeds mit href-Link werden gelesen', () => {
  const atom = `<?xml version="1.0"?>
    <feed>
      <entry>
        <id>fed-1</id>
        <title>Federal Reserve issues FOMC statement</title>
        <link href="https://www.federalreserve.gov/example.htm" />
        <updated>2026-07-28T18:00:00Z</updated>
        <summary>Policy statement and rate decision.</summary>
      </entry>
    </feed>`;
  const articles = parseRss(atom, 'Federal Reserve');

  assert.equal(articles.length, 1);
  assert.equal(
    articles[0].link,
    'https://www.federalreserve.gov/example.htm'
  );
  assert.equal(articles[0].publishedAt, '2026-07-28T18:00:00.000Z');
});

test('GDELT-JSON wird in normalisierte Artikel umgewandelt', () => {
  const articles = parseGdeltJson({
    articles: [{
      url:'https://example.com/catl-result',
      title:'CATL expands European battery production',
      seendate:'20260728T181500Z',
      domain:'example.com',
      language:'English',
      sourcecountry:'United States'
    }]
  });

  assert.deepEqual(articles, [{
    guid:'https://example.com/catl-result',
    title:'CATL expands European battery production',
    link:'https://example.com/catl-result',
    publishedAt:'2026-07-28T18:15:00.000Z',
    description:'',
    sourceName:'example.com'
  }]);
});

test('GDELT-, Yahoo- und Direktquellen-URLs sind begrenzt und korrekt', () => {
  const gdelt = gdeltDocUrl('"CATL" OR "300750"', 3, 80);
  assert.equal(gdelt.hostname, 'api.gdeltproject.org');
  assert.equal(gdelt.searchParams.get('query'), '("CATL" OR "300750")');
  assert.equal(gdelt.searchParams.get('maxrecords'), '50');
  assert.equal(gdelt.searchParams.get('timespan'), '3d');

  assert.equal(yahooFinanceSymbol('300750.SHE'), '300750.SZ');
  assert.equal(yahooFinanceSymbol('000660.KO'), '000660.KS');
  assert.equal(yahooFinanceSymbol('VOW3.XETRA'), 'VOW3.DE');
  assert.equal(yahooFinanceSymbol('BRK.B.US'), 'BRK-B');
  const yahoo = yahooFinanceRssUrl(['VOW3.XETRA', 'AKZA.AS']);
  assert.equal(yahoo?.hostname, 'feeds.finance.yahoo.com');
  assert.equal(yahoo?.searchParams.get('s'), 'VOW3.DE,AKZA.AS');

  const feeds = publisherFeeds();
  assert.equal(feeds.length >= 5, true);
  assert.equal(
    feeds.some((feed) => feed.url.hostname === 'www.ecb.europa.eu'),
    true
  );
  assert.equal(
    feeds.some((feed) => feed.url.hostname === 'www.tagesschau.de'),
    true
  );
});

test('Stooq-CSV wird in EOD-Kursbalken umgewandelt', () => {
  const bars = parseStooqCsv(
    'Date,Open,High,Low,Close,Volume\n' +
    '2026-07-24,100,103,99,102,120000\n' +
    '2026-07-27,102,105,101,104,130000\n'
  );

  assert.deepEqual(bars, [
    {
      date:'2026-07-24',
      open:100,
      high:103,
      low:99,
      close:102,
      adjusted_close:null,
      volume:120000
    },
    {
      date:'2026-07-27',
      open:102,
      high:105,
      low:101,
      close:104,
      adjusted_close:null,
      volume:130000
    }
  ]);
});

test('Proxy-Mapping und RSS-Zeitfenster bleiben fest definiert', () => {
  assert.equal(stooqSymbol('SOXX.US'), 'soxx.us');
  assert.equal(stooqSymbol('300750.SHE'), null);
  const url = googleNewsRssUrl('"CATL" OR "300750"', 3);
  assert.equal(url.hostname, 'news.google.com');
  assert.match(url.searchParams.get('q'), /when:3d/);
  assert.equal(url.searchParams.get('ceid'), 'DE:de');
});

test('Cachealter und tägliche Rotation sind deterministisch', () => {
  const now = new Date('2026-07-28T12:00:00Z');
  assert.equal(cacheIsFresh('2026-07-28T06:01:00Z', 6, now), true);
  assert.equal(cacheIsFresh('2026-07-28T05:59:00Z', 6, now), false);
  assert.deepEqual(
    rotateForUtcDay(['A', 'B', 'C'], now),
    rotateForUtcDay(['A', 'B', 'C'], now)
  );
});
