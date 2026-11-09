// One stylesheet for every page, served from /assets/app.css so the CSP can stay at `style-src 'self'`
// (no inline styles). Colours, spacing and elevations are the @dhis2/ui-constants tokens.

export const STYLESHEET = `
:root {
    --blue900: #093371; --blue800: #0d47a1; --blue700: #1565c0; --blue600: #147cd7; --blue200: #c5e3fc; --blue100: #e3f2fd; --blue050: #f5fbff;
    --teal700: #00695c; --teal100: #e0f2f1;
    --red800: #891515; --red700: #b71c1c; --red200: #ffcdd2; --red050: #fff5f6;
    --yellow900: #6f3205; --yellow300: #ffc324; --yellow050: #fff8e1;
    --green800: #1b5e20; --green700: #2e7d32; --green200: #c8e6c9; --green050: #f4fbf4;
    --grey900: #212934; --grey800: #404b5a; --grey700: #4a5768; --grey600: #6c7787; --grey500: #a0adba;
    --grey400: #d5dde5; --grey300: #e8edf2; --grey200: #f3f5f7; --grey100: #f8f9fa; --grey050: #fbfcfd; --white: #ffffff;
    --e100: 0px 1px 2px rgba(33,41,52,0.06), 0px 1px 3px rgba(33,41,52,0.1);
    --e200: 0px 0px 1px rgba(33,41,52,0.1), 0px 4px 6px -1px rgba(33,41,52,0.1), 0px 2px 4px -1px rgba(33,41,52,0.06);
    --font: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    --mono: "Roboto Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

*, *::before, *::after { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
    margin: 0;
    background: var(--grey200);
    color: var(--grey900);
    font-family: var(--font);
    font-size: 14px;
    line-height: 20px;
}

a { color: var(--blue700); }
a:hover { color: var(--blue900); }
:focus-visible { outline: 3px solid var(--blue600); outline-offset: 2px; }

/* Header bar, like the DHIS2 HeaderBar */
.headerbar {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 48px;
    padding: 0 16px;
    background: var(--blue900);
    color: var(--white);
}
.headerbar-logo { display: inline-flex; width: 28px; height: 28px; }
.headerbar-title { font-size: 15px; font-weight: 500; letter-spacing: 0.1px; white-space: nowrap; }
.headerbar-context { margin-left: auto; font-size: 12px; color: var(--blue200); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Tab bar, like the DHIS2 TabBar */
.tabbar {
    background: var(--white);
    border-bottom: 1px solid var(--grey400);
    box-shadow: var(--e100);
    overflow-x: auto;
}
.tabbar ul { display: flex; gap: 0; max-width: 1120px; margin: 0 auto; padding: 0 8px; list-style: none; }
.tabbar a {
    display: block;
    padding: 14px 16px 12px;
    border-bottom: 2px solid transparent;
    color: var(--grey700);
    font-weight: 500;
    text-decoration: none;
    white-space: nowrap;
}
.tabbar a:hover { color: var(--grey900); background: var(--grey100); }
.tabbar a[aria-current="page"] { color: var(--blue800); border-bottom-color: var(--blue700); background: var(--blue050); }

/* Page layout */
.container { max-width: 1120px; margin: 0 auto; padding: 24px 16px 48px; }
.page-title { margin: 0 0 4px; font-size: 24px; line-height: 32px; font-weight: 500; }
.page-lead { margin: 0 0 24px; color: var(--grey700); max-width: 72ch; }
.stack > * + * { margin-top: 16px; }
.grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); align-items: start; }
.muted { color: var(--grey600); }
.steps { margin: 0; padding-left: 20px; }
.steps li + li { margin-top: 6px; }
p { margin: 0 0 12px; }
p:last-child { margin-bottom: 0; }

/* Card */
.card { background: var(--white); border-radius: 4px; box-shadow: var(--e100); overflow: hidden; }
.card-header { padding: 16px 16px 0; }
.card-header h2 { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; }
.card-subtitle { margin: 2px 0 0; color: var(--grey700); font-size: 13px; }
.card-body { padding: 12px 16px 16px; }
.card-body > table, .card-body > .table-wrap { margin: 0 -16px; width: calc(100% + 32px); max-width: none; }

/* Tag-like inline codes */
code {
    display: inline;
    padding: 1px 5px;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
    border: 1px solid var(--grey300);
    border-radius: 3px;
    background: var(--grey100);
    color: var(--grey800);
    font-family: var(--mono);
    font-size: 12px;
    line-height: 18px;
    overflow-wrap: anywhere;
}
time { white-space: nowrap; }

.chip-list { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.chip {
    padding: 2px 8px;
    border-radius: 12px;
    background: var(--grey200);
    border: 1px solid var(--grey300);
    color: var(--grey800);
    font-family: var(--mono);
    font-size: 12px;
    line-height: 18px;
}
.chip--highlight { background: var(--blue100); border-color: var(--blue200); color: var(--blue900); }

.tag { display: inline-block; padding: 1px 8px; border-radius: 3px; font-size: 12px; font-weight: 500; line-height: 18px; background: var(--grey300); color: var(--grey800); }
.tag--positive { background: var(--green050); color: var(--green800); box-shadow: inset 0 0 0 1px var(--green200); }
.tag--negative { background: var(--red050); color: var(--red800); box-shadow: inset 0 0 0 1px var(--red200); }
.tag--neutral { background: var(--blue050); color: var(--blue900); box-shadow: inset 0 0 0 1px var(--blue200); }

/* Key/value list */
.kv { display: grid; grid-template-columns: minmax(120px, max-content) 1fr; gap: 0; margin: 0; }
.kv dt, .kv dd { padding: 10px 0; border-bottom: 1px solid var(--grey300); }
.kv dt { color: var(--grey700); padding-right: 24px; }
.kv dd { margin: 0; font-weight: 500; }
.kv > :nth-last-child(-n + 2) { border-bottom: 0; }

/* Data table, like the DHIS2 DataTable */
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px 16px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--grey300); }
thead th { background: var(--grey050); color: var(--grey700); font-size: 13px; font-weight: 500; border-bottom-color: var(--grey400); white-space: nowrap; }
tbody tr:hover { background: var(--grey100); }
tbody tr:last-child td { border-bottom: 0; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
td.value { font-weight: 500; font-size: 15px; }
tr.row--refused td:first-child { box-shadow: inset 3px 0 0 var(--red700); }
tr.row--allowed td:first-child { box-shadow: inset 3px 0 0 var(--green700); }

/* Notice box, like the DHIS2 NoticeBox */
.notice { display: block; padding: 12px 16px; border: 1px solid; border-left-width: 4px; border-radius: 4px; }
.notice-title { margin: 0 0 4px; font-weight: 500; }
.notice-body { color: var(--grey900); }
.notice--info { background: var(--blue050); border-color: var(--blue200); border-left-color: var(--blue700); }
.notice--success { background: var(--green050); border-color: var(--green200); border-left-color: var(--green700); }
.notice--warning { background: var(--yellow050); border-color: var(--yellow300); border-left-color: var(--yellow900); }
.notice--warning .notice-title { color: var(--yellow900); }
.notice--error { background: var(--red050); border-color: var(--red200); border-left-color: var(--red700); }
.notice--error .notice-title { color: var(--red800); }

/* Trend summary */
.trend { display: flex; flex-wrap: wrap; gap: 16px 32px; align-items: center; margin-top: 16px; }
.trend p { margin: 0; color: var(--grey800); max-width: 48ch; }
.sparkline { margin: 0; flex: 0 1 320px; }
.sparkline svg { display: block; width: 100%; height: auto; background: var(--blue050); border-radius: 4px; }
.sparkline figcaption { margin-top: 4px; font-size: 12px; color: var(--grey600); }

/* Forms, like DHIS2 InputField and Button */
form { margin: 0; }
.field { display: block; margin-bottom: 16px; }
.field-label { display: block; margin-bottom: 6px; font-weight: 500; color: var(--grey900); }
.field-help { display: block; margin-top: 4px; font-size: 12px; color: var(--grey600); }
input[type="text"], textarea {
    width: 100%;
    max-width: 360px;
    padding: 8px 12px;
    border: 1px solid var(--grey500);
    border-radius: 3px;
    background: var(--white);
    color: var(--grey900);
    font: inherit;
    box-shadow: inset 0 1px 2px rgba(48,54,60,0.1);
}
textarea { max-width: none; resize: vertical; min-height: 96px; }
input[type="text"]:focus, textarea:focus { outline: none; border-color: var(--blue600); box-shadow: inset 0 0 0 2px var(--blue600); }

button, .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    padding: 0 16px;
    border: 1px solid var(--blue800);
    border-radius: 4px;
    background: linear-gradient(180deg, #1565c0 0%, #0650a3 100%);
    color: var(--white);
    font: inherit;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(33,41,52,0.15);
}
button:hover, .button:hover { background: linear-gradient(180deg, #054fa3 0%, #034793 100%); color: var(--white); }
button:active { background: #0d47a1; box-shadow: inset 0 1px 3px rgba(0,0,0,0.25); }
.button--secondary { background: var(--grey050); border-color: var(--grey500); color: var(--grey900); box-shadow: 0 1px 2px rgba(33,41,52,0.08); }
.button--secondary:hover { background: var(--grey200); color: var(--grey900); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }

/* Preset picker: radios as selectable cards */
fieldset { margin: 0 0 16px; padding: 0; border: 0; min-width: 0; }
legend { padding: 0; margin-bottom: 8px; font-weight: 500; }
.choices { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
.choice {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px 10px 36px;
    border: 1px solid var(--grey400);
    border-radius: 4px;
    background: var(--white);
    cursor: pointer;
}
.choice:hover { border-color: var(--grey500); background: var(--grey050); }
.choice input { position: absolute; left: 12px; top: 12px; margin: 0; accent-color: var(--blue700); width: 16px; height: 16px; }
.choice-label { color: var(--grey700); font-size: 13px; }
.choice-value { font-weight: 500; font-size: 15px; font-variant-numeric: tabular-nums; }
.choice:has(input:checked) { border-color: var(--blue600); background: var(--blue050); box-shadow: inset 0 0 0 1px var(--blue600); }
.choice:has(input:focus-visible) { outline: 3px solid var(--blue600); outline-offset: 2px; }

/* Lab catalogue */
.catalogue { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); margin: 0; padding: 0; list-style: none; }
.catalogue a {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    padding: 16px;
    border-radius: 4px;
    background: var(--white);
    box-shadow: var(--e100);
    color: var(--grey900);
    text-decoration: none;
    border: 1px solid transparent;
}
.catalogue a:hover { box-shadow: var(--e200); border-color: var(--blue200); }
.catalogue-name { font-weight: 500; font-size: 15px; }
.catalogue-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; color: var(--grey700); font-size: 12px; }

.diff { margin-top: 12px; padding: 10px 12px; border-radius: 4px; background: var(--grey100); color: var(--grey800); font-size: 13px; }
.diff p { margin: 0; }
.diff p + p { margin-top: 4px; }

.section-title { margin: 8px 0 12px; font-size: 13px; font-weight: 500; letter-spacing: 0.4px; text-transform: uppercase; color: var(--grey700); }
.catalogue-group + .catalogue-group { margin-top: 24px; }

.breadcrumb { margin: 0 0 8px; font-size: 13px; }
.breadcrumb a { text-decoration: none; }

@media (max-width: 600px) {
    .container { padding: 16px 12px 32px; }
    .page-title { font-size: 20px; line-height: 28px; }
    .headerbar-context { display: none; }
    .kv { grid-template-columns: 1fr; }
    .kv dt { padding-bottom: 0; border-bottom: 0; }
    th, td { padding: 8px 12px; }
    td code { font-size: 11px; }
}
`
