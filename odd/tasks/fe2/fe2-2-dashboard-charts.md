# FE2.2 Dashboard: performance charts

Source: Figma pages "Inicio" (desktop `105:21881`) and "Gráficos · Especificación" `96:13613` (monthly `96:13619`, line + area `96:13667`, daily bars `96:13786`); the performance read model `GET /api/v1/portfolios/:portfolioId/analytics/performance` (`packages/contracts/src/performance.response.ts`). Branch: `feat/fe2-2-dashboard-charts`. Library: Recharts (the Figma charts are drawn with it).

## Tasks

- [x] T1 `usePerformance(portfolioId, period)` hook; recording a transaction refreshes it
- [x] T2 Pure calculations: daily stats, monthly returns, last returns window, axis money format
- [x] T3 "Rendimiento" panel: line + area, period tabs, tooltip, text summary, own states
- [x] T4 "Rendimiento diario" panel: divergent bars + five stats, own states
- [x] T5 "Rendimiento mensual" bars inside the value panel, own states
- [x] T6 Page layout, e2e on the three widths, notes

## Decisions

- Each chart panel asks for its own data (`1M` selectable, `3M` for the daily bars, `6M` for the monthly bars), so each loads, fails and retries on its own. A failing chart never takes the overview down.
- "Año" is the `YTD` preset. The period selector is a group of toggle buttons, not Radix Tabs, because there is a single chart to control.
- The monthly bars are plain markup (no axes to draw); the line and the daily bars are Recharts.
- The charts are left out while the portfolio holds no positions.
- Each chart has a sentence for screen readers (start, end, high, low; or best and worst day), and respects `prefers-reduced-motion`.
- The API contract validates `asOf` as a calendar date (`YYYY-MM-DD`); the e2e mock and the fixtures use that shape.

## Left out, to pick up later

| Left out                                                                        | Why                                                                             | When                  |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------- |
| S&P 500 dashed line, legend with each series' % and "+4.10%"                    | The API has no benchmark series                                                 | needs a backend field |
| Legend above the line ("Portafolio +6.12%")                                     | Only the portfolio series exists; add with the benchmark                        | with the benchmark    |
| Subtitle "Valor del portafolio vs S&P 500 · 1M · USD" on "Rendimiento"          | Depends on the benchmark                                                        | with the benchmark    |
| ↗ button on "Rendimiento" and on "Rendimiento diario"                           | Needs the Analytics page                                                        | FE3                   |
| Daily best/worst day with one decimal (`+2.4%`)                                 | Written with two decimals like the rest of the percentages                      | decide with design    |
| Streak written "4 días ▲"                                                       | Written "2 days up ▲" so the direction is also text                             | decide with design    |
| Daily bars window is the last 30 days with a return, not strictly business days | The series already holds only market days; revisit if it ever includes weekends | if the API changes    |
| Figma panel arrangement                                                         | Done in FE2.3 (12-column layout)                                                | done                  |
| "Mayores movimientos", "Nivel de riesgo", "Distribución"                        | Done in FE2.3                                                                   | done                  |
| Tab selector as Radix Tabs                                                      | Toggle buttons were enough                                                      | optional              |
