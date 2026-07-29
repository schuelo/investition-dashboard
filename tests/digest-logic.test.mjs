import assert from 'node:assert/strict';
import test from 'node:test';

import {
  berlinClock,
  buildDigestText,
  chooseDigestNews,
  digestPeriodKey,
  isDigestDue,
  scheduledMinute,
} from '../supabase/functions/_shared/digest-logic.ts';

test('Berliner Uhr berücksichtigt Sommerzeit und Wochentag', () => {
  const clock = berlinClock(new Date('2026-07-26T16:05:00Z'));
  assert.deepEqual(clock, {
    date: '2026-07-26',
    weekday: 0,
    minuteOfDay: 18 * 60 + 5,
  });
});

test('Zeitangaben werden defensiv normalisiert', () => {
  assert.equal(scheduledMinute('19:07:00', '18:00'), 19 * 60 + 7);
  assert.equal(scheduledMinute('99:99', '18:00'), 23 * 60 + 59);
  assert.equal(scheduledMinute('ungueltig', '18:00'), 18 * 60);
});

test('Tagesbericht wird nur im 15-Minuten-Fenster fällig', () => {
  const policy = {
    daily_digest_enabled: true,
    daily_digest_time: '19:00',
  };
  assert.equal(isDigestDue('daily', policy, {
    date: '2026-07-29',
    weekday: 3,
    minuteOfDay: 19 * 60 + 14,
  }), true);
  assert.equal(isDigestDue('daily', policy, {
    date: '2026-07-29',
    weekday: 3,
    minuteOfDay: 19 * 60 + 15,
  }), false);
});

test('Wochenbericht respektiert Aktivierung und Wochentag', () => {
  const policy = {
    weekly_digest_enabled: true,
    weekly_digest_day: 0,
    weekly_digest_time: '18:00',
  };
  assert.equal(isDigestDue('weekly', policy, {
    date: '2026-07-26',
    weekday: 0,
    minuteOfDay: 18 * 60,
  }), true);
  assert.equal(isDigestDue('weekly', policy, {
    date: '2026-07-27',
    weekday: 1,
    minuteOfDay: 18 * 60,
  }), false);
  assert.equal(isDigestDue('weekly', {
    ...policy,
    weekly_digest_enabled: false,
  }, {
    date: '2026-07-26',
    weekday: 0,
    minuteOfDay: 18 * 60,
  }), false);
});

test('Berichtskennung verhindert Doppelversand je lokalem Tag', () => {
  assert.equal(digestPeriodKey('daily', {
    date: '2026-07-29',
    weekday: 3,
    minuteOfDay: 0,
  }), 'daily:2026-07-29');
});

test('Meldungen werden nach Relevanz und Dringlichkeit priorisiert', () => {
  const news = chooseDigestNews([
    { title: 'A', relevance_score: 60, urgency_score: 90 },
    { title: 'B', relevance_score: 90, urgency_score: 40 },
    { title: 'C', relevance_score: 20, urgency_score: 20 },
  ], 2);
  assert.deepEqual(news.map((item) => item.title), ['B', 'A']);
});

test('Telegram-Bericht enthält Portfolio, Signale und Handlung', () => {
  const text = buildDigestText({
    period: 'daily',
    positions: [{ id: '1' }],
    alerts: [{ event_type: 'KO orange', score: 88 }],
    news: [{
      title: 'Halbleiterauftrag steigt',
      primary_symbol: '000660.KO',
      relevance_score: 91,
      urgency_score: 75,
      recommended_action: 'Einstiegszone prüfen.',
    }],
  });
  assert.match(text, /TAGESBERICHT/);
  assert.match(text, /1 offene Position/);
  assert.match(text, /000660\.KO/);
  assert.match(text, /Einstiegszone prüfen/);
  assert.match(text, /KO orange/);
  assert.ok(text.length <= 3900);
});
