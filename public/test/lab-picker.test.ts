import type { FastifyInstance } from 'fastify'
import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'

import { buildApp } from '../src/app.ts'
import { LAB_TESTS, labTest } from '../src/extensions.ts'
import { parseValue } from '../src/lab-picker.ts'

import { signIn, type LaunchResponse } from './browser.ts'
import { fixture, type Fixture } from './fixture.ts'

const WRITE_SCOPES = 'patient/Observation.cr'
const TRUSTED_ORIGIN = 'http://localhost:3100'
const FORM = 'application/x-www-form-urlencoded'

interface LabApp {
    f: Fixture
    app: FastifyInstance
    cookies: { smart_session: string }
    csrf: string
}

async function startLabApp(t: TestContext, scopes = WRITE_SCOPES): Promise<LabApp> {
    const f = await fixture()
    t.after(f.close)

    const app = await buildApp(f.config)
    t.after(async () => app.close())

    const cookies = { smart_session: await signIn(app, f, `${f.config.scopes} ${scopes}`.trim()) }
    const page = await app.inject({ url: '/lab?test=crp', cookies })
    const csrf = /name="csrf" value="([^"]+)"/.exec(page.body)?.[1] ?? ''

    return { f, app, cookies, csrf }
}

function form(fields: Record<string, string>): string {
    return new URLSearchParams(fields).toString()
}

async function post(lab: LabApp, fields: Record<string, string>): Promise<LaunchResponse> {
    return lab.app.inject({
        method: 'POST',
        url: '/lab/result',
        cookies: lab.cookies,
        headers: { 'content-type': FORM, origin: TRUSTED_ORIGIN },
        payload: form({ csrf: lab.csrf, ...fields }),
    })
}

function postedResources(f: Fixture): number {
    return f.requests.filter((r) => r.method === 'POST' && r.path.startsWith('/fhir/')).length
}

test('Lab picker: lists every catalogue test with its LOINC code and writes nothing', async (t) => {
    const lab = await startLabApp(t)
    const page = await lab.app.inject({ url: '/lab', cookies: lab.cookies })

    assert.equal(page.statusCode, 200)

    for (const entry of LAB_TESTS) {
        assert.match(page.body, new RegExp(`/lab\\?test=${entry.key}`))
        assert.ok(page.body.includes(entry.loinc), entry.loinc)
    }

    assert.equal(postedResources(lab.f), 0)
})

test('Lab picker: a test page shows its presets, a free value field and the session token', async (t) => {
    const lab = await startLabApp(t)
    const page = await lab.app.inject({ url: '/lab?test=hemoglobin', cookies: lab.cookies })

    assert.equal(page.statusCode, 200)
    assert.match(page.body, /718-7/)
    assert.match(page.body, /name="preset" value="9.5"/)
    assert.match(page.body, /name="preset" value="14"/)
    assert.match(page.body, /name="value"/)
    assert.match(page.body, /name="csrf" value="[^"]+"/)
    assert.match(page.body, /name="test" value="hemoglobin"/)
})

test('Lab picker: an unknown test and a missing session are refused', async (t) => {
    const lab = await startLabApp(t)

    assert.equal((await lab.app.inject({ url: '/lab?test=nope', cookies: lab.cookies })).statusCode, 400)
    assert.equal((await lab.app.inject({ url: '/lab' })).statusCode, 401)
    assert.equal((await lab.app.inject({ url: '/lab?test=crp' })).statusCode, 401)
})

test('Lab picker: without create and read scopes it explains instead of offering the form', async (t) => {
    const lab = await startLabApp(t, '')
    const page = await lab.app.inject({ url: '/lab?test=crp', cookies: lab.cookies })

    assert.equal(page.statusCode, 403)
    assert.match(page.body, /patient\/Observation\.c/)
    assert.doesNotMatch(page.body, /name="csrf"/)
})

test('Lab picker: a preset writes an Observation with the catalogue LOINC and unit, then reads it back', async (t) => {
    const lab = await startLabApp(t)
    const response = await post(lab, { test: 'glucose', preset: '7.5', value: '' })

    assert.equal(response.statusCode, 200, response.body)
    assert.match(response.body, /Observation\/created-1/)
    assert.match(response.body, /7\.5 mmol\/L/)
    assert.match(response.body, /Patient\/p1/)
    assert.match(response.body, /Encounter\/e1/)

    const stored = lab.f.created.get('Observation/created-1') as {
        code: { coding: { code: string }[] }
        valueQuantity: { value: number; code: string; unit: string }
    }

    // The EPJ rejects `category`, so the lab shape is the temperature shape with another code and unit.
    assert.equal('category' in stored, false)
    assert.equal(stored.code.coding[0]?.code, '15074-8')
    assert.equal(stored.valueQuantity.value, 7.5)
    assert.equal(stored.valueQuantity.code, 'mmol/L')
    assert.equal(postedResources(lab.f), 1)
    assert.ok(lab.f.requests.some((r) => r.method === 'GET' && r.path === '/fhir/Observation/created-1'))
})

test('Lab picker: a typed value overrides the preset and accepts a decimal comma', async (t) => {
    const lab = await startLabApp(t)
    const response = await post(lab, { test: 'creatinine', preset: '75', value: '132' })

    assert.equal(response.statusCode, 200, response.body)

    const stored = lab.f.created.get('Observation/created-1') as { valueQuantity: { value: number } }

    assert.equal(stored.valueQuantity.value, 132)

    const comma = await post(lab, { test: 'crp', value: '12,5' })

    assert.equal(comma.statusCode, 200, comma.body)
    assert.match(comma.body, /12\.5 mg\/L/)
})

test('Lab picker: invalid input is rejected without writing', async (t) => {
    const lab = await startLabApp(t)
    const cases: Record<string, string>[] = [
        { test: 'crp' },
        { test: 'crp', preset: '', value: '' },
        { test: 'crp', value: 'abc' },
        { test: 'crp', value: '-1' },
        { test: 'crp', value: '500.1' },
        { test: 'crp', value: '12.55' },
        { test: 'creatinine', value: '75.5' },
        { test: 'hemoglobin', value: '2.9' },
        { test: 'unknown', value: '1' },
        { test: 'crp', value: '10', patient: 'p2' },
    ]

    for (const fields of cases) {
        const response = await post(lab, fields)

        assert.equal(response.statusCode, 400, JSON.stringify(fields))
    }

    assert.equal(lab.f.created.size, 0)
    assert.equal(postedResources(lab.f), 0)
})

test('Lab picker: every catalogue preset passes its own validation', () => {
    for (const entry of LAB_TESTS) {
        for (const preset of entry.presets) {
            assert.equal(
                parseValue(entry, { preset: String(preset.value) }),
                preset.value,
                `${entry.key} ${preset.label}`,
            )
        }
    }

    assert.equal(labTest('nope'), undefined)
})
