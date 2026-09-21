// Parity browser test: the prepared NIBI test node in Chromium, with every group-chat-worker
// request answered by the REAL worker code (group-chat-worker/index.js + direct-chat.js) running
// in-process on SQLite and an in-memory R2 bucket. Nothing is sent to live Vegvisr services.
//
// It drives the same tools in a group and a private conversation: text, reply, image, PDF,
// voice (fake microphone) with transcription, dictation, reactions, polls, delete, forwarding,
// visible failures, revocation and the mobile layout.
//
//   node scripts/test-nibi-parity.mjs prepared-payload.json [path/to/group-chat-worker]
//
// Needs `playwright` (or playwright-core) resolvable and a Chromium (WORKSPACE_CHROMIUM_PATH).
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const [payloadPath, workerDir = '/Volumes/T7/vegvisr-frontend/group-chat-worker'] = process.argv.slice(2)
const shots = process.env.PARITY_SCREENSHOTS || '/tmp/nibi-parity'
mkdirSync(shots, { recursive: true })

const { fixture } = await import(pathToFileURL(`${workerDir}/test-direct-chat.mjs`).href)
const { chat, call, fetch: workerFetch, media } = fixture()
const NIBI = 'b1e906b9-8fab-45a0-8cb9-df5c7624b030'
const CHAT_ORIGIN = 'https://group-chat-worker.torarnehave.workers.dev'
chat.db.exec(`INSERT INTO groups(id,name,created_by,created_at,updated_at) VALUES ('${NIBI}','NIBI FELLES','inger',1,2);
  INSERT INTO group_members(group_id,user_id,role,joined_at) VALUES ('${NIBI}','tor','member',1),('${NIBI}','inger','member',1);
  UPDATE groups SET name='Testfellesskap' WHERE id='nibi';`)
const dm = (await (await call('inger', 'POST', '/direct/conversations', { source_group_id: NIBI, peer_id: 'tor' })).json()).group.id
await call('inger', 'POST', `/direct/${dm}/messages`, { body: 'Hei Tor, dette er privat' })
const rows = sql => chat.db.prepare(sql).all()

