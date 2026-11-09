import { z } from 'zod'

import { AppError, type Config } from './config.ts'
import { bundle, fhir, fhirUrl, IdSchema, referenceId, request, searchPath, UpstreamStatusError } from './http.ts'
import type { Context, Tokens } from './types.ts'

export const LOINC_SYSTEM = 'http://loinc.org'
const UCUM_SYSTEM = 'http://unitsofmeasure.org'

export const BODY_TEMPERATURE_LOINC = '8310-5'
export const C_REACTIVE_PROTEIN = '1988-5'
const MIN_TREND_READINGS = 3

const UNCERTAIN_CREATE_MESSAGE =
    'The EPJ did not confirm the save. It may already have been saved, so check the EPJ before submitting again.'

const ConditionSchema = z.object({ resourceType: z.literal('Condition') }).passthrough()

const ObservationSchema = z.object({
    resourceType: z.literal('Observation'),
    id: IdSchema,
    effectiveDateTime: z.iso.datetime({ offset: true }),
    valueQuantity: z.object({
        value: z.number().finite(),
        unit: z.string(),
        system: z.literal(UCUM_SYSTEM),
        code: z.string(),
    }),
})

const CreatedResourceSchema = z.object({ resourceType: z.string(), id: IdSchema }).passthrough()

type Condition = z.infer<typeof ConditionSchema>
type Measurement = z.infer<typeof ObservationSchema>
type CreatedResource = z.infer<typeof CreatedResourceSchema>

interface Reference {
    reference: string
}

interface Coding {
    system: string
    code: string
    display?: string
}

export interface ClinicalSummary {
    conditions: Condition[]
    measurements: Measurement[]
    trendReady: boolean
}

export interface TemperatureObservation {
    resourceType: 'Observation'
    status: string
    code: { coding: Coding[] }
    subject: Reference
    encounter: Reference
    effectiveDateTime: string
    valueQuantity: { value: number; unit: string; system: string; code: string }
}

export interface JournalNote {
    resourceType: 'DocumentReference'
    status: string
    type: { coding: Coding[] }
    subject: Reference
    context: { encounter: Reference[] }
    description: string
    content: { attachment: { contentType: string } }[]
}

export async function clinicalSummary(
    config: Config,
    tokens: Tokens,
    context: Context,
    loinc = BODY_TEMPERATURE_LOINC,
): Promise<ClinicalSummary> {
    const [conditions, measurements] = await Promise.all([
        fhir(
            config,
            tokens.access_token,
            searchPath('Condition', { subject: context.patient, encounter: context.encounter }),
            bundle(ConditionSchema),
        ),
        fhir(
            config,
            tokens.access_token,
            searchPath('Observation', { subject: context.patient, code: `${LOINC_SYSTEM}|${loinc}` }),
            bundle(ObservationSchema),
        ),
    ])

    const units = new Set(measurements.map((measurement) => measurement.valueQuantity.code))

    if (units.size > 1) {
        throw new AppError(400, 'Mixed units: convert explicitly before presenting a trend.')
    }

    return {
        conditions,
        measurements: measurements.toSorted(
            (a, b) => Date.parse(a.effectiveDateTime) - Date.parse(b.effectiveDateTime),
        ),
        trendReady: measurements.length >= MIN_TREND_READINGS,
    }
}

export function temperature(context: Context, celsius: number, effective = new Date()): TemperatureObservation {
    z.number().finite().parse(celsius)

    return {
        resourceType: 'Observation',
        status: 'final',
        code: { coding: [{ system: LOINC_SYSTEM, code: BODY_TEMPERATURE_LOINC, display: 'Body temperature' }] },
        subject: resourceReference('Patient', context.patient),
        encounter: resourceReference('Encounter', context.encounter),
        effectiveDateTime: effective.toISOString(),
        valueQuantity: { value: celsius, unit: 'degrees Celsius', system: UCUM_SYSTEM, code: 'Cel' },
    }
}

// Quantitative lab tests the picker offers. Modelled on the lab Observations of the DHIS2 lab-result reference
// implementation (one LOINC test code per result), but with SI quantities instead of coded answers, and without
// `category`: nav-epj's write contract accepts only the temperature-style shape and rejects category, component,
// note, interpretation, referenceRange, identifier and extensions with a 400 (EXERCISES.md, Write-back shapes).
// Presets are typical values for a demo, not clinical advice.
export type LabGroup = 'Laboratory' | 'Vital signs'

export interface LabTest {
    key: string
    group: LabGroup
    loinc: string
    display: string
    unit: { code: string; display: string }
    min: number
    max: number
    decimals: number
    presets: { label: string; value: number }[]
}

