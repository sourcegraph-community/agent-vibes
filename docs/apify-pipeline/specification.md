# Apify Pipeline – Technische Spezifikation

## 1. Ziel & Scope
- **Ziel:** Automatisierte Sammlung, Aufbereitung und Visualisierung von Social-Media-Erwähnungen rund um Coding-Agenten.
- **Scope:** Produktionstaugliche Pipeline für Tweets (MVP). Erweiterbarkeit auf weitere Quellen ist eingeplant, aber nicht Teil der ersten Iteration.

## 2. Stakeholder & Verantwortlichkeiten
- **Product/Analytics:** Definieren Schlagworte, Reporting-Anforderungen und KPI.
- **Engineering (Data/Backend):** Implementiert Apify Actor, Normalisierung, Supabase-Integration.
- **Engineering (ML/AI):** Wartet Sentiment-Service mit Gemini und verbessert Modelle.
- **Engineering (Frontend):** Erstellt Dashboard in Next.js, stellt Visualisierungen bereit.
- **Ops/Platform:** Verwaltet Secrets, Monitoring, Deployment auf Vercel.

## 3. Funktionale Anforderungen
### 3.1 Datenerfassung
- Vercel Cron ruft das interne Endpoint `/api/start-apify-run` auf, welches den Apify Run API Call proxyt; Intervalle unter 24 h setzen mindestens den Vercel Pro Plan voraus.
- Manuelle Trigger über Apify UI oder REST Endpoint bleiben unverändert.
- Datenerfassung benötigt entweder X API Pro-Zugänge (≈ US$ 5 k/Monat) oder den Apify Tweet Scraper; Scraper-Runs müssen Anti-Monitoring-Auflagen (Pausen, max. fünf Queries) respektieren.
- Actor nutzt vordefinierte Schlagwort-Liste (konfigurierbar via Supabase Tabelle `keywords`).
- Bei API-Limit-Fehlern oder Netzwerkfehlern erfolgt Retry (exponentiell bis zu 3 Versuche).
- Monitoring der Duplikatquote: Speichert Tweet-IDs in Supabase, Runs dokumentieren Verhältnis `neu vs. dupliziert` (via `cron_runs`).

> Hinweis: X API Pro liegt bei ≈ US$ 5 k/Monat; Scraper-Runs riskieren Account-Drosselung bei zu hoher Frequenz.

### 3.2 Datenverarbeitung
- Actor normalisiert Tweets auf ein einheitliches Schema (`normalized_tweets`).
- Entfernt Duplikate anhand Tweet-ID + Plattform.
- Ergänzt Metadaten: Zeitpunkt, Quelle, Sprache, Engagement (Likes/Retweets).

### 3.3 Persistenz
- Rohdaten optional in Tabelle `raw_tweets` (JSON) für Debugging.
- Normalisierte Daten in `normalized_tweets`.
- Sentiment-Resultate in `tweet_sentiments`.
- Historisierung ohne Mutationen (append-only); Aktualisierungen via `upsert` nach Tweet-ID.
- Backfill-Strategie: Einmalige Aufteilung der letzten 30 Tage in mehrere 5-Tage-Läufe mit erhöhtem `maxItems`; bei X API Pro können Läufe dichter getaktet werden, Apify Scraper erfordern hingegen Pausen (>5 Minuten) und begrenzte Query-Batches.

### 3.4 Sentiment-Analyse
- Supabase Edge Function überwacht neue Einträge in `normalized_tweets` (Primärpfad für Sentiment-Verarbeitung) und trackt den jeweils letzten verarbeiteten Tweet-Zeitstempel je Keyword.
- Die Function ruft `gemini-2.5-flash` oder `flash-lite` via Structured Output (Enum `positive|neutral|negative`) auf; Google stellt keinen dedizierten Sentiment-Endpunkt bereit.
- Rate-Limits und Kosten (Free ~15 RPM/1,5 M Tokens pro Tag; entgeltlich laut aktuellem Pricing) bestimmen Batch-Größe und Queueing; Supabase Functions + Storage-Queue puffern Überschreitungen.
- API Keys (`GEMINI_API_KEY`) liegen in Supabase Secrets bzw. Vercel Env Vars und werden regelmäßig rotiert.
- Ergebnisse (Score -1…1, Kategorie, erweiterte Insights) werden in `tweet_sentiments` gespeichert; Fehlerhafte Aufrufe landen in `sentiment_failures`, Fallback bleibt eine Vercel Serverless Function für Re-Runs.

