import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import {
    BODY_TEMPERATURE_LOINC,
    C_REACTIVE_PROTEIN,
    clinicalSummary,
    LOINC_SYSTEM,
    type ClinicalSummary,
} from './extensions.ts'
import { escapeHtml } from './http.ts'
import { appPage, scopeHint, type RouteDeps } from './routes.ts'
import { missingScopes } from './scopes.ts'
import { card, dateTime, notice, sparkline } from './ui.ts'

type Measurement = ClinicalSummary['measurements'][number]

const CodingSchema = z.object({
    system: z.string().optional(),
    code: z.string().optional(),
    display: z.string().optional(),
})

const ConditionDisplaySchema = z.object({
    code: z.object({ text: z.string().optional(), coding: z.array(CodingSchema).default([]) }).optional(),
    clinicalStatus: z.object({ coding: z.array(CodingSchema).default([]) }).optional(),
    onsetDateTime: z.string().optional(),
    recordedDate: z.string().optional(),
})

export interface ConditionSummary {
    label: string
    code?: string
    system?: string
    status?: string
    since?: string
}

export interface Trend {
    direction: 'rising' | 'falling' | 'steady'
    first: number
    last: number
    change: number
    min: number
    max: number
    unit: string
}

// A diagnosis is only useful with its code and the code system next to it: the same code means something
// else in another system (ICPC-2 and ICD-10 overlap). Display text is optional in FHIR, so fall back to the code.
export function summarizeCondition(condition: unknown): ConditionSummary {
    const parsed = ConditionDisplaySchema.safeParse(condition)

    if (!parsed.success) {
        return { label: 'Condition in an unrecognised format' }
    }

    const { code, clinicalStatus, onsetDateTime, recordedDate } = parsed.data
    const coding = code?.coding[0]

    return {
        label: coding?.display ?? code?.text ?? coding?.code ?? 'No description recorded',
        code: coding?.code,
        system: coding?.system,
        status: clinicalStatus?.coding[0]?.code,
        since: onsetDateTime ?? recordedDate,
    }
}

// clinicalSummary has already refused mixed units, so every reading here shares one UCUM code and the
// difference between the first and the last reading is meaningful. Fewer than three readings is not a trend.
export function describeTrend(summary: ClinicalSummary): Trend | undefined {
    const [first] = summary.measurements
    const last = summary.measurements.at(-1)

    if (!summary.trendReady || !first || !last) {
        return undefined
    }

    const values = summary.measurements.map((measurement) => measurement.valueQuantity.value)
    const change = Number((last.valueQuantity.value - first.valueQuantity.value).toFixed(2))

    return {
        direction: change > 0 ? 'rising' : change < 0 ? 'falling' : 'steady',
        first: first.valueQuantity.value,
        last: last.valueQuantity.value,
        change,
        min: Math.min(...values),
        max: Math.max(...values),
        unit: first.valueQuantity.unit,
    }
}

export function registerClinicalApp(app: FastifyInstance, { config, requireSession }: RouteDeps): void {
    app.get('/clinical', async (request, reply) => {
        const session = requireSession(request)

        // Explain a missing scope here instead of sending two requests that are certain to return 403.
        const missing = missingScopes(session.tokens.scope, [
            { resourceType: 'Condition', interaction: 's' },
            { resourceType: 'Observation', interaction: 's' },
        ])

        if (missing.length > 0) {
            return reply
                .code(403)
                .type('text/html')
                .send(appPage('Clinical summary', scopeHint(missing), '/clinical'))
        }

        const [summary, crp] = await Promise.all([
            clinicalSummary(config, session.tokens, session.context),
            clinicalSummary(config, session.tokens, session.context, C_REACTIVE_PROTEIN),
        ])

        return reply
            .type('text/html')
            .send(
                appPage(
                    'Clinical summary',
                    summaryContent(summary, crp),
                    '/clinical',
                    "Diagnoses for this consultation and the patient's measurements, each with its code system and unit. A trend is only drawn from three or more readings in one unit.",
                ),
            )
    })
}

function summaryContent(summary: ClinicalSummary, crp: ClinicalSummary): string {
    return `
        ${card('Diagnoses in this consultation', conditionsContent(summary.conditions))}
        ${seriesCard('Body temperature', BODY_TEMPERATURE_LOINC, summary)}
        ${seriesCard('C-reactive protein (CRP)', C_REACTIVE_PROTEIN, crp)}
    `
}

function seriesCard(title: string, loinc: string, summary: ClinicalSummary): string {
    const searched = `Searched with LOINC <code>${escapeHtml(loinc)}</code> in <code>${escapeHtml(LOINC_SYSTEM)}</code>.`

    return card(title, measurementsContent(summary, title), searched)
}

function conditionsContent(conditions: ClinicalSummary['conditions']): string {
    if (conditions.length === 0) {
        return '<p class="muted">No diagnoses recorded for this consultation.</p>'
    }

    const rows = conditions.map(summarizeCondition).map((condition) => {
        const coding = condition.code
            ? `<code>${escapeHtml(condition.code)}</code> in <code>${escapeHtml(condition.system ?? 'unknown system')}</code>`
            : '<span class="muted">no code recorded</span>'
        const status = condition.status
            ? `<span class="tag tag--neutral">${escapeHtml(condition.status)}</span>`
            : '<span class="muted">not recorded</span>'
        const since = condition.since ? dateTime(condition.since) : '<span class="muted">not recorded</span>'

        return `
            <tr>
                <td><strong>${escapeHtml(condition.label)}</strong></td>
                <td>${coding}</td>
                <td>${status}</td>
                <td>${since}</td>
            </tr>
        `
    })

    return `
        <div class="table-wrap">
            <table>
                <thead><tr><th>Diagnosis</th><th>Code</th><th>Status</th><th>Since</th></tr></thead>
                <tbody>${rows.join('')}</tbody>
            </table>
        </div>
    `
}

function measurementsContent(summary: ClinicalSummary, title: string): string {
    if (summary.measurements.length === 0) {
        return '<p class="muted">No readings recorded.</p>'
    }

    const rows = summary.measurements.map(measurementRow).join('')
    const trend = describeTrend(summary)

    const trendContent = trend
        ? `
            <div class="trend">
                ${sparkline(
                    summary.measurements.map((measurement) => measurement.valueQuantity.value),
                    `${title}, ${summary.measurements.length} readings in ${trend.unit}, oldest to newest`,
                )}
                <p>Trend over ${summary.measurements.length} readings in ${escapeHtml(trend.unit)}: ${trend.direction}, from ${trend.first} to ${trend.last} (change ${trend.change}, range ${trend.min} to ${trend.max}).</p>
            </div>
        `
        : notice(
              'info',
              'No trend',
              `<p>No trend: it needs at least three readings in the same unit, and there are ${summary.measurements.length}.</p>`,
          )

    return `
        <div class="table-wrap">
            <table>
                <thead><tr><th>Measured</th><th class="num">Value</th><th>Unit</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        ${trendContent}
    `
}

function measurementRow(measurement: Measurement): string {
    const { value, unit, system, code } = measurement.valueQuantity

    return `
        <tr>
            <td>${dateTime(measurement.effectiveDateTime)}</td>
            <td class="num value">${escapeHtml(value)}</td>
            <td>${escapeHtml(unit)} (<code>${escapeHtml(code)}</code> in <code>${escapeHtml(system)}</code>)</td>
        </tr>
    `
}
