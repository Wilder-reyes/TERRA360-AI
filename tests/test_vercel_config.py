"""Single static frontend configuration; no inherited provider or secret."""
import json
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class VercelStaticOnlyTests(unittest.TestCase):
    def test_single_frontend_root_static_and_no_functions(self):
        config=json.loads((ROOT/'frontend/vercel.json').read_text())
        self.assertEqual(config['framework'],'vite')
        self.assertEqual(config['outputDirectory'],'dist')
        self.assertEqual(config['buildCommand'],'npm run build')
        self.assertEqual(config['installCommand'],'npm ci')
        for forbidden in ['services','functions','builds','crons','env','rewrites']:self.assertNotIn(forbidden,config)
        for name in ['vercel.json','.vercelignore','render.yaml']:self.assertFalse((ROOT/name).exists())
    def test_frontend_build_has_no_backend_and_public_environment_has_no_secret(self):
        self.assertIn('e2e/',(ROOT/'frontend/.vercelignore').read_text())
        for name in ['.env.example','.env.production.example']:
            text=(ROOT/'frontend'/name).read_text()
            assignments=[row.split('=',1)[0] for row in text.splitlines() if row and not row.startswith('#')]
            self.assertEqual(assignments,['VITE_API_URL'])
        text=(ROOT/'frontend/src/network.ts').read_text()
        self.assertIn('apiOrigin(import.meta.env.VITE_API_URL,import.meta.env.DEV)',text)
        self.assertNotIn('onrender.com',text)
    def test_no_obsolete_publication_and_no_site_address_in_release(self):
        for name in ['netlify.toml','.github/workflows/pages.yml','.github/workflows/smoke-production.yml']:self.assertFalse((ROOT/name).exists())
        release=json.loads((ROOT/'frontend/public/release.json').read_text())
        self.assertNotIn('primary_url',release)
        self.assertNotIn('experimental_pilots',release)
        self.assertFalse(release['computer_vision_enabled'])
if __name__=='__main__':unittest.main()
