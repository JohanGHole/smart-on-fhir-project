import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildApp } from '../src/app.ts'
import { sparkline } from '../src/ui.ts'

import { signIn } from './browser.ts'
import { fixture } from './fixture.ts'

const ALL_SCOPES = 'patient/Condition.s patient/Observation.s patient/Observation.cr patient/DocumentReference.cr'

test('UI: the stylesheet is served from the app origin and the CSP allows only that', async (t) => {
    const f = await fixture()
    t.after(f.close)
    const app = await buildApp(f.config)
    t.after(async () => app.close())

    const css = await app.inject({ url: '/assets/app.css' })
    const csp = String(css.headers['content-security-policy'])

    assert.equal(css.statusCode, 200)
    assert.match(String(css.headers['content-type']), /^text\/css/)
    assert.match(css.body, /--blue600: #147cd7/)
    assert.match(csp, /style-src 'self'/)
    assert.doesNotMatch(csp, /unsafe-inline|script-src/)
})

test('UI: every page links the stylesheet, marks its tab and carries no inline styles or scripts', async (t) => {
    const f = await fixture()
    t.after(f.close)
    const app = await buildApp(f.config)
    t.after(async () => app.close())

    const cookies = { smart_session: await signIn(app, f, `${f.config.scopes} ${ALL_SCOPES}`) }

    for (const url of ['/app', '/clinical', '/lab', '/lab?test=crp', '/write', '/scopes']) {
        const page = await app.inject({ url, cookies })
        const tab = url.split('?')[0]

        assert.equal(page.statusCode, 200, url)
        assert.match(page.body, /<link rel="stylesheet" href="\/assets\/app.css">/, url)
        assert.match(page.body, new RegExp(`<a href="${tab}" aria-current="page">`), url)
        assert.equal((page.body.match(/aria-current="page"/g) ?? []).length, 1, url)
        assert.doesNotMatch(page.body, /<script|<style|\sstyle="/, url)
    }
})

test('UI: the sparkline needs two values and escapes its label', () => {
    assert.equal(sparkline([36.1], 'one'), '')

    const svg = sparkline([36.1, 36.2, 36.3], '<b>label</b>')

    assert.match(svg, /<polyline points="[\d.,\s]+"/)
    assert.equal((svg.match(/<circle /g) ?? []).length, 3)
    assert.doesNotMatch(svg, /<b>/)
})
