import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const characterSourceIds = Object.freeze(JSON.parse(await readFile(new URL('./favorite-character-sources.json', import.meta.url), 'utf8')));

// These are UI identity/length adjustments, not fallback metadata from the old table.
// The two instrument descriptions follow the source introductions, not its swapped summaries.
const adjustments = {
  '065': { name: '云居一轮' },
  '079': { title: '秘封俱乐部的相对性精神学学生' },
  '080': { title: '秘封俱乐部的超统一物理学学生' },
  '123': { title: '秘封俱乐部初代会长' },
  '127': { title: '古琵琶的付丧神' },
  '128': { title: '古琴的付丧神' },
  '206': { name: '封套子', title: '《蓬莱人形》封面角色' },
  '207': { name: '碟面子', title: '《蓬莱人形》C62 碟面角色' },
};

const supplements = {
  '112': { name: '云山', title: '守护一轮的入道', related: '云居一轮', field: 'introduction', evidence: '入道云山' },
  '120': { name: '爱丽丝的人偶', title: '爱丽丝操纵的人偶', related: '爱丽丝·玛格特洛依德', field: 'abilities', evidence: '人偶' },
  '139': { name: '易者', title: '占卜师' },
};

// Keep familiar spellings searchable after standardizing display names.
const legacyNames = {
  '015': ['莉莉白'],
  '027': ['因幡帝'],
  '032': ['铃仙 II 号'],
  '039': ['四季映姬·亚玛萨那度'],
  '040': ['桑妮·米尔克'],
  '041': ['斯塔·萨菲雅'],
  '042': ['露娜·切尔德'],
  '087': ['幽玄魔眼'],
  '119': ['朱鹭子'],
  '143': ['爱塔妮缇·拉尔瓦'],
  '144': ['坂田合欢乃'],
};

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing ' + label + '.');
  return value.trim().replace(/\s+/g, ' ');
}

function aliasesFor(name, values) {
  const seen = new Set([name.toLocaleLowerCase()]);
  return values.flatMap(value => {
    const alias = text(value, 'alias');
    const key = alias.toLocaleLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [alias];
  });
}

/** Rebuild only display metadata. Never infer appearances from a first-appearance field. */
export function buildCharacters(current, archive, aliasTable) {
  if (!Array.isArray(archive?.characters) || !aliasTable || typeof aliasTable !== 'object') {
    throw new Error('Expected a character archive and alias table.');
  }
  const ids = current.map(character => character.id);
  if (new Set(ids).size !== ids.length || ids.length !== Object.keys(characterSourceIds).length
    || ids.some(id => !Object.hasOwn(characterSourceIds, id))) {
    throw new Error('Stable character IDs do not match the source map; review the mapping explicitly.');
  }
  const byId = new Map();
  for (const entry of archive.characters) {
    const id = text(entry.id, 'source ID');
    if (byId.has(id)) throw new Error('Duplicate source character: ' + id);
    byId.set(id, entry);
  }
  return current.map(character => {
    const sourceId = characterSourceIds[character.id];
    const source = byId.get(sourceId);
    const supplement = supplements[character.id];
    const sourceAliases = aliasTable[sourceId];
    if (!Array.isArray(sourceAliases) || !sourceAliases.length) throw new Error('Missing aliases for ' + sourceId);
    if (!source && !supplement) throw new Error('Missing source character: ' + sourceId);
    if (supplement?.related && !byId.get(supplement.related)?.[supplement.field]?.includes(supplement.evidence)) {
      throw new Error('Missing related evidence for ' + sourceId);
    }
    const display = supplement || source;
    const override = adjustments[character.id] || {};
    const name = text(override.name || display.name, sourceId + ' name');
    const title = text(override.title || (supplement ? supplement.title : source.short_description), sourceId + ' description');
    if ([...title].length > 24) throw new Error('Review overlong description for ' + sourceId);
    const aliases = aliasesFor(name, [
      sourceId,
      // The archive combines Ichirin/Unzan, but this sorter has separate entries.
      ...(source && character.id !== '065' ? [source.name] : []),
      ...(source?.alias || []),
      ...sourceAliases,
      ...(legacyNames[character.id] || []),
    ]);
    return { id: character.id, name, title, aliases, games: [...character.games], image: character.image };
  });
}

export function renderCatalog(catalog) {
  return 'export const CATALOG_VERSION = ' + catalog.CATALOG_VERSION + ';\n\n'
    + ['workGroups', 'games', 'characters'].map(key => 'export const ' + key + ' = '
      + JSON.stringify(catalog[key], null, 2) + ';\n').join('\n');
}

async function main() {
  const { values } = parseArgs({ options: { 'bot-root': { type: 'string' }, check: { type: 'boolean', default: false } } });
  if (!values['bot-root']) throw new Error('Usage: node tools/import-favorite-characters.mjs --bot-root <YuukaBot directory> [--check]');
  const inputRoot = path.resolve(values['bot-root']);
  const archivePath = path.join(inputRoot, 'data/text/thbwiki/characters_bot.json');
  const aliasesPath = path.join(inputRoot, 'data/text/touhou/altname.json');
  const [archiveText, aliasesText] = await Promise.all([readFile(archivePath, 'utf8'), readFile(aliasesPath, 'utf8')]);
  const archive = JSON.parse(archiveText);
  const aliasTable = JSON.parse(aliasesText);
  const target = new URL('../src/favorite/characters.js', import.meta.url);
  const catalog = await import(target.href);
  const characters = buildCharacters(catalog.characters, archive, aliasTable);
  const output = renderCatalog({ ...catalog, characters });
  if (values.check) {
    if (output !== (await readFile(target, 'utf8')).replace(/\r\n/g, '\n')) throw new Error('Character metadata differs; regenerate and review the diff.');
  } else {
    await writeFile(target, output, 'utf8');
  }
  const hash = value => createHash('sha256').update(value).digest('hex');
  console.log(JSON.stringify({
    mode: values.check ? 'checked' : 'updated',
    characters: characters.length,
    archiveSnapshot: archive.generated_at,
    archiveSha256: hash(archiveText),
    aliasesSha256: hash(aliasesText),
    namesChanged: characters.filter((row, i) => row.name !== catalog.characters[i].name).length,
    descriptionsChanged: characters.filter((row, i) => row.title !== catalog.characters[i].title).length,
  }, null, 2));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
