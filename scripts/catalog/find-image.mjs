// Finds a freely licensed photo of a place on Wikipedia / Wikimedia Commons.
//
//   node find-image.mjs "Escadaria Selarón" ["Pedra do Sal" ...]
//
// Pass the exact pt.wikipedia article title of the place (no fuzzy search: a search
// hit is often a different place). For each prints JSON with imageUrl (1024px
// thumbnail on *.wikimedia.org), imageCredit ("Author · License") and imageSourceUrl (the Commons file page), or
// {"name": ..., "found": false}. Only images Wikipedia marks as free are used; the
// author/license come from Commons so the app can show the required credit.

const UA = 'TripLedger-catalog/1.0 (https://github.com/rafaelsiq/tripledger)';
const WIKI = 'https://pt.wikipedia.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';

async function api(base, params) {
  const url = `${base}?${new URLSearchParams({ format: 'json', ...params })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const WIKIMEDIA_IMAGE = /^https:\/\/(upload|thumb)\.wikimedia\.org\//;

/** The free lead image of the pt.wikipedia article titled `name`. */
async function pageImage(name) {
  const direct = await api(WIKI, {
    action: 'query',
    prop: 'pageimages',
    piprop: 'name',
    pilicense: 'free',
    redirects: '1',
    titles: name,
  });
  const page = Object.values(direct.query?.pages ?? {})[0];
  return page?.pageimage ? { file: page.pageimage, article: page.title } : null;
}

async function describe(name) {
  const found = await pageImage(name);
  if (!found) return { name, found: false };
  const info = await api(COMMONS, {
    action: 'query',
    titles: `File:${found.file}`,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '1024',
  });
  const image = Object.values(info.query?.pages ?? {})[0]?.imageinfo?.[0];
  // Not on Commons (e.g. a local-only upload): skip, the license can't be checked.
  if (!image?.thumburl || !WIKIMEDIA_IMAGE.test(image.thumburl)) {
    return { name, found: false, article: found.article };
  }
  const meta = image.extmetadata ?? {};
  const author = stripHtml(meta.Artist?.value) || 'Autor desconhecido';
  const license = stripHtml(meta.LicenseShortName?.value) || 'licença livre';
  return {
    name,
    found: true,
    article: found.article,
    imageUrl: image.thumburl.split('?')[0],
    imageCredit: `${author} · ${license}`,
    imageSourceUrl: image.descriptionurl,
  };
}

const names = process.argv.slice(2);
if (!names.length) {
  console.error('Usage: node find-image.mjs "<place name>" [...]');
  process.exit(1);
}
for (const name of names) {
  try {
    console.log(JSON.stringify(await describe(name)));
  } catch (error) {
    console.log(JSON.stringify({ name, found: false, error: error.message }));
  }
}