### 3.5 Frontend / Dashboard
- Next.js 15 App Router (async Request APIs) visualisiert Erwähnungen, Sentiment-Verteilung und Trends.
- Supabase-Anbindung erfolgt über `@supabase/ssr` Helpers sowie Server Actions; Token-Refresh und Cookies folgen dem neuen Async-Pattern.
- Detailansicht pro Tweet inklusive Original-Link sowie Filterung nach Zeitraum, Sprache, Schlagwort und Sentiment.
- Realtime-Updates via Supabase Realtime optional (Stretch Goal) unter Beachtung der aktuellen Kanal- und Nachrichtenkontingente.

## 4. Nicht-funktionale Anforderungen
- **Performance:** Pipeline verarbeitet mindestens 500 Tweets pro Lauf ohne Timeout (>60s Puffer).
- **Verfügbarkeit:** Geplante Betriebszeit 24/7; Cron-Fenster darf höchstens zwei Läufe hintereinander ausfallen.
- **Skalierbarkeit:** Erhöhung der Frequenz und Datenquellen ohne Codeänderung (nur Konfiguration).
- **Sicherheit:** Secrets als `sb_secret_*` in Vercel/Apify/Supabase Secret Stores; keine Secrets im Repo und regelmäßige Rotation.
- **Compliance:** Einhaltung X API Terms bzw. Apify Scraper-Richtlinien; Datenlöschung auf Anfrage.

## 5. Architektur & Komponenten
- **Apify Actor:** Node.js/TypeScript Skripte, entweder X API Pro (Budget-Freigabe) oder Apify Tweet Scraper mit Anti-Monitoring-Pacing.
- **Supabase:** Postgres + Edge Functions, Auth via `sb_secret_*` Keys; PG17-kompatible Erweiterungen (z. B. Alternativen zu TimescaleDB) werden berücksichtigt.
- **Sentiment Worker:** Supabase Edge Function mit Gemini 2.5 Structured Output, optionaler Vercel Serverless Fallback für Bulk-Re-Runs.
- **Frontend:** Next.js 15 App Router auf Vercel (Node.js 20, async Request APIs, `@supabase/ssr` Integration).
- **Monitoring:** Supabase Logs/Realtime Limits, Apify Actor Run Logs, Vercel Cron Status & Planverbrauch.

## 6. Datenmodell (Entwurf)
```text
raw_tweets
- id (uuid)
- platform_id (text) -- Tweet ID
- platform (text) -- "twitter"
- collected_at (timestamptz)
- payload (jsonb)

normalized_tweets
- id (uuid)
- platform_id (text)
- platform (text)
- author_handle (text)
- author_name (text)
- posted_at (timestamptz)
- collected_at (timestamptz)
- language (text)
- text (text)
- url (text)
- engagement_likes (int)
- engagement_retweets (int)
- keywords (text[])
- status (text) -- "pending_sentiment" | "processed" | "failed"

tweet_sentiments
- id (uuid)
- normalized_tweet_id (uuid)
- sentiment_label (text) -- "positive" | "neutral" | "negative"
- sentiment_score (numeric)
- summary (text)
- model_version (text)
- processed_at (timestamptz)

sentiment_failures
- id (uuid)
- normalized_tweet_id (uuid)
- error_message (text)
- retry_count (int)
- last_attempt_at (timestamptz)

keywords
- keyword (text) PRIMARY KEY
- enabled (boolean)
- last_used_at (timestamptz)

cron_runs
- id (uuid)
- started_at (timestamptz)
- finished_at (timestamptz)
- status (text)
- processed_count (int)
- errors (jsonb)
```

> Hinweis: Für großvolumige Läufe Supabase Cron + Queue Pattern (Storage + Edge Functions) nutzen, um Gemini-Limits und Scraper-Pausen einzuhalten.

## 7. Workflows
### 7.1 Automatischer Lauf
1. Vercel Cron ruft `/api/start-apify-run` auf (Vercel Function) und diese proxyt den Apify Run API Aufruf.
2. Actor lädt X API Pro Credentials oder Apify Scraper Tokens und liest `keywords` aus Supabase.
3. Actor ruft Tweets ab, speichert Rohdaten (`raw_tweets`).
4. Actor transformiert und upsertet `normalized_tweets`.
5. Actor markiert Datensätze als `pending_sentiment`.
6. Supabase Trigger/Function feuert, ruft Gemini 2.5 via Structured Output auf.
7. Sentiment-Ergebnis wird in `tweet_sentiments` gespeichert, Status auf `processed` gesetzt.
8. Dashboard konsumiert Daten via Supabase API.

