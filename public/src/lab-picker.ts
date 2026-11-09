import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { AppError } from './config.ts'
import { createResource, LAB_TESTS, labObservation, labTest, LOINC_SYSTEM, type LabTest } from './extensions.ts'
import { escapeHtml } from './http.ts'
import { appPage, scopeHint, type RouteDeps } from './routes.ts'
import { missingScopes } from './scopes.ts'
import { card, notice } from './ui.ts'
import { authorizePost, parseForm, requiredScopes, sendResult } from './write-back.ts'

// A lab result picker in the spirit of the DHIS2 lab-result reference implementation: a fixed catalogue of
// LOINC-coded tests, each with prefilled typical values, written to the EPJ as laboratory Observations.
// Two plain pages, no scripts: the CSP forbids them, and a lab result should never depend on client-side code.

const TestKeySchema = z
    .string()
    .trim()
    .min(1)
    .refine((key) => labTest(key) !== undefined, 'Unknown lab test.')

const QuerySchema = z.object({ test: TestKeySchema.optional() })

// strictObject rejects unknown fields, so a forged patient or encounter field fails instead of being ignored.
// `preset` is one of the prefilled values; `value` is a free value. The text field always posts, often empty.
const LabFormSchema = z.strictObject({
    csrf: z.string(),
    test: TestKeySchema,
    preset: z.string().trim().optional(),
    value: z.string().trim().optional(),
})

export function registerLabPicker(app: FastifyInstance, deps: RouteDeps): void {
    // GET only renders the catalogue or one test's form. Nothing is written until the user submits.
    app.get('/lab', async (request, reply) => {
        const session = deps.requireSession(request)
        const query = QuerySchema.safeParse(request.query)

        if (!query.success) {
            throw new AppError(400, 'Unknown lab test.')
        }

        const missing = missingScopes(session.tokens.scope, requiredScopes('Observation'))

        if (missing.length > 0) {
            return reply
                .code(403)
                .type('text/html')
                .send(appPage('Lab results', scopeHint(missing), '/lab'))
        }

        const test = query.data.test === undefined ? undefined : labTest(query.data.test)
        const content = test ? testForm(test, session.csrfToken) : catalogue()

        const lead = test
            ? "Pick a prefilled value or enter your own. It is written as an Observation for this launch's patient and consultation."
            : 'Pick a test. Results are written as LOINC-coded Observations for the patient and consultation of this launch.'

        return reply.type('text/html').send(appPage('Lab results', content, '/lab', lead))
    })

    app.post('/lab/result', async (request, reply) => {
        const session = authorizePost(request, deps, 'Observation')
        const fields = parseForm(LabFormSchema, request.body)
        const test = labTest(fields.test)

        if (!test) {
            throw new AppError(400, 'Unknown lab test.')
        }

        const value = parseValue(test, fields)

        // Patient and encounter come from the session, never from the form.
        const created = await createResource(deps.config, session.tokens, labObservation(session.context, test, value))

        return sendResult(reply, deps.config, session, created, '/lab')
    })
}

// A typed value wins over a preset, so the user can override a prefilled value without unticking it.
// Both go through the same validation: a preset is still client input once it has been posted.
export function parseValue(test: LabTest, fields: { preset?: string | undefined; value?: string | undefined }): number {
    const text = fields.value || fields.preset

    if (!text) {
        throw new AppError(400, 'Pick a prefilled value or enter one.')
    }

    const decimals = test.decimals > 0 ? `(?:[.,]\\d{1,${test.decimals}})?` : ''
    const pattern = new RegExp(`^\\d{1,4}${decimals}$`)

    if (!pattern.test(text)) {
        throw new AppError(
            400,
            `${test.display} must be a number in ${test.unit.display} with at most ${test.decimals} decimals.`,
        )
    }

    const value = Number(text.replace(',', '.'))

    if (value < test.min || value > test.max) {
        throw new AppError(400, `${test.display} must be between ${test.min} and ${test.max} ${test.unit.display}.`)
    }

    return value
}

function decimalsText(decimals: number): string {
    return decimals === 0 ? 'whole numbers only' : `at most ${decimals} decimal${decimals === 1 ? '' : 's'}`
}

function catalogue(): string {
    const groups = [...new Set(LAB_TESTS.map((test) => test.group))]

    return groups
        .map((group) => {
            const items = LAB_TESTS.filter((test) => test.group === group).map(
                (test) => `
                    <li>
                        <a href="/lab?test=${encodeURIComponent(test.key)}">
                            <span class="catalogue-name">${escapeHtml(test.display)}</span>
                            <span class="catalogue-meta">LOINC <code>${escapeHtml(test.loinc)}</code> <span class="tag">${escapeHtml(test.unit.display)}</span></span>
                        </a>
                    </li>
                `,
            )

            return `
                <section class="catalogue-group">
                    <h2 class="section-title">${escapeHtml(group)}</h2>
                    <ul class="catalogue">${items.join('')}</ul>
                </section>
            `
        })
        .join('')
}

function testForm(test: LabTest, csrfToken: string): string {
    const presets = test.presets.map(
        (preset) => `
            <label class="choice">
                <input type="radio" name="preset" value="${escapeHtml(String(preset.value))}">
                <span class="choice-label">${escapeHtml(preset.label)}</span>
                <span class="choice-value">${escapeHtml(String(preset.value))} ${escapeHtml(test.unit.display)}</span>
            </label>
        `,
    )

    const subtitle = `LOINC <code>${escapeHtml(test.loinc)}</code> in <code>${escapeHtml(LOINC_SYSTEM)}</code>, unit <code>${escapeHtml(test.unit.code)}</code>.`

    return `
        <p class="breadcrumb"><a href="/lab">← All lab tests</a></p>
        ${card(
            test.display,
            `
                <form method="post" action="/lab/result">
                    <input type="hidden" name="csrf" value="${escapeHtml(csrfToken)}">
                    <input type="hidden" name="test" value="${escapeHtml(test.key)}">
                    <fieldset>
                        <legend>Prefilled values</legend>
                        <div class="choices">${presets.join('')}</div>
                    </fieldset>
                    <label class="field">
                        <span class="field-label">Or enter a value in ${escapeHtml(test.unit.display)}</span>
                        <input type="text" name="value" inputmode="decimal" maxlength="7">
                        <span class="field-help">${escapeHtml(String(test.min))} to ${escapeHtml(String(test.max))} ${escapeHtml(test.unit.display)}, ${decimalsText(test.decimals)}. A typed value overrides the prefilled one.</span>
                    </label>
                    <button type="submit">Record result</button>
                </form>
            `,
            subtitle,
        )}
        ${notice('info', 'Demo values', '<p>The prefilled values are typical numbers for a demo, not reference ranges.</p>')}
    `
}