export const LAB_TESTS: readonly LabTest[] = [
    {
        key: 'crp',
        group: 'Laboratory',
        loinc: C_REACTIVE_PROTEIN,
        display: 'C reactive protein [Mass/volume] in Serum or Plasma',
        unit: { code: 'mg/L', display: 'mg/L' },
        min: 0,
        max: 500,
        decimals: 1,
        presets: [
            { label: 'Normal', value: 3 },
            { label: 'Mildly raised', value: 25 },
            { label: 'Raised', value: 80 },
            { label: 'High', value: 180 },
        ],
    },
    {
        key: 'hemoglobin',
        group: 'Laboratory',
        loinc: '718-7',
        display: 'Hemoglobin [Mass/volume] in Blood',
        unit: { code: 'g/dL', display: 'g/dL' },
        min: 3,
        max: 25,
        decimals: 1,
        presets: [
            { label: 'Low', value: 9.5 },
            { label: 'Normal', value: 14 },
            { label: 'High', value: 18 },
        ],
    },
    {
        key: 'glucose',
        group: 'Laboratory',
        loinc: '15074-8',
        display: 'Glucose [Moles/volume] in Blood',
        unit: { code: 'mmol/L', display: 'mmol/L' },
        min: 1,
        max: 50,
        decimals: 1,
        presets: [
            { label: 'Low', value: 3.2 },
            { label: 'Normal', value: 5 },
            { label: 'Raised', value: 7.5 },
            { label: 'High', value: 12 },
        ],
    },
    {
        key: 'creatinine',
        group: 'Laboratory',
        loinc: '14682-9',
        display: 'Creatinine [Moles/volume] in Serum or Plasma',
        unit: { code: 'umol/L', display: 'µmol/L' },
        min: 10,
        max: 2000,
        decimals: 0,
        presets: [
            { label: 'Normal', value: 75 },
            { label: 'Mildly raised', value: 130 },
            { label: 'Raised', value: 250 },
        ],
    },
    {
        key: 'leukocytes',
        group: 'Laboratory',
        loinc: '6690-2',
        display: 'Leukocytes [#/volume] in Blood by Automated count',
        unit: { code: '10*9/L', display: '10⁹/L' },
        min: 0,
        max: 200,
        decimals: 1,
        presets: [
            { label: 'Low', value: 2.5 },
            { label: 'Normal', value: 7 },
            { label: 'Raised', value: 14 },
        ],
    },
    {
        key: 'hba1c',
        group: 'Laboratory',
        loinc: '4548-4',
        display: 'Hemoglobin A1c/Hemoglobin.total in Blood',
        unit: { code: '%', display: '%' },
        min: 3,
        max: 20,
        decimals: 1,
        presets: [
            { label: 'Normal', value: 5.4 },
            { label: 'Prediabetes', value: 6.1 },
            { label: 'Diabetes', value: 7.2 },
            { label: 'Poorly controlled', value: 9.5 },
        ],
    },
    {
        key: 'potassium',
        group: 'Laboratory',
        loinc: '2823-3',
        display: 'Potassium [Moles/volume] in Serum or Plasma',
        unit: { code: 'mmol/L', display: 'mmol/L' },
        min: 1,
        max: 10,
        decimals: 1,
        presets: [
            { label: 'Low', value: 3.1 },
            { label: 'Normal', value: 4.2 },
            { label: 'High', value: 5.8 },
        ],
    },
    {
        key: 'sodium',
        group: 'Laboratory',
        loinc: '2951-2',
        display: 'Sodium [Moles/volume] in Serum or Plasma',
        unit: { code: 'mmol/L', display: 'mmol/L' },
        min: 100,
        max: 180,
        decimals: 0,
        presets: [
            { label: 'Low', value: 128 },
            { label: 'Normal', value: 140 },
            { label: 'High', value: 150 },
        ],
    },
    {
        key: 'alt',
        group: 'Laboratory',
        loinc: '1742-6',
        display: 'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma',
        unit: { code: 'U/L', display: 'U/L' },
        min: 1,
        max: 5000,
        decimals: 0,
        presets: [
            { label: 'Normal', value: 25 },
            { label: 'Raised', value: 90 },
            { label: 'High', value: 300 },
        ],
    },
    {
        key: 'cholesterol',
        group: 'Laboratory',
        loinc: '14647-2',
        display: 'Cholesterol [Moles/volume] in Serum or Plasma',
        unit: { code: 'mmol/L', display: 'mmol/L' },
        min: 1,
        max: 20,
        decimals: 1,
        presets: [
            { label: 'Desirable', value: 4.6 },
            { label: 'Borderline', value: 5.8 },
            { label: 'High', value: 7.2 },
        ],
    },
    {
        key: 'tsh',
        group: 'Laboratory',
        loinc: '3016-3',
        display: 'Thyrotropin [Units/volume] in Serum or Plasma',
        unit: { code: 'm[IU]/L', display: 'mIU/L' },
        min: 0,
        max: 100,
        decimals: 2,
        presets: [
            { label: 'Low', value: 0.05 },
            { label: 'Normal', value: 1.8 },
            { label: 'High', value: 8.5 },
        ],
    },
    {
        key: 'platelets',
        group: 'Laboratory',
        loinc: '777-3',
        display: 'Platelets [#/volume] in Blood by Automated count',
        unit: { code: '10*9/L', display: '10⁹/L' },
        min: 1,
        max: 2000,
        decimals: 0,
        presets: [
            { label: 'Low', value: 90 },
            { label: 'Normal', value: 250 },
            { label: 'High', value: 520 },
        ],
    },
    {
        key: 'systolic',
        group: 'Vital signs',
        loinc: '8480-6',
        display: 'Systolic blood pressure',
        unit: { code: 'mm[Hg]', display: 'mmHg' },
        min: 50,
        max: 260,
        decimals: 0,
        presets: [
            { label: 'Normal', value: 118 },
            { label: 'Elevated', value: 135 },
            { label: 'High', value: 165 },
        ],
    },
    {
        key: 'diastolic',
        group: 'Vital signs',
        loinc: '8462-4',
        display: 'Diastolic blood pressure',
        unit: { code: 'mm[Hg]', display: 'mmHg' },
        min: 30,
        max: 160,
        decimals: 0,
        presets: [
            { label: 'Normal', value: 76 },
            { label: 'Elevated', value: 88 },
            { label: 'High', value: 102 },
        ],
    },
]

