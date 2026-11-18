import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { cp, readFile, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { SignJWT } from 'jose'

test('two server instances preserve shared vault revisions, legacy entries, quotas and subscription ordering', { timeout: 120_000 }, async (t) => {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const dir = await mkdtemp(join(tmpdir(), 'open-authenticator-test-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  for (const name of ['app', 'middleware', 'plugins', 'routes', 'tasks', 'utils', 'error.ts', 'nitro.config.ts', 'backend.config.ts', 'package.json', 'tsconfig.json']) {
    await cp(join(root, name), join(dir, name), { recursive: true })
  }
  await symlink(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir')
  const env = {
    PATH: process.env.PATH,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    URL: 'http://localhost',
    ADMIN_HEADER: 'fixture-admin',
    REVENUECAT_AUTHORIZATION_HEADER: 'fixture-hook',
    JWT_ACCESS_SECRET: 'integration-test-session-signing-secret',
    JWT_REFRESH_SECRET: 'fixture-refresh',
    JWT_REFRESH_PEPPER: 'fixture-pepper',
    GOOGLE_CLIENT_ID: 'fixture',
    GOOGLE_CLIENT_SECRET: 'fixture',
    GITHUB_CLIENT_ID: 'fixture',
    GITHUB_CLIENT_SECRET: 'fixture',
    APPLE_CLIENT_ID: 'fixture',
    APPLE_KEY_ID: 'fixture',
    APPLE_TEAM_ID: 'fixture',
    APPLE_PEM_CERTIFICATE: 'fixture',
    MICROSOFT_CLIENT_ID: 'fixture',
    MICROSOFT_CLIENT_SECRET: 'fixture',
    MICROSOFT_TENANT_ID: 'fixture',
  }
  await promisify(execFile)(join(dir, 'node_modules/.bin/nitro'), ['build'], { cwd: dir, env })
  const servers = []
  for (let i = 0; i < 2; i++) {
    const socket = createServer().listen(0, '127.0.0.1')
    await once(socket, 'listening')
    const { port } = socket.address() as AddressInfo
    await new Promise<void>(resolve => socket.close(() => resolve()))
    const child = spawn(process.execPath, ['.output/server/index.mjs'], { cwd: dir, env: { ...env, PORT: String(port) }, stdio: 'pipe' })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.stdout.resume()
    const closed = once(child, 'close')
    t.after(async () => {
      child.kill()
      await closed
    })
    const url = 'http://127.0.0.1:' + port
    for (let attempt = 0; ; attempt++) {
      try {
        if ((await fetch(url)).ok) break
      }
      catch { /* The listener is still starting. */ }
      if (child.exitCode !== null || attempt >= 100) assert.fail('Startup failed: ' + stderr)
      await delay(50)
    }
    servers.push(url)
  }
  const [server, other] = servers as [string, string]
  const token = await new SignJWT({ sid: 'fixture', aci: 'client', typ: 'access' }).setSubject('owner')
    .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('10m').sign(new TextEncoder().encode(env.JWT_ACCESS_SECRET))
  async function post(base: string, path: string, body: unknown, authorization = 'Bearer ' + token) {
    const response = await fetch(base + path, { method: 'POST', headers: {
      'App-Version': '2.1.0',
      'App-Client-Id': 'client',
      'Content-Type': 'application/json',
      'Authorization': authorization,
    }, body: JSON.stringify(body) })
    const json = await response.json()
    assert.equal(response.status, 200, JSON.stringify(json))
    assert.equal(json.success, true, JSON.stringify(json))
    return json.data
  }
  await post(server, '/admin/init', {}, env.ADMIN_HEADER)
  const db = new DatabaseSync(join(dir, '.data/db.sqlite'))
  t.after(() => db.close())
  // An installation initialized by the previous release upgrades on its first real request.
  db.exec('DROP TRIGGER applyRevenueCatPlan; DROP TRIGGER deleteTotpBucketHead; DROP TABLE totpBucketHeads')
  db.prepare('INSERT INTO users (id) VALUES (?)').run('owner')
  const legacy = crypto.randomUUID()
  const record = { updatedAt: 0, secret: [1], encryptionSalt: [2] }
  const legacyRecord = { ...record, digits: 0, validity: 0 }
  for (const owner of ['owner', 'neighbor']) {
    const path = join(dir, '.data/totps', owner, 'totps')
    await mkdir(path, { recursive: true })
    await writeFile(join(path, legacy), JSON.stringify(legacyRecord))
  }
  const pull = () => post(other, '/totps/sync/pull', { active: {}, deleted: {} })
  assert.deepEqual((await pull()).inserts[legacy], record)
  const push = (host: string, kind: string, payload: object) =>
    post(host, '/totps/sync/push', [{ uuid: crypto.randomUUID(), kind, payload }])
  const ids = Array.from({ length: 6 }, () => crypto.randomUUID())
  const results = (await Promise.all(ids.map((id, i) => push(i % 2 ? server : other, 'set', { [id]: record })))).flat()
  assert.equal(results.filter(result => result.errorCode === 'tooManyTotps').length, 1)
  assert.equal(results.filter(result => result.errorCode === null).length, 5)
  assert.equal(Object.keys((await pull()).inserts).length, 6)
  assert.deepEqual(await readFile(join(dir, '.data/totps/neighbor/totps', legacy), 'utf8'), JSON.stringify(legacyRecord))

  await Promise.all([push(server, 'set', { [legacy]: { ...record, updatedAt: 10 } }), push(other, 'delete', { [legacy]: 11 })])
  const afterDelete = await pull()
  assert.equal(afterDelete.deletes[legacy], 11)
  assert.equal(afterDelete.inserts[legacy], undefined)
  const replacement = Object.fromEntries(ids.map(id => [id, { ...record, updatedAt: 20 }]))
  await post(server, '/totps', replacement)
  assert.deepEqual((await pull()).inserts, replacement)

  const edited = ids[0]!
  const conflicting = { ...record, secret: [8], updatedAt: 20 }
  await push(server, 'set', { [edited]: conflicting })
  const reconciliation = await post(other, '/totps/sync/pull', { active: { [edited]: 20 }, deleted: {} })
  assert.deepEqual(reconciliation.updates[edited], { ...conflicting, updatedAt: 21 })
  replacement[edited] = reconciliation.updates[edited]

  const webhook = (type: string, event_timestamp_ms: number) => post(server, '/webhooks/revenuecat', {
    event: { type, id: String(event_timestamp_ms), event_timestamp_ms, app_user_id: 'owner', entitlement_ids: ['contributor_plan'] },
  }, env.REVENUECAT_AUTHORIZATION_HEADER)
  const plan = () => db.prepare('SELECT contributorPlan FROM users WHERE id = ?').get('owner')?.contributorPlan
  await webhook('RENEWAL', 20)
  await webhook('EXPIRATION', 10)
  assert.equal(plan(), 1)
  await webhook('EXPIRATION', 30)
  await webhook('RENEWAL', 20)
  assert.equal(plan(), 0)
  await post(other, '/admin/prune/revenuecat', { days: 0 }, env.ADMIN_HEADER)
  await webhook('RENEWAL', 5)
  assert.equal(plan(), 0)
  await post(server, '/admin/prune/accounts', { days: 0 }, env.ADMIN_HEADER)
  assert.deepEqual((await pull()).inserts, replacement)
})
