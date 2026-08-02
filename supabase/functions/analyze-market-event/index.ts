import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import {
  gdeltDocUrl,
  googleNewsRssUrl,
  parseGdeltJson,
  parseRss,
} from "../_shared/multisource-sources-v294.ts";
import {
  IDEA_ENGINE_VERSION,
  buildIndependentMarketIdeas,
  classifyEvent,
  getEventTone,
  normalizeEventText,
} from "../_shared/event-idea-engine.mjs";

const BUILD_VERSION = "30.1-independent-market-ideas";

type Source = {
  title: string;
  source_name: string;
  source_url: string | null;
  published_at: string | null;
  relevance_score: number;
  source_type: string;
};


function env(name: string) {
  return String(Deno.env.get(name) || "").trim();
}

function publishableKey() {
  return env("SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY") || (() => {
    throw new Error("Kein Supabase-Publishable-Key verfügbar.");
  })();
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {status, headers: jsonHeaders});
}

function clamp(value: unknown, minimum: number, maximum: number) {
  const parsed = Number(value);
  const safe = Number.isFinite(parsed) ? parsed : minimum;
  return Math.max(minimum, Math.min(maximum, Math.round(safe)));
}

function normalize(value: unknown) {
  return normalizeEventText(value);
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function objectText(value: Record<string, unknown>) {
  return normalize(Object.values(value || {}).filter(item => ["string", "number"].includes(typeof item)).join(" "));
}


function directMatch(text: string, aliases: string[]) {
  return aliases.some(alias => text.includes(normalize(alias)));
}

function assetScore(
  row: Record<string, unknown>,
  hits: Array<Record<string, any>>,
  tone: number,
  candidate?: Record<string, any>,
) {
  if (candidate && Number.isFinite(Number(candidate.impact_score))) {
    return {
      score: clamp(candidate.impact_score, -85, 85),
      direct: !candidate.fallback,
      reason: String(candidate.reasoning || "Unabhängige Marktidee aus dem Ereignis- und Branchenmodell."),
    };
  }

  const text = objectText(row);
  let score = 0;
  let direct = false;
  const reasons: string[] = [];
  for (const theme of hits) {
    if (directMatch(text, theme.positiveAliases)) {
      score += 52;
      direct = true;
      reasons.push(`positiver Direktbezug zu ${theme.sectors.slice(0, 2).join("/")}`);
    }
    if (directMatch(text, theme.negativeAliases)) {
      score -= 52;
      direct = true;
      reasons.push(`negativer Direktbezug zu ${theme.sectors.slice(0, 2).join("/")}`);
    }
    const sectorHit = theme.sectors.some(sector => text.includes(normalize(sector)));
    if (!direct && sectorHit) {
      score += tone * 22;
      reasons.push(`Branchenbezug zu ${theme.sectors.slice(0, 2).join("/")}`);
    }
  }
  if (!hits.length) score = 0;
  if (!direct && score === 0 && hits.length) score = tone * 8;
  return {
    score: clamp(score, -85, 85),
    direct,
    reason: reasons.length
      ? `Erkannt: ${unique(reasons).join(", ")}.`
      : "Kein belastbarer Direktbezug erkannt; die Wirkung ist derzeit neutral oder unklar.",
  };
}

function recommendation(score: number, held: boolean, role?: string) {
  if (score >= 45) return held
    ? "Halten; Aufstockung erst nach Bestätigung und Einpreisungsprüfung erwägen."
    : "Beobachtungskandidat; Einstieg erst nach fundamentaler und technischer Bestätigung prüfen.";
  if (score >= 20) return "Beobachten; Rücksetzer oder bestätigtes Momentum abwarten.";
  if (score <= -45) return held
    ? "Absicherung, Positionsgröße und Invalidation priorisiert prüfen."
    : role === "loser"
    ? "Risiko-/Short-Kandidat; nur mit bestätigtem Trigger und begrenztem Risiko handeln."
    : "Eng beobachten; keine unbestätigte Gegenposition eröffnen.";
  if (score <= -20) return held
    ? "Position beobachten und Stop-/Thesenlogik überprüfen."
    : "Belastung beobachten; aktuell kein Einstieg.";
  return "Aktuell keine Aktion; neue Fakten und Kursreaktion abwarten.";
}

async function authorize(req: Request, url: string) {
  const authorization = req.headers.get("authorization") || "";
  if (!authorization) return null;
  const client = createClient(url, publishableKey(), {
    global: {headers: {Authorization: authorization}},
    auth: {persistSession: false, autoRefreshToken: false},
  });
  const {data, error} = await client.auth.getUser();
  return error ? null : data.user || null;
}

async function safeSelect(admin: any, table: string, build: (query: any) => any) {
  try {
    const {data, error} = await build(admin.from(table).select("*"));
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn(`${table} konnte nicht gelesen werden:`, error);
    return [];
  }
}

function queryText(input: string) {
  return String(input || "")
    .replace(/[(){}[\]<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

async function searchExternal(input: string): Promise<Source[]> {
  const query = queryText(input);
  if (!query) return [];
  const results: Source[] = [];
  const requests = [
    fetch(gdeltDocUrl(query, 7, 25), {headers: {"User-Agent": "Investition-Dashboard/30.0"}})
      .then(async request => request.ok ? parseGdeltJson(await request.json()) : []),
    fetch(googleNewsRssUrl(query, 7), {headers: {"User-Agent": "Investition-Dashboard/30.0"}})
      .then(async request => request.ok ? parseRss(await request.text(), "Google News") : []),
  ];
  const settled = await Promise.allSettled(requests);
  for (const item of settled) {
    if (item.status !== "fulfilled") continue;
    item.value.slice(0, 15).forEach((article, index) => {
      results.push({
        title: article.title || "Meldung",
        source_name: article.sourceName || "Externe Quelle",
        source_url: article.link || null,
        published_at: article.publishedAt || null,
        relevance_score: clamp(90 - index * 3, 45, 90),
        source_type: "external_news",
      });
    });
  }
  const seen = new Set<string>();
  return results.filter(source => {
    const key = normalize(source.source_url || source.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);
}

function keywordSet(input: string, sectors: string[]) {
  return unique(normalize(`${input} ${sectors.join(" ")}`).split(" ").filter(token => token.length >= 4));
}

function relevantExistingNews(rows: Record<string, unknown>[], input: string, sectors: string[]): Source[] {
  const keywords = keywordSet(input, sectors);
  return rows.map(row => {
    const text = normalize(`${row.title || ""} ${row.summary || ""} ${(row.symbols as string[] || []).join(" ")} ${row.event_type || ""}`);
    const hits = keywords.filter(keyword => text.includes(keyword)).length;
    return {row, hits};
  }).filter(item => item.hits > 0).sort((a, b) => b.hits - a.hits).slice(0, 12).map(({row, hits}) => ({
    title: String(row.title || "Dashboard-News"),
    source_name: String(row.source_name || "Dashboard News Feed"),
    source_url: row.source_url ? String(row.source_url) : null,
    published_at: row.published_at ? String(row.published_at) : null,
    relevance_score: clamp(Number(row.relevance_score || 55) + hits * 5, 40, 95),
    source_type: "dashboard_news",
  }));
}

function pricingState(newsRows: Record<string, unknown>[], input: string, sectors: string[]) {
  const keywords = keywordSet(input, sectors);
  const states = newsRows.filter(row => {
    const text = normalize(`${row.title || ""} ${row.summary || ""}`);
    return keywords.some(keyword => text.includes(keyword));
  }).map(row => String(row.priced_in_state || "unklar")).filter(state => !["", "unklar", "zu_frueh"].includes(state));
  if (!states.length) return "unklar";
  const counts = new Map<string, number>();
  states.forEach(state => counts.set(state, (counts.get(state) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function sourceConfidence(sources: Source[]) {
  const dashboardSources = sources.filter(source => source.source_type === "dashboard_news").length;
  const externalSources = sources.filter(source => source.source_type === "external_news").length;
  return clamp(38 + Math.min(dashboardSources, 8) * 5 + Math.min(externalSources, 10) * 2, 38, 88);
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", {headers: corsHeaders});
  if (req.method !== "POST") return response({ok: false, error: "Method not allowed"}, 405);

  let analysisId: string | null = null;
  try {
    const url = env("SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Supabase-Umgebungsvariablen fehlen.");
    const user = await authorize(req, url);
    if (!user) return response({ok: false, error: "Unauthorized"}, 401);

    const body = await req.json();
    const input = String(body.event_input || "").trim();
    if (input.length < 8) return response({ok: false, error: "Ereignis ist zu kurz."}, 400);
    if (input.length > 2000) return response({ok: false, error: "Ereignis ist zu lang."}, 400);

    const admin = createClient(url, serviceKey, {auth: {persistSession: false, autoRefreshToken: false}});
    const [plans, positions, newsRows, externalSources] = await Promise.all([
      safeSelect(admin, "trade_plans", query => query.eq("user_id", user.id).order("updated_at", {ascending: false})),
      safeSelect(admin, "depot_positions", query => query.eq("user_id", user.id).eq("is_open", true).order("updated_at", {ascending: false})),
      safeSelect(admin, "market_news", query => query.eq("is_published", true).order("published_at", {ascending: false}).limit(250)),
      searchExternal(input),
    ]);

    const initialClassification = classifyEvent(input, externalSources);
    const hits = initialClassification.hits;
    const classifiedSectors = initialClassification.sectors;
    const sectors = classifiedSectors.length ? classifiedSectors : ["Kapitalmarkt", "Unternehmen", "Lieferketten"];
    const tone = getEventTone(input, hits);
    const planById = new Map(plans.map((plan: any) => [String(plan.id), plan]));
    const portfolio = positions.map((position: any) => ({
      ...(planById.get(String(position.trade_id || "")) || {}),
      ...position,
      name: position.name || planById.get(String(position.trade_id || ""))?.name || "Depotposition",
      symbol: position.symbol || planById.get(String(position.trade_id || ""))?.symbol || planById.get(String(position.trade_id || ""))?.market_symbol || null,
    }));
    const heldTradeIds = new Set(portfolio.map((position: any) => String(position.trade_id || "")).filter(Boolean));
    const watchlist = plans.filter((plan: any) =>
      !heldTradeIds.has(String(plan.id)) &&
      !["geschlossen", "verworfen", "archiviert"].includes(normalize(plan.status))
    );

    const existingSources = relevantExistingNews(newsRows, input, sectors);
    const sourceMap = new Map<string, Source>();
    [...existingSources, ...externalSources].forEach(source => {
      const key = normalize(source.source_url || source.title);
      if (key && !sourceMap.has(key)) sourceMap.set(key, source);
    });
    const sources = [...sourceMap.values()].slice(0, 24);
    const pricing = pricingState(newsRows, input, sectors);
    const baseConfidence = sourceConfidence(sources);
    const horizon = String(body.analysis_horizon || "1–6 Monate");
    const scope = String(body.analysis_scope || "portfolio_watchlist");
    const ideaEngine = buildIndependentMarketIdeas({
      input,
      sources,
      baseConfidence,
      pricingState: pricing,
      horizon,
      minimumIdeas: 6,
      maximumIdeas: 12,
    });
    const marketIdeas = Array.isArray(ideaEngine.ideas) ? ideaEngine.ideas : [];
    const effectiveHits = ideaEngine.hits?.length ? ideaEngine.hits : hits;
    const effectiveTone = Number.isFinite(Number(ideaEngine.tone)) ? Number(ideaEngine.tone) : tone;
    const finalSectors = ideaEngine.sectors?.length ? ideaEngine.sectors : sectors;

    const includePortfolio = scope !== "market_only";
    const includeWatchlist = ["portfolio_watchlist", "portfolio_watchlist_market"].includes(scope);
    const portfolioKeys = new Set(
      includePortfolio
        ? portfolio.map((row: any) => normalize(row.symbol || row.market_symbol || row.name)).filter(Boolean)
        : [],
    );
    const watchlistKeys = new Set(
      includeWatchlist
        ? watchlist.map((row: any) => normalize(row.symbol || row.market_symbol || row.name)).filter(Boolean)
        : [],
    );

    const assets: Record<string, unknown>[] = [];
    const seenAssets = new Set<string>();
    const addAsset = (
      row: Record<string, unknown>,
      assetSource: string,
      isPortfolio = false,
      isWatchlist = false,
      candidate?: Record<string, any>,
    ) => {
      const name = String(row.company_name || row.name || candidate?.company_name || candidate?.name || row.symbol || "Unbekannter Wert");
      const symbol = String(row.symbol || row.market_symbol || candidate?.symbol || "").trim() || null;
      const track = isPortfolio ? "portfolio" : isWatchlist ? "watchlist" : "market";
      const identity = normalize(symbol || name);
      const key = `${track}:${identity}`;
      if (!identity || seenAssets.has(key)) return;
      seenAssets.add(key);

      const scored = assetScore(row, effectiveHits, effectiveTone, candidate);
      const confidence = candidate
        ? clamp(candidate.confidence_score, 25, 94)
        : clamp(baseConfidence + (scored.direct ? 9 : -8), 25, 94);
      const overlapPortfolio = !isPortfolio && portfolioKeys.has(identity);
      const overlapWatchlist = !isWatchlist && watchlistKeys.has(identity);
      const reasoning = candidate?.reasoning
        ? String(candidate.reasoning)
        : `${scored.reason} Die Aussage muss durch neue Unternehmensmeldungen und die relative Kursreaktion bestätigt werden.`;

      assets.push({
        symbol,
        company_name: name,
        asset_source: assetSource,
        impact_direction: scored.score > 20 ? "positiv" : scored.score < -20 ? "negativ" : "neutral",
        impact_score: scored.score,
        confidence_score: confidence,
        opportunity_score: candidate
          ? clamp(candidate.opportunity_score, 5, 95)
          : clamp(45 + scored.score * 0.45, 5, 95),
        recommendation: recommendation(scored.score, isPortfolio || isWatchlist, candidate?.idea_type || candidate?.role),
        reasoning,
        time_horizon: horizon,
        pricing_state: pricing,
        is_portfolio_position: isPortfolio,
        is_watchlist_position: isWatchlist,
        idea_type: candidate?.idea_type || null,
        idea_rank: candidate?.idea_rank || null,
        is_fallback_idea: Boolean(candidate?.fallback),
        overlaps_portfolio: overlapPortfolio,
        overlaps_watchlist: overlapWatchlist,
      });
    };

    if (includePortfolio) portfolio.forEach((row: any) => addAsset(row, "Portfolio", true, false));
    if (includeWatchlist) watchlist.forEach((row: any) => addAsset(row, "Watchlist", false, true));

    // Marktideen sind ein eigener Analysepfad und werden immer erzeugt – unabhängig
    // von Portfolio, Watchlist und gewähltem Bestandsabgleich.
    marketIdeas.forEach((candidate: any) => addAsset(
      {name: candidate.company_name || candidate.name, symbol: candidate.symbol},
      `Marktidee · ${candidate.idea_label || "Recherchekandidat"}`,
      false,
      false,
      candidate,
    ));

    const portfolioAssets = assets.filter((asset: any) => asset.is_portfolio_position);
    const ideaAssets = assets.filter((asset: any) => !asset.is_portfolio_position && !asset.is_watchlist_position);
    const portfolioImpact = portfolioAssets.length
      ? Math.round(portfolioAssets.reduce((sum: number, asset: any) => sum + Number(asset.impact_score || 0), 0) / portfolioAssets.length)
      : 0;
    const relevance = clamp(
      38 + effectiveHits.length * 9 + Math.min(sources.length, 12) * 2 + Math.min(ideaAssets.length, 8)
      + (portfolioAssets.some((asset: any) => Math.abs(asset.impact_score) >= 40) ? 8 : 0),
      35,
      96,
    );
    const confidence = clamp(
      baseConfidence + (effectiveHits.length ? 5 : -5) + Math.min(ideaAssets.filter((asset: any) => !asset.is_fallback_idea).length, 8),
      30,
      94,
    );

    const baseProbability = effectiveHits.length ? 55 : 45;
    const scenarios = [
      {
        scenario_type: "base",
        title: "Basisszenario",
        description: `Das Ereignis wirkt selektiv auf ${finalSectors.join(", ")}. Direkte Exponierungen reagieren stärker als nur indirekt verbundene Werte; die Kurswirkung hängt von Bestätigung und Einpreisung ab.`,
        probability: baseProbability,
        portfolio_effect: portfolioImpact < -20 ? "moderat negativ" : portfolioImpact > 20 ? "moderat positiv" : "überwiegend neutral bis gemischt",
        market_effect: `Unabhängiger Markt-Scan mit ${ideaAssets.length} Ideen in ${finalSectors.slice(0, 5).join(", ")}.`,
        confirmation_signals: ["mehrere unabhängige Quellen bestätigen das Ereignis", "anhaltende relative Kursstärke oder -schwäche", "Unternehmensmeldungen konkretisieren die Ergebniswirkung"],
        invalidation_signals: ["rasche politische oder regulatorische Rücknahme", "fehlende Bestätigung durch Preise, Volumen und Unternehmensmeldungen"],
      },
      {
        scenario_type: "bull",
        title: "Positives Szenario",
        description: "Belastende Effekte bleiben begrenzt oder werden durch Ausweichlieferketten, politische Förderung, Nachfragestärke oder eine schnelle Einigung kompensiert.",
        probability: effectiveHits.length ? 25 : 30,
        portfolio_effect: "Belastete Positionen stabilisieren sich; strukturelle Profiteure können relative Stärke ausbauen.",
        market_effect: "Selektive Bewertungsaufschläge für glaubwürdige Profiteure; Risikoaufschläge sinken.",
        confirmation_signals: ["Entspannung in offiziellen Meldungen", "sinkende Risikoaufschläge", "positive Prognosebestätigungen"],
        invalidation_signals: ["Ausweitung der Maßnahme", "Gewinnwarnungen oder neue Lieferengpässe"],
      },
      {
        scenario_type: "bear",
        title: "Negatives Szenario",
        description: "Das Ereignis verschärft sich und erzeugt Zweitrundeneffekte über Kosten, Nachfrage, Regulierung, Finanzierung oder Lieferketten.",
        probability: effectiveHits.length ? 20 : 25,
        portfolio_effect: "Höhere Volatilität; exponierte Positionen können eine engere Risiko- und Invalidationsteuerung erfordern.",
        market_effect: "Breitere Risikoaversion in betroffenen Branchen und steigende Bewertungsabschläge.",
        confirmation_signals: ["Gewinnwarnungen", "weitere Restriktionen", "deutliche Volumenspitzen bei Kursverlusten", "Ausweitung auf angrenzende Branchen"],
        invalidation_signals: ["glaubwürdige Gegenmaßnahmen", "schnelle Einigung", "fundamentale Auswirkungen bleiben messbar gering"],
      },
    ];

    const signals = finalSectors.slice(0, 7).map((sector, index) => ({
      signal_name: `${sector}: Bestätigung beobachten`,
      signal_description: `Unternehmensmeldungen, relevante Preise, Schätzungsrevisionen und relative Kursreaktion im Bereich ${sector} verfolgen.`,
      current_status: "offen",
      importance: clamp(88 - index * 6, 48, 88),
    }));

    const title = input.length > 110 ? `${input.slice(0, 107)}…` : input;
    const topPositiveIdea = ideaAssets.find((asset: any) => Number(asset.impact_score || 0) > 20);
    const topRiskIdea = ideaAssets.find((asset: any) => Number(asset.impact_score || 0) < -20);
    const ideaAction = topPositiveIdea
      ? `Unabhängige Marktidee priorisiert prüfen: ${topPositiveIdea.company_name}.`
      : topRiskIdea
      ? `Unabhängigen Risiko-Kandidaten priorisiert prüfen: ${topRiskIdea.company_name}.`
      : "Die niedrig-konfidenten Recherchekandidaten zunächst über Unternehmensmeldungen und Kursreaktion validieren.";
    const keyAction = portfolioImpact <= -30
      ? `Exponierte Portfolio-Positionen zuerst prüfen. ${ideaAction}`
      : portfolioImpact >= 30
      ? `Positive Portfolio-Exponierung nicht ungeprüft aufstocken. ${ideaAction}`
      : `Keine spontane Transaktion. ${ideaAction}`;
    const analysis = {
      event_title: title,
      event_summary: `Marktimpulsanalyse mit Fokus auf ${finalSectors.join(", ")}; Marktideen werden unabhängig vom Portfolio erzeugt.`,
      interpretation: effectiveHits.length
        ? `Die Eingabe wurde ${effectiveHits.length === 1 ? "einem Hauptthema" : `${effectiveHits.length} Themen`} zugeordnet. Erwartet werden direkte und indirekte Effekte auf ${finalSectors.join(", ")}.`
        : `Die Eingabe konnte keinem vordefinierten Hauptthema eindeutig zugeordnet werden. Die unabhängige Ideen-Engine verwendet deshalb eine niedrig-konfidente Mechanismus- und Recherche-Rückfallebene; jede Idee ist vor einer Handlung gezielt zu verifizieren.`,
      analysis_horizon: horizon,
      risk_profile: String(body.risk_profile || "chancenorientiert"),
      regions: Array.isArray(body.regions) && body.regions.length ? body.regions : ["weltweit"],
      market_relevance: relevance,
      portfolio_impact: portfolioImpact,
      confidence_score: confidence,
      pricing_state: pricing,
      key_action: keyAction,
      affected_sectors: finalSectors,
      market_idea_count: ideaAssets.length,
      idea_engine: {
        version: IDEA_ENGINE_VERSION,
        independent_from_portfolio: true,
        used_fallback: Boolean(ideaEngine.used_fallback),
        matched_themes: effectiveHits.map((theme: any) => theme.id),
      },
      assets,
      scenarios,
      sources,
      signals,
    };

    const {data: head, error: headError} = await admin.from("event_analyses").insert({
      user_id: user.id,
      event_input: input,
      event_title: title,
      event_summary: analysis.event_summary,
      analysis_horizon: horizon,
      risk_profile: analysis.risk_profile,
      regions: analysis.regions,
      analysis_scope: scope,
      market_relevance: relevance,
      portfolio_impact: portfolioImpact,
      confidence_score: confidence,
      pricing_state: pricing,
      key_action: keyAction,
      raw_result: analysis,
    }).select("id").single();
    if (headError) throw headError;
    analysisId = String(head.id);

    const childOperations = [
      assets.length ? admin.from("event_analysis_assets").insert(assets.map(asset => ({...asset, analysis_id: analysisId, user_id: user.id}))) : Promise.resolve({error: null}),
      admin.from("event_analysis_scenarios").insert(scenarios.map(scenario => ({...scenario, analysis_id: analysisId, user_id: user.id}))),
      sources.length ? admin.from("event_analysis_sources").insert(sources.map(source => ({...source, analysis_id: analysisId, user_id: user.id}))) : Promise.resolve({error: null}),
      signals.length ? admin.from("event_analysis_signals").insert(signals.map(signal => ({...signal, analysis_id: analysisId, user_id: user.id}))) : Promise.resolve({error: null}),
    ];
    const childResults = await Promise.all(childOperations);
    const childError = childResults.find((result: any) => result?.error)?.error;
    if (childError) throw childError;

    return response({ok: true, version: BUILD_VERSION, analysis_id: analysisId, analysis});
  } catch (error) {
    console.error(BUILD_VERSION, error);
    if (analysisId) {
      try {
        const url = env("SUPABASE_URL");
        const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
        if (url && serviceKey) await createClient(url, serviceKey).from("event_analyses").delete().eq("id", analysisId);
      } catch (_cleanupError) {}
    }
    return response({ok: false, version: BUILD_VERSION, error: error instanceof Error ? error.message : String(error)}, 500);
  }
});
