# FE2.1 Dashboard: base and number panels

Source: Figma page "Inicio" (desktop `105:21881`, empty `104:20187`, error `104:20387`, loading `104:19455`, tablet `357:174946`, mobile `309:169876`); `docs/15-implementation-plan.md` (FE2); the overview read model `GET /portfolios/:portfolioId/overview` (`packages/contracts/src/overview.response.ts`). Branch: `feat/fe2-1-dashboard`.

FE2 is split in three slices: FE2.1 (this one: base, value, total return, recent transactions), FE2.2 (charts), FE2.3 (distribution, movers, risk).

## Tasks

- [x] T1 `useOverview` hook (one request for the whole dashboard)
- [x] T2a `DashboardHeader` (day, portfolio, positions, "Actualizado")
- [x] T2b `DashboardPage` with loading, empty and error states; the overview refreshes after recording a transaction
- [x] T3 "Hola, Jane" value panel
- [x] T4 "Retorno total" panel
- [x] T5 "Transacciones recientes" panel
- [x] T6 e2e layout at the three widths, look against the Figma, `pr-body.md`

## Left out on purpose (pick these up later)

What the Figma draws and this slice does not, with the reason and where it belongs.

| Left out                                                                                                                             | Why                                                                                                                                                                                             | Picks up in                   |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| "Rendimiento mensual" bars inside the value panel                                                                                    | A chart; needs the chart library decision                                                                                                                                                       | FE2.2                         |
| "Rendimiento" line chart with 1S / 1M / 3M / Año / Todo                                                                              | A chart. The API takes `period` on the performance endpoint; the overview carries only the default 1M                                                                                           | FE2.2                         |
| The S&P 500 line and its "+4.10%"                                                                                                    | The API has no benchmark series                                                                                                                                                                 | needs a backend block first   |
| "Rendimiento diario" bars and its stats (best day, worst day, positive days, average, streak)                                        | A chart; the stats must be derived from `performance.series`                                                                                                                                    | FE2.2                         |
| "Distribución" rings and its legend                                                                                                  | Chart; data is `allocation`                                                                                                                                                                     | FE2.3                         |
| "Nivel de riesgo" gauge ("Moderado", "Nivel 3 de 5", "volatilidad 30 d")                                                             | Chart; data is `pulse`. "Nivel 3 de 5" and "Umbral de riesgo superado hace 2 d" have no API field                                                                                               | FE2.3                         |
| "Mayores movimientos"                                                                                                                | Data is `positions[].dailyChange`; a bar chart                                                                                                                                                  | FE2.3                         |
| "Requiere atención" (alerts, info, completed events)                                                                                 | Needs the alerts and notifications API and its realtime client                                                                                                                                  | FE3                           |
| Per-panel errors with "Reintentar" in each panel                                                                                     | One overview request fails as a whole, so there is one error with one "Reintentar". Becomes per panel only if the panels get their own requests (performance with a period, for example)        | FE2.2                         |
| "Ver análisis" button in the header and the ↗ buttons of "Retorno total" and "Rendimiento"                                           | The analysis screen does not exist yet. The ↗ of the value panel links to the portfolio screen instead                                                                                          | the Análisis screen (FE2)     |
| "En vivo", "Sincronizado hace 3 s", "Cálculo al día" and the alert counter in the status bar                                         | Realtime client and alerts. "Actualizado hh:mm:ss" is the time of the last fetch, not a live feed                                                                                               | FE3                           |
| The `TX-…` code under each date in "Transacciones recientes"                                                                         | Ids are UUIDs, the API has no short code                                                                                                                                                        | needs a backend field         |
| Opening the transaction detail from the desktop and tablet table of "Transacciones recientes"                                        | The Figma draws no row action there; on the phone the card opens the detail                                                                                                                     | decide with the Figma         |
| "Retorno total" since the start of the portfolio (realized plus unrealized)                                                          | The overview has the unrealized result (`summary.unrealizedPnL`) and `performance.pnl` for a period, not the all-time total. The panel says "Resultado sin realizar de tus posiciones abiertas" | needs a backend field         |
| The three-tab row layout of the Figma (Retorno total, Nivel de riesgo, Distribución side by side) and the top row Hola + Rendimiento | Only two of the panels exist, so the grid is two columns for now                                                                                                                                | rearranged in FE2.2 and FE2.3 |
| Mobile order of the panels (Figma: value, Rendimiento, recent transactions, Retorno total, risk)                                     | Only three panels exist; they stack in the order value, Retorno total, recent transactions                                                                                                      | rearranged in FE2.2 and FE2.3 |
| Sorting arrows on the headers of "Transacciones recientes"                                                                           | The overview sends the latest five in a fixed order                                                                                                                                             | not planned                   |

## Log

- L1 (2026-11-02): "si vamos con el dashboard" → partition approved: FE2.1 base + number panels, FE2.2 charts, FE2.3 distribution and risk.
- L2 (2026-11-02): "lo que dejes fuera porque aun no existe con que conectar o algo por el estilo dejalo anotado para poder retomarlo en el futuro" → the table above.
