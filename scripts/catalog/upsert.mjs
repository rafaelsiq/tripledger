// Writes suggested rolês straight into Firestore `activityCatalog` (the source of truth).
//
//   node upsert.mjs <batch.json>             validate, skip duplicates, create the rest
//   node upsert.mjs <batch.json> --dry-run   validate and show what would be created
//   node upsert.mjs --list <destinationKey>  print the rolês already in Firestore
//
// batch.json: { "destinationKey": "rio-de-janeiro", "destinationName": "Rio de Janeiro",
//               "entries": [ ...see catalog/README.md... ] }
//
// Duplicates are never written: an entry is skipped when Firestore already has the same
// doc id (destinationKey__slug), the same normalized title or the same mapUrl for that
// destination. Existing docs are never changed or deleted. New docs land `published`.
//
// Uses the Firestore REST API with the app's public web config, so it needs no
// dependencies. Set CATALOG_BOT_EMAIL / CATALOG_BOT_PASSWORD to sign in as a Firebase
// Auth user when the security rules require authentication.

import { readFileSync } from 'node:fs';

// Public web config, same as src/lib/firebase.ts.
const PROJECT_ID = 'tripledger-app';
const WEB_API_KEY = 'AIzaSyD754gAr8aOjZfbMlWcPbVIUcoxcTb5ebw';
const COLLECTION = 'activityCatalog';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const CATEGORIES = ['praia', 'trilha', 'comida', 'passeio', 'noite', 'cultura', 'descanso'];
const KINDS = ['activity', 'rest'];
const PERIODS = ['morning', 'afternoon', 'night', 'any'];
const COSTS = ['free', '$', '$$', '$$$'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HTTPS = /^https:\/\//;
const MAX_EXTRA_SOURCES = 5;
const CONTENT_FIELDS = [
  'title',
  'description',
  'category',
  'kind',
  'location',
  'mapUrl',
  'imageUrl',
  'durationMin',
  'bestPeriod',
  'costHint',
  'sourceUrl',
  'extraSources',
  'batchId',
];
const FILLER_WORDS = new Set(['o', 'a', 'os', 'as', 'do', 'da', 'dos', 'das', 'de', 'e', 'no', 'na', 'em', 'the', 'of']);

/** "Praia do Arpoador" and "praia  arpoador" compare equal. */
export function titleKey(title) {
  return String(title)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !FILLER_WORDS.has(word))
    .join(' ');
}

function domainOf(url) {
  return new URL(url).hostname.replace(/^www\./, '');
}

export function validateBatch(batch) {
  const fail = (message) => {
    throw new Error(message);
  };
  if (!SLUG.test(batch.destinationKey ?? '')) fail('destinationKey must be a slug');
  if (!batch.destinationName?.trim()) fail('destinationName is required');
  if (!Array.isArray(batch.entries)) fail('entries must be an array');

  const slugs = new Set();
  const titles = new Map();
  const maps = new Map();
  batch.entries.forEach((entry, index) => {
    const at = `entries[${index}] (${entry.slug ?? 'no slug'})`;
    if (!SLUG.test(entry.slug ?? '')) fail(`${at}: slug must be lowercase-with-dashes`);
    if (slugs.has(entry.slug)) fail(`${at}: duplicate slug in batch`);
    slugs.add(entry.slug);
    if (!entry.title?.trim()) fail(`${at}: title is required`);
    const key = titleKey(entry.title);
    if (titles.has(key)) fail(`${at}: same place as "${titles.get(key)}" in batch`);
    titles.set(key, entry.slug);
    if (entry.mapUrl) {
      if (maps.has(entry.mapUrl)) fail(`${at}: same mapUrl as "${maps.get(entry.mapUrl)}" in batch`);
      maps.set(entry.mapUrl, entry.slug);
    }
    if (!CATEGORIES.includes(entry.category)) fail(`${at}: category must be one of ${CATEGORIES.join(', ')}`);
    if (entry.kind !== undefined && !KINDS.includes(entry.kind)) fail(`${at}: kind must be activity or rest`);
    if (entry.bestPeriod !== undefined && !PERIODS.includes(entry.bestPeriod)) fail(`${at}: bad bestPeriod`);
    if (entry.costHint !== undefined && !COSTS.includes(entry.costHint)) fail(`${at}: bad costHint`);
    if (entry.durationMin !== undefined && !(Number.isInteger(entry.durationMin) && entry.durationMin > 0)) {
      fail(`${at}: durationMin must be a positive integer`);
    }
    for (const field of ['mapUrl', 'imageUrl', 'sourceUrl']) {
      if (entry[field] !== undefined && !HTTPS.test(entry[field])) fail(`${at}: ${field} must be an https URL`);
    }
    const extra = entry.extraSources ?? [];
    if (!Array.isArray(extra) || extra.length > MAX_EXTRA_SOURCES || extra.some((url) => !HTTPS.test(url))) {
      fail(`${at}: extraSources must be up to ${MAX_EXTRA_SOURCES} https URLs`);
    }
    // Every rolê is cross-checked: the main source plus at least one other site.
    if (!entry.sourceUrl) fail(`${at}: sourceUrl is required`);
    if (new Set([entry.sourceUrl, ...extra].map(domainOf)).size < 2) {
      fail(`${at}: needs sources from at least 2 different sites (sourceUrl + extraSources)`);
    }
  });
}

