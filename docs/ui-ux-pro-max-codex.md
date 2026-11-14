# UI UX Pro Max — OpenAI Codex integration for BIOTEX

**Integrated as a repository-local skill**, not an application dependency.

- Location: `.agents/skills/ui-ux-pro-max/` (Codex's current supported path).
- Includes the official upstream SKILL instructions, Python search scripts, and full searchable design catalogs. Upstream project: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- MIT license credited in `.agents/skills/ui-ux-pro-max/LICENSE`.
- BIOTEX-specific instructions: root `AGENTS.md` and `design-system/biotex/MASTER.md`.
- No changes to frontend/backend runtime, packages or deploy configs.

## Validate with Python 3 (from repository root)

```powershell
python --version
python .agents/skills/ui-ux-pro-max/scripts/search.py "accessible agricultural dashboard" --domain ux
python .agents/skills/ui-ux-pro-max/scripts/search.py "React mobile forms and maps" --stack react
python .agents/skills/ui-ux-pro-max/scripts/search.py "agriculture decision support" --design-system -p BIOTEX
```

## Update using the official CLI

If updating later, compare the new upstream skill and check that local modifications stay outside the vendored directory. In PowerShell, at the project root:

```powershell
node --version
python --version
npm exec --yes --package=ui-ux-pro-max-cli@2.15.0 -- uipro init --ai codex --force
```

Node.js >=18 is needed **only for installation**; Python 3 runs the design search offline. `npm install -g` is optional, and unnecessarily changes your global Node installation. Review future package versions before replacing the pinned integration.

Codex should discover the skill when launched from the repository root. Restart the Codex session if it doesn't appear. The tool provides design guidance for future edits; installing it alone does not beautify the UI automatically.

## Safety before Vercel

No deployment environment variables or API URLs are changed by this integration. Independently verify `cd frontend; npm ci; npm run test; npm run build` and actual Vercel routing when that account is ready.
