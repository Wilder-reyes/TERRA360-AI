"""Smoke checks for the vendored, offline UI UX Pro Max Codex skill.

These use only Python's standard library and do not modify the working app.
"""
from pathlib import Path
import subprocess
import sys
import unittest


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / ".agents" / "skills" / "ui-ux-pro-max"
SEARCH = SKILL / "scripts" / "search.py"


class CodexDesignSkillTests(unittest.TestCase):
    def test_codex_skill_metadata_and_assets(self):
        manifest = (SKILL / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("name: ui-ux-pro-max", manifest)
        self.assertIn(".agents/skills/ui-ux-pro-max/scripts/search.py", manifest)
        self.assertNotIn("{{SCRIPT_PATH}}", manifest)
        for required in ("scripts/core.py", "scripts/design_system.py",
                         "data/styles.csv", "data/ux-guidelines.csv",
                         "data/stacks/react.csv", "LICENSE"):
            with self.subTest(required=required):
                self.assertTrue((SKILL / required).is_file())

    def test_offline_ux_search_runs(self):
        result = subprocess.run(
            [sys.executable, str(SEARCH), "accessible mobile map", "--domain", "ux"],
            cwd=str(ROOT), capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=20, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr[:1500])
        self.assertTrue(result.stdout.strip(), "The UX catalog search returned no text.")


if __name__ == "__main__":
    unittest.main()
