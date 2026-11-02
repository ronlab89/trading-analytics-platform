# FE2.3 Dashboard: distribution, risk level and top movers

Source: Figma pages "Inicio" (desktop `105:21881`) and "Gráficos · Especificación" `96:13613` (distribution `96:13733`, top movers `96:13864`, risk gauge `96:13706`); the overview read model `GET /portfolios/:portfolioId/overview` (`allocation`, `pulse.volatility`, `positions[].dailyChange`, `summary.investedValue`). Branch: `feat/fe2-3-dashboard-distribution-risk`.

All three panels read what the overview already carries, so this slice adds no request.

## Tasks

- [x] T1 "Mayores movimientos": `topMovers` and `MoversPanel` (horizontal divergent bars)
- [x] T2 "Distribución": `toAllocationSlices` and `DistributionPanel` (concentric rings in Recharts, legend)
- [x] T3 "Nivel de riesgo": gauge geometry and `RiskPanel` (dark folder card, 3-step gauge)
- [x] T4 Page layout (12-column grid on the desktop), e2e on the three widths, notes

## Decisions

- The gauge has three steps because the API classifies volatility in three (`LOW`, `MODERATE`, `HIGH`, plus `UNKNOWN`). It does not invent a 1 to 5 level.
- The volatility the API gives is annualized, so the panel says "Annualized volatility" and not the Figma's "volatilidad 30 d".
- Moderate and high carry the "Alerta" badge. Unknown shows no needle and no badge.
- The distribution shows the four largest assets and the rest together as "Otros".
- The rings and the gauge are hidden from screen readers; the legend and the written level carry every figure.
- The movers percentage sits in a fixed column at the right of the row, not next to the end of each bar, so it never overflows on a phone.
- Desktop layout (12 columns): value 6 + performance 6; total return 3 + risk 3 + distribution 6; daily returns 12; recent transactions 8 + top movers 4. Below the desktop everything is one column. With no positions only the value, the total return and the recent transactions show.

## Left out, to pick up later

| Left out                                                                 | Why                                                    | When                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------ | ----------------------------- |
| "Nivel 3 de 5" (five-step risk scale)                                    | The API has three classes, no 1 to 5 level             | needs a backend field         |
| "Umbral de riesgo superado hace 2 d" under the gauge                     | Needs alert events                                     | FE3                           |
| "volatilidad 30 d"                                                       | The API gives annualized volatility                    | decide with design or backend |
| ↗ buttons on "Nivel de riesgo", "Distribución" and "Mayores movimientos" | Need the Analytics page                                | FE3                           |
| "Efectivo" ring with the hatched pattern                                 | The allocation has no cash group; rings are flat color | when the API sends cash       |
| Money in the legend without cents ("$42,646")                            | Written with cents like every other amount             | decide with design            |
| Movers percentage next to the end of each bar                            | Fixed right column instead                             | optional                      |
| "Requiere atención" panel (alerts, info, completed events)               | Needs an events source                                 | FE3                           |
| Distribution grouped by something other than asset                       | The overview carries the allocation by asset only      | when needed                   |