// --- Firestore REST -------------------------------------------------------------

function toValue(value) {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === 'number') return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  throw new Error(`Unsupported value: ${JSON.stringify(value)}`);
}

function fromValue(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(fromValue);
  return null;
}

async function authHeaders() {
  const email = process.env.CATALOG_BOT_EMAIL;
  const password = process.env.CATALOG_BOT_PASSWORD;
  if (!email || !password) return {};
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!res.ok) throw new Error(`Sign-in failed: ${res.status} ${await res.text()}`);
  const { idToken } = await res.json();
  return { Authorization: `Bearer ${idToken}` };
}

async function listExisting(destinationKey, headers) {
  const res = await fetch(`${BASE}:runQuery?key=${WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: COLLECTION }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'destinationKey' },
            op: 'EQUAL',
            value: { stringValue: destinationKey },
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Query failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows
    .filter((row) => row.document)
    .map((row) =>
      Object.fromEntries(
        Object.entries(row.document.fields ?? {}).map(([key, value]) => [key, fromValue(value)])
      )
    );
}

async function createDoc(id, data, headers) {
  const fields = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toValue(value)]));
  const res = await fetch(
    `${BASE}/${COLLECTION}?documentId=${encodeURIComponent(id)}&key=${WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ fields }),
    }
  );
  if (res.status === 409) return 'exists';
  if (!res.ok) throw new Error(`Create ${id} failed: ${res.status} ${await res.text()}`);
  return 'created';
}

// --- CLI ------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const headers = await authHeaders();

  if (args[0] === '--list') {
    const existing = await listExisting(args[1] ?? 'rio-de-janeiro', headers);
    for (const entry of existing.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))) {
      console.log([entry.title, entry.category, entry.location ?? '', entry.status].join(' | '));
    }
    console.log(`${existing.length} rolês em ${args[1] ?? 'rio-de-janeiro'}.`);
    return;
  }

  const file = args.find((arg) => !arg.startsWith('--'));
  if (!file) throw new Error('Usage: node upsert.mjs <batch.json> [--dry-run] | --list <destinationKey>');
  const dryRun = args.includes('--dry-run');
  const batch = JSON.parse(readFileSync(file, 'utf8'));
  validateBatch(batch);

  const existing = await listExisting(batch.destinationKey, headers);
  const takenIds = new Set(existing.map((entry) => entry.id));
  const takenTitles = new Map(existing.map((entry) => [titleKey(entry.title), entry.title]));
  const takenMaps = new Map(existing.filter((entry) => entry.mapUrl).map((entry) => [entry.mapUrl, entry.title]));

  const now = Date.now();
  const skipped = [];
  let created = 0;
  for (const entry of batch.entries) {
    const id = `${batch.destinationKey}__${entry.slug}`;
    const dupe =
      (takenIds.has(id) && 'mesmo id') ||
      (takenTitles.has(titleKey(entry.title)) && `mesmo título que "${takenTitles.get(titleKey(entry.title))}"`) ||
      (entry.mapUrl && takenMaps.has(entry.mapUrl) && `mesmo mapa que "${takenMaps.get(entry.mapUrl)}"`);
    if (dupe) {
      skipped.push(`${entry.title} (${dupe})`);
      continue;
    }
    const doc = { id, destinationKey: batch.destinationKey, destinationName: batch.destinationName, kind: 'activity' };
    for (const field of CONTENT_FIELDS) {
      if (entry[field] !== undefined) doc[field] = typeof entry[field] === 'string' ? entry[field].trim() : entry[field];
    }
    Object.assign(doc, { source: 'routine', status: 'published', usageCount: 0, createdAt: now, updatedAt: now });

    if (dryRun) {
      console.log(`+ ${entry.title}`);
    } else if ((await createDoc(id, doc, headers)) === 'exists') {
      skipped.push(`${entry.title} (mesmo id)`);
      continue;
    } else {
      console.log(`+ ${entry.title}`);
    }
    takenIds.add(id);
    takenTitles.set(titleKey(entry.title), entry.title);
    if (entry.mapUrl) takenMaps.set(entry.mapUrl, entry.title);
    created += 1;
  }

  for (const line of skipped) console.log(`= pulado: ${line}`);
  console.log(
    `${dryRun ? 'Simulação: ' : ''}${created} ${dryRun ? 'seriam criados' : 'criados'}, ${skipped.length} repetidos pulados ` +
      `(${existing.length} já existiam em ${batch.destinationKey}).`
  );
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
