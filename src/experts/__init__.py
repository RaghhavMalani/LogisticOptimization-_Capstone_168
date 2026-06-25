"""Expert modules.

Each expert turns one messy raw source into a small, clean table of numerical
features keyed by (port_id, date), plus a per-row *confidence* score that drops
when inputs are missing. Experts never look into the future to build a feature
for a past date (see base.py helpers).
"""
