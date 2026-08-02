import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('Paket enthält nur die aktuelle Shared-Quellenfassung', () => {
  assert.equal(existsSync(resolve(root, 'supabase/functions/_shared/multisource-sources-v294.ts')), true);
  assert.equal(existsSync(resolve(root, 'supabase/functions/_shared/hybrid-sources.ts')), false);
  assert.equal(existsSync(resolve(root, 'supabase/functions/_shared/multisource-sources-v2931.ts')), false);
  assert.match(read('supabase/functions/sync-news/index.ts'), /multisource-sources-v294\.ts/);
});

test('Frontend behält V29.4 und lädt die integrierte V30-Erweiterung cache-sicher', () => {
  for (const path of ['app.js', 'news.js', 'decision.js', 'analytics.js']) {
    assert.match(read(path), /29\.4/, `${path} enthält keine V29.4-Kennung`);
  }
  assert.match(read('event-analysis.js'), /30\.1/);
  const html = read('index.html');
  for (const [asset, version] of [
    ['supabase.js', '29.4'],
    ['app.js', '30.1'],
    ['news.js', '30.0'],
    ['decision.js', '29.4'],
    ['analytics.js', '29.4'],
    ['event-analysis.js', '30.1'],
  ]) {
    assert.match(html, new RegExp(`${asset.replace('.', '\\.')}\\?v=${version.replace('.', '\\.')}`));
  }
  assert.match(read('service-worker.js'), /investition-dashboard-v29-4-event-analysis-v30-1/);
  assert.match(read('reset.html'), /\?v=30\.1/);
});

test('Eventanalyse ist eine eigene Seite in der vorhandenen Navigation', () => {
  const html = read('index.html');
  const navigation = read('news.js');
  assert.match(html, /id="navEventAnalysisBtn"[^>]+data-page="events"/);
  assert.match(html, /id="eventAnalysisPage"[^>]+hidden/);
  assert.match(html, /id="eventAnalysisInput"/);
  assert.match(html, /id="eventAnalysisHistory"/);
  assert.match(navigation, /eventAnalysisPage/);
  assert.match(navigation, /showPage\('events'\)/);
  assert.match(navigation, /investition:event-analysis-visible/);
  assert.equal(existsSync(resolve(root, 'event-analysis.html')), false, 'Standalone-Seite darf im integrierten Paket nicht nötig sein');
});

test('Alle serverseitigen Komponenten tragen den vorgesehenen Release-Stand', () => {
  assert.match(read('supabase/functions/sync-news/index.ts'), /29\.4-multisource-hybrid-market-intelligence-sync/);
  assert.match(read('supabase/functions/send-news-alerts/index.ts'), /29\.4-multisource-hybrid-portfolio-market-intelligence-alerts/);
  assert.match(read('supabase/functions/send-digest/index.ts'), /29\.4-multisource-hybrid-digest/);
  assert.match(read('supabase/functions/_shared/market-intelligence.ts'), /29\.4-multisource-hybrid-rule-market-intelligence/);
  const eventFunction = read('supabase/functions/analyze-market-event/index.ts');
  assert.match(eventFunction, /30\.1-independent-market-ideas/);
  assert.match(eventFunction, /safeSelect\(admin, "market_news"/);
  assert.match(eventFunction, /eq\("is_open", true\)/);
  assert.match(eventFunction, /buildIndependentMarketIdeas/);
  assert.match(eventFunction, /const track = isPortfolio \? "portfolio" : isWatchlist \? "watchlist" : "market"/);
  assert.match(eventFunction, /Marktideen sind ein eigener Analysepfad und werden immer erzeugt/);
  assert.equal(existsSync(resolve(root, 'supabase/functions/_shared/event-idea-engine.mjs')), true);
});

test('Deployment ist gepinnt und umfasst drei Hintergrund- plus eine Benutzer-Function', () => {
  const workflow = read('.github/workflows/deploy-supabase-functions.yml');
  assert.match(workflow, /version: 2\.110\.0/);
  assert.doesNotMatch(workflow, /version:\s*latest/);
  assert.equal([...workflow.matchAll(/supabase functions deploy /g)].length, 4);
  for (const name of ['sync-news', 'send-news-alerts', 'send-digest', 'analyze-market-event']) {
    assert.match(workflow, new RegExp(`functions deploy ${name}`));
  }
  assert.match(read('supabase/config.toml'), /\[functions\.analyze-market-event\]/);
});

test('V30-SQL bleibt von den drei bestehenden Cronjobs getrennt', () => {
  const sql = read('setup-v30-event-analysis.sql');
  for (const table of [
    'event_analyses',
    'event_analysis_assets',
    'event_analysis_scenarios',
    'event_analysis_sources',
    'event_analysis_signals',
  ]) {
    assert.match(sql, new RegExp(`public\\.${table}`));
  }
  assert.doesNotMatch(sql, /cron\.schedule|cron\.unschedule|vault\./);
  for (const column of ['idea_type', 'idea_rank', 'is_fallback_idea', 'overlaps_portfolio', 'overlaps_watchlist']) {
    assert.match(sql, new RegExp(column));
  }

  const v294Sql = read('setup-v29-4-consistent.sql');
  assert.equal([...v294Sql.matchAll(/select cron\.schedule\(/g)].length, 3);
  assert.match(v294Sql, /cron\.unschedule\(dashboard_job\.jobid\)/);
  assert.match(v294Sql, /investition_news_cron_secret/);
  assert.doesNotMatch(v294Sql, /DEIN_CRON_SECRET/);
  assert.doesNotMatch(v294Sql, /vault\.(create_secret|update_secret)/);
});

test('Alte Root-Migrationen sind aus dem sauberen Paket entfernt', () => {
  for (const path of [
    'setup-v29-3-multisource-cron.sql',
    'version26-news-schema.sql',
    'version28-analytics-schema.sql',
    'version28-diagnose.sql',
    'version29-market-intelligence-schema.sql',
    'version29-2-hybrid-schema.sql',
    'version29-3-diagnose.sql',
    'HOTFIX-V29.3.1.md',
    'INSTALLATION-V29.3.1.md',
  ]) {
    assert.equal(existsSync(resolve(root, path)), false, `${path} ist noch da`);
  }
});