const payload = JSON.parse(readFileSync(payloadPath, 'utf8'))
const node = payload.graphData.nodes.find(n => n.id === 'nibi-members-page-chat-workspace-test')
const server = createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(node.info) })
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`

// 1x1 PNG, so a rendered <img> has natural size only if the bytes really arrived.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const voiceStore = new Map()
const voiceUploads = []
const seen = []
const unexpected = []
let failNextPrivateUpload = false

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.WORKSPACE_CHROMIUM_PATH || undefined,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
})
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['microphone'] })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await context.addInitScript(() => {
    try { localStorage.setItem('vegvisr_user', JSON.stringify({ token: 'token-tor', email: 'tor@test.invalid' })) } catch { /* about:blank */ }
  })
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === origin || url.protocol === 'data:' || url.protocol === 'blob:') return route.continue()
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) })
    if (url.origin === CHAT_ORIGIN) {
      seen.push(`${request.method()} ${url.pathname}${url.search}`)
      if (url.pathname === '/world-chat-groups') return json({ success: true, groups: [{ id: NIBI, name: 'NIBI FELLES', created_by: 'inger', created_at: 1, updated_at: 2 }] })
      if (failNextPrivateUpload && request.method() === 'POST' && url.pathname === `/direct/${dm}/media`) {
        failNextPrivateUpload = false
        return json({ success: false, error: 'Lagringen er midlertidig utilgjengelig' }, 503)
      }
      const headers = await request.allHeaders()
      const body = ['GET', 'HEAD'].includes(request.method()) ? undefined : request.postDataBuffer() || undefined
      if (body) headers['content-length'] = String(body.byteLength)
      delete headers.host
      const response = await workerFetch(new Request(url, { method: request.method(), headers, body }))
      return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) })
    }
    if (url.hostname === 'voice.vegvisr.org') {
      if (url.pathname === '/upload') {
        const chatId = request.headers()['x-chat-id']
        voiceUploads.push(chatId)
        const key = `voice/${chatId}/${voiceUploads.length}.webm`
        voiceStore.set(key, request.postDataBuffer())
        return json({ success: true, objectKey: key, audioUrl: `https://voice.vegvisr.org/audio?key=${encodeURIComponent(key)}` })
      }
      if (url.pathname === '/audio') return route.fulfill({ status: 200, contentType: 'audio/webm', headers: { 'Access-Control-Allow-Origin': '*' }, body: voiceStore.get(url.searchParams.get('key')) || Buffer.alloc(0) })
      if (url.pathname === '/transcribe') return json({ success: true, text: 'Hei fra gruppe-talemelding', language: 'no' })
    }
    if (url.pathname === '/userdata-from-token') return json({ user_id: 'tor', phone: '+4700000000', email: 'tor@test.invalid', role: 'User' })
    if (url.pathname === '/components/vegvisr-auth.js') return route.fulfill({ contentType: 'text/javascript', body: '' })
    if (url.pathname === '/api/auth/profile') return json({ success: true, display_name: url.searchParams.get('user_id') === 'tor' ? 'Tor Arne Have' : 'Inger Hildrum' })
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return route.abort()
    unexpected.push(`${request.method()} ${url.origin}${url.pathname}`)
    return route.abort()
  })

  await page.goto(origin)
  const open = async name => {
    await page.getByRole('button', { name, exact: false }).first().click()
    return page.frameLocator('#chatHost iframe')
  }
  const composer = frame => frame.getByPlaceholder(/Type a message|Type @ to mention/)
  const sendText = async (frame, text) => {
    await composer(frame).fill(text)
    await composer(frame).press('Enter')
    await frame.getByText(text, { exact: true }).waitFor()
  }
  // A message bubble by its stored body (quotes in replies would match a text filter too).
  const idOf = body => chat.db.prepare('SELECT id FROM group_messages WHERE body = ? ORDER BY id LIMIT 1').get(body).id
  const bubble = (frame, body) => frame.locator(`#msg-${idOf(body)}`)
  const attach = async (frame, file) => {
    await frame.locator('input[type=file]').setInputFiles(file)
    await frame.getByText(file.name, { exact: true }).waitFor()
    await frame.locator('div.max-w-5xl').filter({ hasText: file.name }).getByRole('button', { name: 'Send', exact: true }).click()
  }
  const recordVoice = async (frame, subject) => {
    await frame.getByTitle('Record voice message').click()
    await page.waitForTimeout(1500)
    await frame.getByTitle('Stop recording').click()
    if (subject) {
      await frame.getByRole('button', { name: 'Send as voice' }).click()
      await frame.getByPlaceholder('Subject (required)').fill(subject)
      await frame.getByTitle('Send voice message').click()
    } else {
      await frame.getByRole('button', { name: 'Post as text' }).click()
    }
  }
  const imageLoaded = locator => locator.evaluate(img => img.complete && img.naturalWidth > 0)
  const createPoll = async (frame, question) => {
    await frame.getByTitle('Create a poll').click()
    await frame.getByPlaceholder('Ask a question...').fill(question)
    await frame.getByPlaceholder('Yes').fill('Ja')
    await frame.getByPlaceholder('No').fill('Nei')
    await frame.getByRole('button', { name: 'Create Poll' }).click()
  }

  // ── Group conversation (baseline behaviour through the shared transport) ──
  let frame = await open('NIBI FELLES')
  await composer(frame).waitFor()
  await sendText(frame, 'Gruppe hei')
  await attach(frame, { name: 'gruppe.png', mimeType: 'image/png', buffer: PNG })
  const groupImage = frame.locator(`img[src^="${CHAT_ORIGIN}/media?key=media%2F${NIBI}"]`).first()
  await groupImage.waitFor()
  await page.waitForTimeout(300)
  assert.ok(await imageLoaded(groupImage), 'group image renders')
  await recordVoice(frame, 'Gruppetale')
  await frame.getByText('Hei fra gruppe-talemelding').waitFor()
  assert.ok(voiceUploads.includes(NIBI), 'group voice goes to voice-worker')
  await createPoll(frame, 'Gruppemøte?')
  await frame.getByText('Gruppemøte?').first().waitFor({ timeout: 10000 })
  await bubble(frame, 'Gruppe hei').hover()
  await bubble(frame, 'Gruppe hei').getByTitle('heart').click()
  await page.waitForTimeout(300)
  assert.equal(rows(`SELECT COUNT(*) AS n FROM message_reactions WHERE message_id=${idOf('Gruppe hei')} AND user_id='tor' AND reaction='heart'`)[0].n, 1, 'group reaction stored on that message')
  // Forward a group message into the private conversation (participant-checked route).
  await bubble(frame, 'Gruppe hei').hover()
  await bubble(frame, 'Gruppe hei').getByLabel('Forward message').click()
  await frame.getByText('Inger Hildrum (privat)').click()
  await frame.getByRole('button', { name: 'Forward', exact: true }).click()
  await page.waitForTimeout(500)
  assert.ok(seen.some(line => line.startsWith('POST /direct/forward')), 'group→private forward used /direct/forward')
  await page.screenshot({ path: `${shots}/group.png`, fullPage: true })

  // ── Private conversation: the same tools ──
  frame = await open('Inger Hildrum')
  await frame.getByText('Hei Tor, dette er privat').waitFor()
  await frame.getByText('Forwarded from Tor Arne Have').waitFor()
  await sendText(frame, 'Privat hei')
  // Reply
  await bubble(frame, 'Hei Tor, dette er privat').hover()
  await bubble(frame, 'Hei Tor, dette er privat').getByTitle('Reply').click()
  await sendText(frame, 'Svar på privat')
  assert.equal(rows(`SELECT reply_to_id FROM group_messages WHERE body='Svar på privat'`)[0].reply_to_id, rows(`SELECT id FROM group_messages WHERE body='Hei Tor, dette er privat'`)[0].id)
  // Image through a signed participant link
  await attach(frame, { name: 'privat.png', mimeType: 'image/png', buffer: PNG })
  const privateImage = frame.locator(`img[src^="${CHAT_ORIGIN}/direct/media?key=media%2F${dm}"]`).first()
  await privateImage.waitFor()
  await page.waitForTimeout(300)
  assert.ok(await imageLoaded(privateImage), 'private image renders through the signed link')
  // PDF
  await attach(frame, { name: 'avtale.pdf', mimeType: 'application/pdf', buffer: PDF })
  const pdfLink = frame.locator(`a[href^="${CHAT_ORIGIN}/direct/media?key=media%2F${dm}"]`).first()
  await pdfLink.waitFor()
  assert.equal((await (await workerFetch(new Request(await pdfLink.getAttribute('href')))).text()).slice(0, 8), '%PDF-1.4')
  // Voice with server transcription
  await recordVoice(frame, 'Privat tale')
  await frame.getByText('Hei fra talemeldingen').first().waitFor()
  const privateAudio = frame.locator(`audio[src^="${CHAT_ORIGIN}/direct/media?key=media%2F${dm}"]`).first()
  await privateAudio.waitFor({ state: 'attached' })
  const audioResponse = await workerFetch(new Request(await privateAudio.getAttribute('src')))
  assert.equal(audioResponse.status, 200)
  assert.ok((await audioResponse.arrayBuffer()).byteLength > 100, 'recorded audio bytes stored privately')
  assert.ok(!voiceUploads.some(chatId => chatId.startsWith('dm_')), 'private voice never goes to the public voice-worker')
  // Dictation: record → post as text
  const before = rows(`SELECT COUNT(*) AS n FROM group_messages WHERE group_id='${dm}' AND message_type='text' AND body='Hei fra talemeldingen'`)[0].n
  await recordVoice(frame, null)
  await frame.locator('text=Hei fra talemeldingen').nth(1).waitFor()
  assert.equal(rows(`SELECT COUNT(*) AS n FROM group_messages WHERE group_id='${dm}' AND message_type='text' AND body='Hei fra talemeldingen'`)[0].n, before + 1, 'dictation posted as text')
  // Reaction
  await bubble(frame, 'Hei Tor, dette er privat').hover()
  await bubble(frame, 'Hei Tor, dette er privat').getByTitle('heart').click()
  await page.waitForTimeout(300)
  assert.equal(rows(`SELECT COUNT(*) AS n FROM message_reactions WHERE message_id=${idOf('Hei Tor, dette er privat')} AND user_id='tor' AND reaction='heart'`)[0].n, 1, 'private reaction stored on that message')
  // Poll: create, render, vote
  await createPoll(frame, 'Kaffe fredag?')
  await frame.getByText('Kaffe fredag?').first().waitFor()
  await frame.getByRole('button', { name: 'Ja', exact: true }).click()
  await page.waitForTimeout(300)
  assert.equal(rows(`SELECT COUNT(*) AS n FROM poll_votes v JOIN polls p ON p.id=v.poll_id WHERE p.group_id='${dm}' AND v.user_id='tor'`)[0].n, 1, 'private poll vote stored')
  // Delete own message
  const deleted = bubble(frame, 'Privat hei')
  await deleted.hover()
  await deleted.getByLabel('Delete message').click()
  await frame.getByText('Privat hei', { exact: true }).waitFor({ state: 'detached' })
  assert.equal(rows(`SELECT COUNT(*) AS n FROM group_messages WHERE body='Privat hei'`)[0].n, 0)
  // The other person's message offers no delete in a private conversation
  await bubble(frame, 'Hei Tor, dette er privat').hover()
  assert.equal(await bubble(frame, 'Hei Tor, dette er privat').getByLabel(/Delete message/).count(), 0)
  // Forward the private image into the group: bytes are copied, the source stays private
  await frame.locator('div.group').filter({ has: privateImage }).last().hover()
  await frame.locator('div.group').filter({ has: privateImage }).last().getByLabel('Forward message').click()
  await frame.getByText('NIBI FELLES', { exact: true }).last().click()
  await frame.getByRole('button', { name: 'Forward', exact: true }).click()
  await page.waitForTimeout(500)
  const copied = rows(`SELECT media_object_key, media_url FROM group_messages WHERE group_id='${NIBI}' AND forwarded_from_message_id IS NOT NULL`)
  assert.equal(copied.length, 1)
  assert.match(copied[0].media_object_key, new RegExp(`^media/${NIBI}/`))
  assert.ok(media.objects.has(copied[0].media_object_key))
  // A failed upload is shown and the staged file is kept for another try
  failNextPrivateUpload = true
  await frame.locator('input[type=file]').setInputFiles({ name: 'feil.png', mimeType: 'image/png', buffer: PNG })
  await frame.locator('div.max-w-5xl').filter({ hasText: 'feil.png' }).getByRole('button', { name: 'Send', exact: true }).click()
  await frame.getByRole('alert').filter({ hasText: 'Attachment failed: Lagringen er midlertidig utilgjengelig' }).waitFor()
  assert.equal(await frame.getByText('feil.png', { exact: true }).count(), 1, 'staged file kept after failure')
  await frame.locator('div.max-w-5xl').filter({ hasText: 'feil.png' }).getByRole('button', { name: 'Send', exact: true }).click()
  await frame.getByText('feil.png', { exact: true }).waitFor({ state: 'detached' })
  assert.equal(await frame.getByRole('alert').filter({ hasText: 'Attachment failed' }).count(), 0, 'error clears after a successful retry')
  await page.screenshot({ path: `${shots}/private.png`, fullPage: true })

  // Mobile layout: all tools reachable, no horizontal overflow
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  for (const title of ['Attach image, video or PDF', 'Create a poll', 'Record voice message']) assert.ok(await frame.getByTitle(title).isVisible(), `${title} visible on mobile`)
  assert.ok(await frame.locator('body').evaluate(element => element.scrollWidth <= innerWidth + 2), 'no horizontal overflow on mobile')
  await page.screenshot({ path: `${shots}/private-mobile.png`, fullPage: true })

  // No private traffic on group or public media routes
  assert.ok(!seen.some(line => line.includes('/groups/dm_')), 'no private conversation on group routes')
  assert.ok(!seen.some(line => /^(GET|HEAD) \/media\?key=media%2Fdm_/.test(line)), 'no private media on the public route')

  // Revocation: Inger leaves NIBI FELLES → the private conversation clears, links stop working
  const link = await privateImage.getAttribute('src')
  chat.db.prepare(`DELETE FROM group_members WHERE group_id='${NIBI}' AND user_id='inger'`).run()
  await frame.getByRole('alert').filter({ hasText: 'Not a conversation participant' }).waitFor({ timeout: 12000 })
  assert.equal(await frame.getByText('Hei Tor, dette er privat').count(), 0, 'private content cleared')
  assert.equal((await workerFetch(new Request(link))).status, 403, 'signed link refused after revocation')
  // An outsider never gets in
  assert.equal((await call('outsider', 'GET', `/direct/${dm}/messages`)).status, 403)

  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [])
  console.log(`PASS parity (group + private, real worker code): text, reply, image, PDF, voice + transcription, dictation, reaction, poll + vote, author-only delete, forwarding both ways with private copy, visible failure with kept file, mobile tools, no private traffic on group/public routes, revocation clears content and links. Screenshots: ${shots}`)
} finally {
  await browser.close()
  server.close()
}
