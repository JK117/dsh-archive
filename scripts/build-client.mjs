/**
 * Bundles `src/client/*.js` into the single lazy-CJS artifact DSH serves.
 *
 * The browser module loader requires one self-contained `client.js` per
 * package; it cannot synchronously load sibling files. Rather than adding a
 * dependency-heavy toolchain, this script wraps each source module in a small
 * CommonJS factory and emits the same `window.__ModuleLoader__.load` envelope
 * the plugin used before. Module bodies still run lazily, at materialization.
 *
 * Usage:
 *   node scripts/build-client.mjs          # write client.js
 *   node scripts/build-client.mjs --check  # fail when client.js is stale
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SOURCE_DIR = path.join(ROOT, 'src', 'client')
const OUTPUT = path.join(ROOT, 'client.js')
const ENTRY = './index.js'

const PACKAGE_ID = 'dsh-archive'

function moduleId(fileName) {
  return `./${fileName}`
}

/** Finds static sibling requires, only to warn about an unreferenced module. */
function localDependencies(source) {
  const dependencies = []
  const pattern = /require\(\s*['"](\.\/[^'"]+)['"]\s*\)/g
  let match
  while ((match = pattern.exec(source)) !== null) dependencies.push(match[1])
  return dependencies
}

function reachableModules(sources) {
  const reachable = new Set()
  const queue = [ENTRY]
  while (queue.length > 0) {
    const id = queue.shift()
    if (reachable.has(id) || !sources.has(id)) continue
    reachable.add(id)
    queue.push(...localDependencies(sources.get(id)))
  }
  return reachable
}

function buildBundle(sources) {
  const entries = [...sources.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, source]) => {
      return `${JSON.stringify(id)}: function (module, exports, require) {\n${source.trimEnd()}\n      },`
    })
    .join('\n')

  return `/**
 * Archive (资料库) — browser bundle.
 *
 * GENERATED FILE. Edit the modules under \`src/client/\` and run
 * \`npm run build:client\`. DSH serves exactly one self-contained lazy-CJS
 * bundle per plugin, so the source modules are wrapped into this file.
 */
window.__ModuleLoader__.load({
  id: '${PACKAGE_ID}',
  factory(require) {
    var __modules = {
${entries}
    }

    var __cache = Object.create(null)

    /** Resolves a sibling request against the requesting module's directory. */
    function __resolve(from, spec) {
      if (spec.slice(0, 2) !== './') {
        throw new Error('dsh-archive: unsupported local require "' + spec + '"')
      }
      var base = from.slice(0, from.lastIndexOf('/') + 1)
      var parts = (base + spec.slice(2)).split('/')
      var resolved = []
      for (var index = 0; index < parts.length; index += 1) {
        var part = parts[index]
        if (part === '' || part === '.') continue
        if (part === '..') resolved.pop()
        else resolved.push(part)
      }
      return './' + resolved.join('/')
    }

    /** Materializes one local module exactly once, like the real loader. */
    function __load(id) {
      if (__cache[id] !== undefined) return __cache[id].exports
      var definition = __modules[id]
      if (definition === undefined) {
        throw new Error('dsh-archive: missing bundled module "' + id + '"')
      }
      var record = { exports: {} }
      __cache[id] = record
      var localRequire = function (spec) {
        if (spec.charAt(0) !== '.') return require(spec)
        return __load(__resolve(id, spec))
      }
      definition(record, record.exports, localRequire)
      if (
        record.exports !== null &&
        (typeof record.exports === 'object' || typeof record.exports === 'function')
      ) {
        Object.defineProperty(record.exports, Symbol.toStringTag, {
          value: 'Module',
          configurable: true,
        })
      }
      return record.exports
    }

    return __load('${ENTRY}')
  },
})
`
}

const files = (await readdir(SOURCE_DIR, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
  .map((entry) => entry.name)
  .sort()

if (files.length === 0) {
  console.error('build-client: no source modules found in', SOURCE_DIR)
  process.exit(1)
}

const sources = new Map()
for (const file of files) {
  sources.set(moduleId(file), await readFile(path.join(SOURCE_DIR, file), 'utf8'))
}

const reachable = reachableModules(sources)
for (const id of sources.keys()) {
  if (!reachable.has(id)) console.warn(`build-client: warning: ${id} is not reachable from ${ENTRY}`)
}

const bundle = buildBundle(sources)
const check = process.argv.includes('--check')

if (check) {
  let current = ''
  try {
    current = await readFile(OUTPUT, 'utf8')
  } catch {
    console.error('build-client: client.js is missing; run npm run build:client')
    process.exit(1)
  }
  if (current !== bundle) {
    console.error('build-client: client.js is stale; run npm run build:client')
    process.exit(1)
  }
  console.log(`build-client: client.js is up to date (${files.length} modules)`)
} else {
  await writeFile(OUTPUT, bundle)
  console.log(`build-client: wrote client.js (${files.length} modules, ${Buffer.byteLength(bundle)} bytes)`)
}
