# CLAUDE.md

## gstack

Use the /browse skill from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

Available skills:
- `/plan-ceo-review` — Founder/CEO mode: rethink the problem, find the 10-star product
- `/plan-eng-review` — Eng manager mode: architecture, data flow, edge cases, test matrix
- `/review` — Paranoid staff engineer: find bugs that pass CI but break prod
- `/ship` — Release engineer: sync main, run tests, push, open PR
- `/browse` — QA engineer: headless browser for testing, screenshots, verification
- `/qa` — QA lead: systematic testing with health scores and structured reports
- `/setup-browser-cookies` — Import cookies from your real browser for authenticated testing
- `/retro` — Engineering manager: team-aware retrospectives with metrics
- `/add-domain` — Add domain to Vercel + configure CNAME in Netlify DNS (default: exla.ai)

If gstack skills aren't working, run `cd .claude/skills/gstack && ./setup` to rebuild.
