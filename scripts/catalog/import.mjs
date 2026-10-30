// Imports catalog/<destination>.json files into Firestore `activityCatalog`.
//
//   node import.mjs              validate and write every catalog file
//   node import.mjs --dry-run    validate only (no credentials needed)
//
// Credentials: FIREBASE_SERVICE_ACCOUNT (the service account JSON as a string, used
// by CI) or GOOGLE_APPLICATION_CREDENTIALS pointing at the key file (local runs).
//
// Merging a catalog PR is the review step, so new entries arrive `published`.
// Existing docs keep their status, usageCount and createdAt: a rolê you rejected or
// edited in Firestore is never reset by a later import, and removing an entry from
// the file never deletes it.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CATALOG_DIR = join(ROOT, 'catalog');
const COLLECTION = 'activityCatalog';
const PROJECT_ID = 'tripledger-app';

const CATEGORIES = ['praia', 'trilha', 'comida', 'passeio', 'noite', 'cultura', 'descanso'];
const KINDS = ['activity', 'rest'];
const PERIODS = ['morning', 'afternoon', 'night', 'any'];
const COSTS = ['free', '$', '$$', '$$$'];
const SOURCES = ['curated', 'routine'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Fields copied from the file on every import; everything else is owned by Firestore. */
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

const MAX_EXTRA_SOURCES = 5;

function domainOf(url) {
  return new URL(url).hostname.replace(/^www\./, '');
}

const dryRun = process.argv.includes('--dry-run');

function fail(file, message) {
  throw new Error(`${file}: ${message}`);
}

function validate(file, catalog) {
  if (!SLUG.test(catalog.destinationKey ?? '')) fail(file, 'destinationKey must be a slug');
  if (!catalog.destinationName?.trim()) fail(file, 'destinationName is required');
  if (!Array.isArray(catalog.entries)) fail(file, 'entries must be an array');

  const seen = new Set();
  catalog.entries.forEach((entry, index) => {
    const at = `entries[${index}] (${entry.slug ?? 'no slug'})`;
    if (!SLUG.test(entry.slug ?? '')) fail(file, `${at}: slug must be lowercase-with-dashes`);
    if (seen.has(entry.slug)) fail(file, `${at}: duplicate slug`);
    seen.add(entry.slug);
    if (!entry.title?.trim()) fail(file, `${at}: title is required`);
    if (!CATEGORIES.includes(entry.category)) fail(file, `${at}: category must be one of ${CATEGORIES.join(', ')}`);
    if (entry.kind !== undefined && !KINDS.includes(entry.kind)) fail(file, `${at}: kind must be activity or rest`);
    if (entry.bestPeriod !== undefined && !PERIODS.includes(entry.bestPeriod)) fail(file, `${at}: bad bestPeriod`);
    if (entry.costHint !== undefined && !COSTS.includes(entry.costHint)) fail(file, `${at}: bad costHint`);
    if (entry.source !== undefined && !SOURCES.includes(entry.source)) fail(file, `${at}: source must be curated or routine`);
    if (entry.durationMin !== undefined && !(Number.isInteger(entry.durationMin) && entry.durationMin > 0)) {
      fail(file, `${at}: durationMin must be a positive integer`);
    }
    for (const key of ['mapUrl', 'imageUrl', 'sourceUrl']) {
      if (entry[key] !== undefined && !/^https:\/\//.test(entry[key])) fail(file, `${at}: ${key} must be an https URL`);
    }
    if (entry.extraSources !== undefined) {
      if (!Array.isArray(entry.extraSources) || entry.extraSources.length > MAX_EXTRA_SOURCES) {
        fail(file, `${at}: extraSources must be a list of up to ${MAX_EXTRA_SOURCES} URLs`);
      }
      for (const url of entry.extraSources) {
        if (typeof url !== 'string' || !/^https:\/\//.test(url)) fail(file, `${at}: extraSources must be https URLs`);
      }
    }
    if ((entry.source ?? 'routine') === 'routine') {
      // Routine rolês are cross-checked: the main source plus at least one other site.
      if (!entry.sourceUrl) fail(file, `${at}: routine entries need a sourceUrl`);
      const domains = new Set([entry.sourceUrl, ...(entry.extraSources ?? [])].map(domainOf));
      if (domains.size < 2) {
        fail(file, `${at}: routine entries need sources from at least 2 different sites (sourceUrl + extraSources)`);
      }
    }
  });
}

function loadCatalogs() {
  return readdirSync(CATALOG_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const catalog = JSON.parse(readFileSync(join(CATALOG_DIR, name), 'utf8'));
      validate(name, catalog);
      return { name, catalog };
    });
}

function pickContent(entry) {
  const out = { kind: 'activity' };
  for (const key of CONTENT_FIELDS) {
    if (entry[key] !== undefined) out[key] = typeof entry[key] === 'string' ? entry[key].trim() : entry[key];
  }
  return out;
}

async function connect() {
  const { initializeApp, cert, applicationDefault } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  initializeApp({
    credential: raw ? cert(JSON.parse(raw)) : applicationDefault(),
    projectId: PROJECT_ID,
  });
  return getFirestore();
}

async function main() {
  const catalogs = loadCatalogs();
  const total = catalogs.reduce((n, c) => n + c.catalog.entries.length, 0);
  console.log(`Validated ${catalogs.length} catalog file(s), ${total} entries.`);
  if (dryRun) return;

  const db = await connect();
  const now = Date.now();
  let created = 0;
  let updated = 0;

  for (const { catalog } of catalogs) {
    for (const entry of catalog.entries) {
      const id = `${catalog.destinationKey}__${entry.slug}`;
      const ref = db.collection(COLLECTION).doc(id);
      const snap = await ref.get();
      const content = pickContent(entry);
      if (snap.exists) {
        await ref.set(
          { ...content, destinationKey: catalog.destinationKey, destinationName: catalog.destinationName, updatedAt: now },
          { merge: true }
        );
        updated += 1;
      } else {
        await ref.set({
          id,
          destinationKey: catalog.destinationKey,
          destinationName: catalog.destinationName,
          ...content,
          source: entry.source ?? 'routine',
          status: 'published',
          usageCount: 0,
          createdAt: now,
          updatedAt: now,
        });
        created += 1;
      }
    }
  }
  console.log(`Firestore ${COLLECTION}: ${created} created, ${updated} updated.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
