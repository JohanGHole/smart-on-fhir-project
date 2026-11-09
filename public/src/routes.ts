import type { FastifyRequest } from 'fastify'

import type { Config } from './config.ts'
import { escapeHtml, page } from './http.ts'
import type { Session } from './types.ts'
import { notice } from './ui.ts'

export interface RouteDeps {
    config: Config
    requireSession: (request: FastifyRequest) => Session
}

const TABS = [
    { href: '/app', label: 'Consultation' },
    { href: '/clinical', label: 'Clinical summary' },
    { href: '/lab', label: 'Lab results' },
    { href: '/write', label: 'Write back' },
    { href: '/scopes', label: 'Scope detective' },
] as const

export type Tab = (typeof TABS)[number]['href']

export function navigation(active?: Tab): string {
    const links = TABS.map(({ href, label }) => {
        const current = href === active ? ' aria-current="page"' : ''

        return `<li><a href="${href}"${current}>${label}</a></li>`
    })

    return `<nav class="tabbar" aria-label="App sections"><ul>${links.join('')}</ul></nav>`
}

export function appPage(title: string, content: string, active?: Tab, lead = ''): string {
    return page(title, content, navigation(active), lead)
}

export function scopeHint(missing: string[]): string {
    const list = missing.map((scope) => `<code>${escapeHtml(scope)}</code>`).join(' ')

    return notice(
        'warning',
        'Missing scopes',
        `
            <p>This needs scopes the server did not grant: ${list}</p>
            <p>Add them to <code>SCOPES</code> in <code>.env</code>, restart the app and launch again from the EPJ.</p>
        `,
    )
}
