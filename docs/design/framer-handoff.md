# Framer → Vue handoff

Framer project: https://framer.com/projects/PMO--STom7jCmgSh7YkuQlZOB-dM83E?node=augiA20Il

## Design direction
Enterprise PMO workspace, information-dense but calm, with clear hierarchy, predictable navigation, explicit status indicators and responsive layouts.

## Required screens
Dashboard; project portfolio; project detail (overview/tasks/timeline/RAID/team); task board and list; executive status reports; resource capacity; timesheets; user/role settings; login.

## Component inventory
App shell, collapsible sidebar, topbar, breadcrumb, KPI card, project health badge, data table, filters, tabs, form fields, date picker, modal/drawer, toast, Gantt wrapper, report preview.

## Accessibility and interaction
WCAG AA contrast, keyboard-visible focus, semantic tables, labels, error descriptions, non-color-only status indicators, responsive layouts at mobile/tablet/desktop widths.

## Implementation mapping
Framer is the visual specification; runtime screens remain Vue SFCs. Prefer tokens and reusable components rather than copying generated Framer React code. Verify each screen against the design at multiple viewport widths.

## Status
This file records the handoff specification; the Framer canvas has not yet been redesigned.