export function labTest(key: string): LabTest | undefined {
    return LAB_TESTS.find((test) => test.key === key)
}

export function labObservation(
    context: Context,
    test: LabTest,
    value: number,
    effective = new Date(),
): TemperatureObservation {
    z.number().finite().min(test.min).max(test.max).parse(value)

    return {
        resourceType: 'Observation',
        status: 'final',
        code: { coding: [{ system: LOINC_SYSTEM, code: test.loinc, display: test.display }] },
        subject: resourceReference('Patient', context.patient),
        encounter: resourceReference('Encounter', context.encounter),
        effectiveDateTime: effective.toISOString(),
        valueQuantity: { value, unit: test.unit.display, system: UCUM_SYSTEM, code: test.unit.code },
    }
}

// Same shape as a temperature: only the LOINC code and the UCUM unit differ.
export function cReactiveProtein(context: Context, mgPerLitre: number, effective = new Date()): TemperatureObservation {
    z.number().finite().parse(mgPerLitre)

    return {
        resourceType: 'Observation',
        status: 'final',
        code: { coding: [{ system: LOINC_SYSTEM, code: C_REACTIVE_PROTEIN, display: 'C reactive protein' }] },
        subject: resourceReference('Patient', context.patient),
        encounter: resourceReference('Encounter', context.encounter),
        effectiveDateTime: effective.toISOString(),
        valueQuantity: { value: mgPerLitre, unit: 'mg/L', system: UCUM_SYSTEM, code: 'mg/L' },
    }
}

export function journalNote(context: Context, text: string): JournalNote {
    return {
        resourceType: 'DocumentReference',
        status: 'current',
        type: { coding: [{ system: 'urn:oid:2.16.578.1.12.4.1.1.9602', code: 'J01-2' }] },
        subject: resourceReference('Patient', context.patient),
        context: { encounter: [resourceReference('Encounter', context.encounter)] },
        description: z.string().trim().min(1).parse(text),
        // nav-epj stores the description, not an uploaded PDF. Its write contract rejects attachment.data.
        content: [{ attachment: { contentType: 'application/pdf' } }],
    }
}

export async function createResource(
    config: Config,
    tokens: Tokens,
    resource: TemperatureObservation | JournalNote,
): Promise<CreatedResource> {
    try {
        const response = await request(fhirUrl(config, resource.resourceType), {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                'Content-Type': 'application/fhir+json',
                Accept: 'application/fhir+json',
            },
            body: JSON.stringify(resource),
        })

        const created = CreatedResourceSchema.parse(await response.json())
        const location = response.headers.get('Location')

        const isCreatedResponse = response.status === 201 && created.resourceType === resource.resourceType

        if (!isCreatedResponse || !location || referenceId(config, location, resource.resourceType) !== created.id) {
            throw new Error('Unexpected create response')
        }

        return created
    } catch (error) {
        // A 4xx means the server refused the write. Anything else (disconnect, timeout, 5xx, an unreadable or
        // unexpected 201) leaves it unknown whether the resource was stored. The cause is dropped on purpose:
        // it can contain upstream content.
        if (error instanceof UpstreamStatusError && error.upstreamStatus >= 400 && error.upstreamStatus < 500) {
            throw error
        }

        throw new AppError(502, UNCERTAIN_CREATE_MESSAGE)
    }
}

function resourceReference(type: 'Patient' | 'Encounter', id: string): Reference {
    return { reference: `${type}/${IdSchema.parse(id)}` }
}
