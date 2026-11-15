"""Contract: Vercel hosts ONLY Vite frontend; all API requests proxy to Render."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class VercelStaticOnlyTests(unittest.TestCase):
    def test_both_root_directory_modes_static_and_no_functions(self):
        for path, expected_dist in (
            ("vercel.json", "frontend/dist"),
            ("frontend/vercel.json", "dist"),
        ):
            with self.subTest(path=path):
                config = json.loads((ROOT / path).read_text(encoding="utf-8"))
                self.assertEqual(config["framework"], "vite")
                self.assertEqual(config["outputDirectory"], expected_dist)
                self.assertNotIn("services", config)
                self.assertNotIn("functions", config)
                self.assertNotIn("builds", config)
                self.assertNotIn("crons", config)
                self.assertNotIn("env", config)
                self.assertNotIn("EARTHDATA_TOKEN", json.dumps(config))

                rewrites = config["rewrites"]
                self.assertEqual(rewrites[0], {
                    "source": "/api/:path*",
                    "destination": "https://terra360-api.onrender.com/api/:path*",
                })
                self.assertEqual(rewrites[1], {
                    "source": "/(.*)",
                    "destination": "/index.html",
                })

    def test_root_build_only_uses_frontend(self):
        config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
        self.assertIn("frontend", config["installCommand"])
        self.assertIn("frontend", config["buildCommand"])
        self.assertNotIn("backend", config["buildCommand"])
        ignore = (ROOT / ".vercelignore").read_text(encoding="utf-8")
        self.assertIn("backend/", ignore)

    def test_no_obsolete_netlify_service_config(self):
        self.assertFalse((ROOT / "netlify.toml").exists())
        self.assertFalse((ROOT / "tests" / "test_netlify_config.py").exists())


if __name__ == "__main__":
    unittest.main()
