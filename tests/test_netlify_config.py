"""Netlify + Render deployment contract for the public demo."""
import tomllib
import unittest
from pathlib import Path


class NetlifyDeploymentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = tomllib.loads(
            (Path(__file__).resolve().parents[1] / "netlify.toml").read_text(encoding="utf-8")
        )

    def test_monorepo_build_configuration(self):
        build = self.config["build"]
        self.assertEqual(build["base"], "frontend")
        self.assertEqual(build["publish"], "dist")
        self.assertEqual(build["command"], "npm run build")
        self.assertEqual(build["environment"]["NODE_VERSION"], "22")

    def test_same_origin_api_proxy_precedes_spa_fallback(self):
        routes = self.config["redirects"]
        self.assertEqual(routes[0]["from"], "/api/*")
        self.assertEqual(routes[0]["to"], "https://terra360-api.onrender.com/api/:splat")
        self.assertEqual(routes[0]["status"], 200)
        self.assertTrue(routes[0]["force"])
        self.assertEqual(routes[1]["from"], "/*")
        self.assertEqual(routes[1]["to"], "/index.html")
        self.assertEqual(routes[1]["status"], 200)

    def test_no_secrets_in_public_build_environment(self):
        keys = set(self.config["build"]["environment"])
        self.assertNotIn("EARTHDATA_TOKEN", keys)
        self.assertNotIn("NASA_TOKEN", keys)
        self.assertNotIn("VITE_API_URL", keys)


if __name__ == "__main__":
    unittest.main()
