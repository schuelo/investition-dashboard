import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('Paket enthält nur die aktuelle Shared-Quellenfassung', () => {
  assert.equal(existsSync(resolve(
    root,
    'supabase/functions/_shared/multisource-sources-v294.ts',
  )), true);
  assert.equal(existsSync(resolve(
    root,
    'supabase/functions/_shared/hybrid-sources.ts',
  )), false);
  assert.equal(existsSync(resolve(
    root,
    'supabase/functions/_shared/multisource-sources-v2931.ts',
  )), false);
  assert.match(
    read('supabase/functions/sync-news/index.ts'),
    /multisource-sources-v294\.ts/,
  );
});

test('Frontend und Browsercache verwenden durchgehend V29.4', () => {
  for (const path of ['app.js', 'news.js', 'decision.js', 'analytics.js']) {
    assert.match(read(path), /29\.4/, `${path} enthält keine V29.4-Kennung`);
  }
  const html = read('index.html');
  for (const asset of [
    'supabase.js',
    'app.js',
    'news.js',
    'decision.js',
    'analytics.js',
  ]) {
    assert.match(html, new RegExp(`${asset.replace('.', '\\.')}\\?v=29\\.4`));
  }
  assert.match(read('service-worker.js'), /investition-dashboard-v29-4/);
  assert.match(read('reset.html'), /\?v=29\.4/);
});

test('Alle serverseitigen Komponenten tragen denselben Release-Stand', () => {
  assert.match(
    read('supabase/functions/sync-news/index.ts'),
    /29\.4-multisource-hybrid-market-intelligence-sync/,
  );
  assert.match(
    read('supabase/functions/send-news-alerts/index.ts'),
    /29\.4-multisource-hybrid-portfolio-market-intelligence-alerts/,
  );
  assert.match(
    read('supabase/functions/send-digest/index.ts'),
    /29\.4-multisource-hybrid-digest/,
  );
  assert.match(
    read('supabase/functions/_shared/market-intelligence.ts'),
    /29\.4-multisource-hybrid-rule-market-intelligence/,
  );
});

test('Deployment ist gepinnt und umfasst exakt die drei aktuellen Functions', () => {
  const workflow = read('.github/workflows/deploy-supabase-functions.yml');
  assert.match(workflow, /version: 2\.110\.0/);
  assert.doesNotMatch(workflow, /version:\s*latest/);
  assert.equal(
    [...workflow.matchAll(/supabase functions deploy /g)].length,
    3,
  );
  for (const name of ['sync-news', 'send-news-alerts', 'send-digest']) {
    assert.match(workflow, new RegExp(`functions deploy ${name}`));
  }
});

test('Konsolidierungs-SQL ersetzt Altjobs ohne Secrets zu überschreiben', () => {
  const sql = read('setup-v29-4-consistent.sql');
  assert.equal([...sql.matchAll(/select cron\.schedule\(/g)].length, 3);
  assert.match(sql, /cron\.unschedule\(dashboard_job\.jobid\)/);
  assert.match(sql, /investition_news_cron_secret/);
  assert.doesNotMatch(sql, /DEIN_CRON_SECRET/);
  assert.doesNotMatch(sql, /vault\.(create_secret|update_secret)/);
  assert.match(sql, /digest_delivery_log/);
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
