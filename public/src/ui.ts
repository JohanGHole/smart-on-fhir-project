import { escapeHtml } from './http.ts'

// Small server-rendered building blocks modelled on @dhis2/ui (NoticeBox, Card, DataTable, Tag).
// They return HTML strings; every caller escapes its own data before passing it in as `body`.

export type NoticeKind = 'info' | 'success' | 'warning' | 'error'

export function notice(kind: NoticeKind, title: string, body: string): string {
    const role = kind === 'error' || kind === 'warning' ? 'alert' : 'status'

    return `
        <div class="notice notice--${kind}" role="${role}">
            <p class="notice-title">${escapeHtml(title)}</p>
            <div class="notice-body">${body}</div>
        </div>
    `
}

export function card(title: string, body: string, subtitle = ''): string {
    return `
        <section class="card">
            <header class="card-header">
                <h2>${escapeHtml(title)}</h2>
                ${subtitle ? `<p class="card-subtitle">${subtitle}</p>` : ''}
            </header>
            <div class="card-body">${body}</div>
        </section>
    `
}

export function chips(values: string[], highlight: string[] = []): string {
    if (values.length === 0) {
        return '<span class="muted">none</span>'
    }

    const items = values.map((value) => {
        const isHighlighted = highlight.includes(value)

        return `<li class="chip${isHighlighted ? ' chip--highlight' : ''}">${escapeHtml(value)}</li>`
    })

    return `<ul class="chip-list">${items.join('')}</ul>`
}

const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Oslo',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
})

// The machine-readable instant stays in the datetime attribute; people read Oslo local time.
export function dateTime(iso: string): string {
    const date = new Date(iso)

    if (Number.isNaN(date.getTime())) {
        return escapeHtml(iso)
    }

    return `<time datetime="${escapeHtml(iso)}">${escapeHtml(DATE_TIME.format(date))}</time>`
}

const SPARK_WIDTH = 320
const SPARK_HEIGHT = 72
const SPARK_PAD = 8

// A server-drawn sparkline: plain SVG with presentation attributes, so it needs neither scripts nor inline
// styles under the CSP. Only called with three or more readings in one unit, the same rule as the trend text.
export function sparkline(values: number[], label: string): string {
    if (values.length < 2) {
        return ''
    }

    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1
    const step = (SPARK_WIDTH - SPARK_PAD * 2) / (values.length - 1)

    const points = values.map((value, index) => {
        const x = SPARK_PAD + index * step
        const y = SPARK_PAD + (1 - (value - min) / span) * (SPARK_HEIGHT - SPARK_PAD * 2)

        return [Number(x.toFixed(1)), Number(y.toFixed(1))] as const
    })

    const line = points.map(([x, y]) => `${x},${y}`).join(' ')
    const dots = points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" />`).join('')

    return `
        <figure class="sparkline">
            <svg viewBox="0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}" role="img" aria-label="${escapeHtml(label)}">
                <polyline points="${line}" fill="none" stroke="#147cd7" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
                <g fill="#ffffff" stroke="#147cd7" stroke-width="2">${dots}</g>
            </svg>
            <figcaption>${escapeHtml(label)}</figcaption>
        </figure>
    `
}