### 7.2 Manueller Lauf
1. User startet Actor in Apify UI oder via API.
2. Schritte identisch zu automatischem Lauf.

### 7.3 Fehlerbehandlung
- Actor protokolliert Fehler je Lauf in `cron_runs.errors`.
- Bei API-Limit überschreitung: Backoff und Abbruch nach Erreichen der Obergrenze, Lauf wird als `failed` markiert.
- Sentiment-Worker versucht bis zu 2 automatische Retries; danach Eintrag in `sentiment_failures`.

## 8. Integrationen & Secrets
- **X API / Apify Tokens:** X API Pro Keys (Key, Secret, Bearer) bzw. Apify Token im Apify KV Store (Production) und `.env.local` (Development).
- **Supabase Secret Keys:** `sb_secret_*` Werte in Vercel & Apify Secret Store; `sb_publishable_*` für clientseitige Nutzung.
- **Gemini API Key:** In Vercel Secret Store (Edge Function) / Supabase Secrets; Rotation parallel zur Modellversion (`gemini-2.5-*`).
- **Environment Variablen:** `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `X_API_KEY`, `APIFY_TOKEN`, `GEMINI_API_KEY`.

## 9. Deployment & Environments
- **Development:** Lokaler Actor Test mit Apify CLI, Supabase local DB oder Project Dev Project; Next.js 15 App nutzt async Request APIs (`npm run dev`, Node 20).
- **Staging:** Separates Supabase Projekt, Vercel Preview Environment mit Cron auf `/api/start-apify-run`, dedizierter Apify Actor Env.
- **Production:** Vercel Production (Pro Plan, Node.js 20 Runtime), Supabase Prod, Apify Prod Actor Version.
- CI/CD deployt Actor Skripte via GitHub Actions/Apify CLI; Frontend Builds evaluieren Turbopack (Beta) vor Rollout.

## 10. Observability & Monitoring
- Apify Run Logs für jede Ausführung.
- Supabase Logdrains & Realtime-Dashboards für Functions sowie Kanal-/Nachrichtenquoten.
- Vercel Cron Monitoring (Pro-Plan Usage, Failure Alerts via Slack/Email).
- Optional: Metriken in Supabase Tabelle `metrics_pipeline`.

## 11. Offene Fragen & Follow-ups
- Zeitplan für Erweiterung auf weitere Quellen (Reddit/HN etc.).
- Monitoring & Feinjustierung der Apify-Limits (Validierung `maxItems` ≈ 200 je Keyword, Kosten-Guardrails).
- Retentionsdauer für `raw_tweets` und Archivierungsstrategie finalisieren.
- Umgang mit leeren/Rate-limitierte Actor-Runs (Retry, Alarmierung, Pausen zwischen Runs).
- Datenqualität bei gelöschten/geschützten Tweets sowie fehlenden Metadaten (Kennzeichnung vs. Verwerfen).
- Fehler- und Retry-Strategie für Gemini-Sentiment inklusive Trigger für Vercel-Fallback ohne Duplikate.

## 12. Apify Tweet Scraper Inputs
| Feld | Typ | Beschreibung | Standardwert |
| --- | --- | --- | --- |
| `startUrls` | Array<string> | Liste von direkten Twitter-URLs (Tweet, Profil, Suche, Liste), die unmittelbar gecrawlt werden. | `[]` |
| `searchTerms` | Array<string> | Freitext-Suchbegriffe, unterstützt erweiterte Twitter-Suche. | `[]` |
| `twitterHandles` | Array<string> | Twitter Handles, deren öffentliche Timeline durchsucht wird. | `[]` |
| `conversationIds` | Array<string> | Konversations-IDs für Thread-Abfragen. | `[]` |
| `tweetLanguage` | string | ISO-639-1 Sprachcode zur Einschränkung der Ergebnisse. | `null` |
| `maxItems` | number | Maximale Anzahl zurückgelieferter Tweets. | `Infinity` |
| `onlyVerifiedUsers` | boolean | Liefert nur Tweets verifizierter Accounts. | `false` |
| `onlyTwitterBlue` | boolean | Liefert nur Tweets von Twitter-Blue-Abonnenten. | `false` |
| `onlyImage` | boolean | Filtert auf Tweets mit Bildanhang. | `false` |
| `onlyVideo` | boolean | Filtert auf Tweets mit Videoanhang. | `false` |
| `onlyQuote` | boolean | Filtert auf Tweets, die Zitate sind. | `false` |
| `author` | string | Beschränkt auf Tweets einer bestimmten Person (Handle). | `null` |
| `inReplyTo` | string | Liefert nur Replies auf einen bestimmten Account (Handle). | `null` |
| `mentioning` | string | Liefert Tweets, die einen bestimmten Account erwähnen (Handle). | `null` |
| `geotaggedNear` | string | Freitext-Ortsangabe, Tweets aus der Umgebung des Ortes. | `null` |
| `withinRadius` | string | Radiusangabe zur Kombination mit `geotaggedNear` (z. B. "50km"). | `null` |
| `geocode` | string | Geokoordinaten + Radius (`lat,long,km`) zur Standortfilterung. | `null` |
| `placeObjectId` | string | IDs für Twitter-Places; filtert auf Tweets mit diesem Place-Tag. | `null` |
| `minimumRetweets` | number | Mindestanzahl an Retweets pro Tweet. | `null` |
| `minimumFavorites` | number | Mindestanzahl an Likes pro Tweet. | `null` |
| `minimumReplies` | number | Mindestanzahl an Replies pro Tweet. | `null` |
| `start` | string | Startdatum/-zeit (ISO 8601) für die Ergebnismenge. | `null` |
| `end` | string | Enddatum/-zeit (ISO 8601) für die Ergebnismenge. | `null` |
| `sort` | string | Sortierung der Suchergebnisse (`Top` · `Latest`). | `Top` |
| `includeSearchTerms` | boolean | Fügt jedem Ergebnis das verwendete Suchwort hinzu. | `false` |
| `customMapFunction` | string | JavaScript-Funktion zur Anpassung der zurückgegebenen Objekte (kein Filtering!). | `null` |

**Hinweise:**
- `customMapFunction` wird serverseitig ausgeführt und muss idempotent sein; Filter-Logik führt zu Sperrung des Actors.
- Geografische Filter (`geotaggedNear`, `withinRadius`, `geocode`, `placeObjectId`) sind optional, aber gegenseitig kombinierbar.
- Bei gleichzeitiger Nutzung von `startUrls` und Suchparametern werden beide Quellen verarbeitet, bis `maxItems` erreicht ist.

> Hinweis: Der Tweet Scraper erlaubt nur einen Run gleichzeitig, maximal fünf Queries pro Batch und Pausen von mehreren Minuten; Cron-Schedules müssen diese Auflagen erfüllen.

## 13. Lokaler Probelauf (Pre-Prod)
1. **Supabase lokal starten:** `supabase start`, Einspielen der Schema-Migrationen (Tabellen aus Abschnitt 6).
2. **Apify Actor lokal:** `apify run` mit `apify_config_dev.json`, `maxItems` klein halten, Tweets wahlweise mocken oder echtes Test-Keyword.
3. **Gemini Mock:** Lokale Stub-API (z. B. Express/Edge Function) oder Replay-Dateien, um Sentiment ohne Kosten zu simulieren.
4. **Sentiment Worker lokal:** Supabase Edge Function via `supabase functions serve` oder Vercel Dev Function (`vercel dev`), jeweils mit Dummy-Keys.
5. **Next.js Frontend:** `npm run dev` (Node 20) mit `.env.local`, `@supabase/ssr` Helpers und async Request APIs prüfen.
6. **End-to-End-Run:** Actor -> Supabase -> Sentiment -> Frontend; Logs, Duplikatstatistik und Gemini-Kontingente prüfen; optional `next build --turbopack` (Beta) gegen CI testen.

## 14. Zukünftige Erweiterungen
- **Erweiterte Dashboard-KPIs:** Umsetzung der VistaSocial-Empfehlungen (Sentiment-Score-Trends, Mention-Volumen, Share of Voice, Plattform-Breakdown, Keyword- & Engagement-Analysen, Influencer- und Issue-Tracking).
- **Sentiment-Alerts:** Automatisiertes Alerting bei negativen Sentiment-Spikes inkl. Schwellenwert-Definition und Alert-Kanal (Slack/E-Mail).
- **Realtime-Funktionalität:** Prüfung, ob eingeschränkte Near-Real-Time-Updates möglich sind, ohne Apify-Richtlinien zu verletzen (z. B. eng getaktete Ad-hoc-Runs).
- **Hosting & Kostensteuerung:** Beobachtung der Vercel Pro Cron Credits, Supabase Realtime-Kontingente und Gemini-Tokenpreise; Vorbereitung auf Next.js 16 Async-API-Stabilisierung.
