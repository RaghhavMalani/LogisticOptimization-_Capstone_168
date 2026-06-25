"""Analytics layer for India PortWatch.

Port-wise and India-wide analytics on top of the monthly major-port data and the
forecasts/decisions:

    kpis.py          operational KPIs + trends (MoM/YoY) + seasonality
    benchmarking.py  port league tables + composite efficiency score
    anomaly.py       statistical anomaly detection / early warning
    cargo.py         cargo & commodity-mix analytics
    demand.py        demand / trade-pressure analytics
    financial.py     rupee value-at-risk, demurrage, revenue analytics
    india_overview.py national aggregates ("business" view)
    backtest.py      scenario-engine validation vs historical analogs
    runner.py        runs everything and writes outputs/analytics/
"""
