// Local browser contract tests. Every non-local HTTP request is intercepted;
// no fixture or message is ever written to a real Vegvisr service.
const { chromium } = require('playwright')
const { readFileSync } = require('node:fs')
const { createServer } = require('node:http')
const assert = require('node:assert/strict')
const { Script } = require('node:vm')

async function main() {
  const [originalPath, payloadPath] = process.argv.slice(2)
  const original = JSON.parse(readFileSync(originalPath, 'utf8'))
  const payload = JSON.parse(readFileSync(payloadPath, 'utf8'))
  const testId = 'nibi-members-page-chat-workspace-test'
  assert.deepEqual(payload.graphData.nodes.filter(n => n.id !== testId), original.nodes.filter(n => n.id !== testId))
  assert.deepEqual(payload.graphData.metadata, original.metadata)
  assert.deepEqual(payload.graphData.edges, original.edges)
  assert.equal(payload.override, false)
  const copy = payload.graphData.nodes.at(-1)
  assert.ok(!copy.info.includes('const chatComponent ='), 'No old renderer remains in test node')
  assert.ok(!copy.info.includes("if (group.kind !== 'direct')"))
  assert.deepEqual(copy.metadata.publishVersionPill, original.nodes.find(n => n.id === testId)?.metadata?.publishVersionPill)
  assert.ok(copy.metadata.publishGate['test.nibi.no'])
  assert.equal(copy.metadata.publishGate['minside.nibi.no'], undefined)
  for (const script of copy.info.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (script[1].trim()) new Script(script[1])
  }
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(copy.info)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  server.unref()
  const origin = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.WORKSPACE_CHROMIUM_PATH || undefined,
    args: process.env.WORKSPACE_CHROMIUM_ARGS ? JSON.parse(process.env.WORKSPACE_CHROMIUM_ARGS) : [],
  })
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    const failures = []
    const unexpected = []
    page.on('pageerror', error => failures.push(error.message))
    const id = 'b1e906b9-8fab-45a0-8cb9-df5c7624b030'
    const group = { id, name: 'NIBI FELLES', created_by: 'owner-fixture', role: 'member', created_at: 1, updated_at: 2 }
    let messages = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1, group_id: id, user_id: 'member-fixture', body: `Lokal kontrollmelding ${i + 1}`,
      message_type: 'text', created_at: 1700000000000 + i * 1000,
    }))
    let postCount = 0
    let pollCount = 0
    let denied = false
    let deniedDirect = false
    let privatePosts = 0
    const directMessages = [{ id: 101, group_id: 'dm_fixture', user_id: 'peer-fixture', body: 'Privat i ny pakke', message_type: 'text', created_at: 1700000000000 }]
    await context.addInitScript(() => {
      try { localStorage.setItem('vegvisr_user', JSON.stringify({ token: 'local-fixture-only', email: 'fixture@example.invalid' })) } catch { /* about:blank */ }
    })
    await context.route('**/*', async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin === origin) return route.continue()
      const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) })
      if (url.pathname === '/components/vegvisr-auth.js') return route.fulfill({ contentType: 'text/javascript', body: '' })
      if (url.pathname === '/userdata-from-token') return reply({ user_id: 'member-fixture', phone: '+4700000000', email: 'fixture@example.invalid', role: 'User' })
      if (url.pathname === '/world-chat-groups') {
        assert.equal(url.searchParams.get('domain'), 'nibi.no')
        assert.equal(request.headers()['x-api-token'], 'local-fixture-only')
        return reply({ success: true, groups: [group] })
      }
      if (url.pathname === '/direct/conversations') {
        assert.equal(request.headers().authorization, 'Bearer local-fixture-only')
        return reply({ success: true, groups: [{ id: 'dm_fixture', name: 'Privat kontroll', peer_id: 'peer-fixture', kind: 'direct', updated_at: 3 }] })
      }
      if (url.pathname === '/direct/dm_fixture/messages') {
        assert.equal(request.headers().authorization, 'Bearer local-fixture-only')
        if (deniedDirect) return reply({ success: false, error: 'Privat tilgang avslått' }, 403)
        if (request.method() === 'POST') {
          assert.deepEqual(request.postDataJSON(), { body: 'Privat sendt lokalt' })
          const message = { ...directMessages[0], id: 102, user_id: 'member-fixture', body: request.postDataJSON().body, created_at: 1700000001000 }
          directMessages.push(message); privatePosts++
          return reply({ success: true, message }, 201)
        }
        const after = Number(url.searchParams.get('after') || 0)
        assert.ok(after < 1000, 'Private polling must use message ID, not timestamp')
        return reply({ success: true, messages: directMessages.filter(m => !after || m.id > after), paging: { has_more: false, next_before: 101 } })
      }
      if (url.pathname.startsWith('/groups/dm_')) throw new Error('Private chat must never use group endpoints')
      if (url.pathname === '/groups') return denied ? reply({ success: false, error: 'Ingen tilgang' }, 403) : reply({ success: true, groups: [group] })
      if (url.pathname === `/groups/${id}/messages`) {
        if (request.method() === 'POST') {
          const data = request.postDataJSON()
          assert.equal(data.user_id, 'member-fixture')
          assert.equal(data.phone, '+4700000000')
          const message = { ...messages[0], id: 51, body: data.body, created_at: Date.now() }
          messages.push(message); postCount++
          return reply({ success: true, message })
        }
        pollCount++
        assert.equal(url.searchParams.get('user_id'), 'member-fixture')
        return reply({ success: true, messages, paging: { has_more: false, next_before: 1 } })
      }
      if (url.pathname.endsWith('/members')) return reply({ success: true, members: [{ user_id: 'member-fixture', phone: '+4700000000', role: 'member' }] })
      if (url.pathname === '/api/auth/profile') return reply({ success: true, display_name: 'Lokal kontrollbruker' })
      if (url.pathname.endsWith('/bots')) return reply({ success: true, bots: [] })
      if (url.pathname.includes('reactions')) return reply({ success: true, reactions: {} })
      if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return route.abort()
      unexpected.push(request.method() + ' ' + url.origin + url.pathname)
      return route.abort()
    })
    await page.goto(origin)
    await page.getByRole('button', { name: 'NIBI FELLES', exact: false }).click()
    let frame = page.frameLocator('#chatHost iframe')
    await frame.getByText('Lokal kontrollmelding 50', { exact: true }).waitFor()
    assert.equal(await frame.locator('.vegvisr-chat-workspace').count(), 1)
    const input = frame.getByPlaceholder('Type a message...')
    await input.fill('Sendt kun lokalt')
    await input.press('Enter')
    await frame.getByText('Sendt kun lokalt', { exact: true }).waitFor()
    assert.equal(postCount, 1)
    const scrolling = await frame.locator('[class*="overflow-y-auto"]').evaluateAll(elements => elements.some(e => e.scrollHeight > e.clientHeight && e.clientHeight > 0))
    assert.ok(scrolling, 'Conversation must have a bounded scrolling container')
    await page.getByRole('button', { name: 'Privat kontroll', exact: false }).click()
    frame = page.frameLocator('#chatHost iframe')
    await frame.getByText('Privat i ny pakke', { exact: true }).waitFor()
    assert.equal(await frame.locator('.vegvisr-chat-workspace').count(), 1)
    await frame.getByPlaceholder('Type a message...').fill('Privat sendt lokalt')
    await frame.getByPlaceholder('Type a message...').press('Enter')
    await frame.getByText('Privat sendt lokalt', { exact: true }).waitFor()
    assert.equal(privatePosts, 1)
    directMessages.push({ ...directMessages[0], id: 103, body: 'Nytt privat svar', created_at: 1700000002000 })
    const stoppedAt = pollCount
    await frame.getByText('Nytt privat svar', { exact: true }).waitFor({ timeout: 10000 })
    assert.equal(pollCount, stoppedAt, 'Group polling stops after unmount')
    await page.screenshot({ path: '/tmp/nibi-workspace-private.png', fullPage: true })
    deniedDirect = true
    await frame.getByRole('alert').filter({ hasText: 'Privat tilgang avslått' }).waitFor({ timeout: 10000 })
    assert.equal(await frame.getByText('Privat i ny pakke', { exact: true }).count(), 0)
    assert.ok(await frame.locator('textarea').isDisabled())
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Til samtalene', exact: true }).click()
    await page.getByRole('button', { name: 'NIBI FELLES', exact: false }).click()
    frame = page.frameLocator('#chatHost iframe')
    await frame.getByText('Sendt kun lokalt', { exact: true }).waitFor()
    assert.ok(await frame.locator('body').evaluate(e => e.scrollWidth <= innerWidth + 2), 'Mobile must not overflow horizontally')
    await page.screenshot({ path: '/tmp/nibi-workspace-mobile.png', fullPage: true })
    denied = true
    await page.getByRole('button', { name: 'Til samtalene', exact: true }).click()
    await page.getByRole('button', { name: 'NIBI FELLES', exact: false }).click()
    await page.frameLocator('#chatHost iframe').getByRole('alert').filter({ hasText: 'Ingen tilgang' }).waitFor()
    assert.equal(await page.frameLocator('#chatHost iframe').locator('textarea').count(), 0)
    await page.evaluate(() => { localStorage.removeItem('vegvisr_user'); window.dispatchEvent(new Event('vegvisr-auth-changed')) })
    await page.locator('#login').waitFor({ state: 'visible' })
    assert.equal(await page.locator('#chatHost iframe').count(), 0)
    assert.deepEqual(failures, [])
    assert.deepEqual(unexpected, [])
    console.log('PASS: original unchanged, syntax, auth bridge, NIBI config, both chat types in React, private send/incoming/ID cursor, no legacy fallback, revoked private access clears messages, cleanup, mobile, denied access, logout; no live service writes.')
  } finally {
    await browser.close()
    server.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
