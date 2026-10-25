import unittest
import json
from fastapi.testclient import TestClient
from api.index import app

class TestNicheScanBackend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_health(self):
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get("ok"))
        self.assertEqual(data.get("service"), "nichescan")

    def test_02_debug_path(self):
        resp = self.client.get("/api/debug-path")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("path"), "/api/debug-path")

    def test_03_demos_rotation(self):
        resp = self.client.get("/api/demos")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("demos", data)
        self.assertIn("set", data)
        self.assertEqual(len(data["demos"]), 5)
        self.assertEqual(data["set_count"], 7)
        self.assertEqual(data["window_seconds"], 180)

    def test_04_pfp_redirect(self):
        resp = self.client.get("/api/pfp?u=elonmusk", follow_redirects=False)
        self.assertEqual(resp.status_code, 302)
        self.assertIn("unavatar.io", resp.headers["location"])

    def test_05_track(self):
        resp = self.client.post("/api/track", json={"event": "download", "handle": "testuser", "vid": "v12345"})
        self.assertEqual(resp.status_code, 204)

    def test_06_scan_direct(self):
        resp = self.client.post("/api/scan", json={"username": "xlee_istheking", "src": "demo"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["username"], "xlee_istheking")
        self.assertTrue(len(data["niches"]) > 0)
        self.assertTrue(data["overall_score"] > 0)
        self.assertTrue(data["card_data_url"].startswith("data:image/png;base64,"))
        self.assertIn("followers", data)
        self.assertIn("impressions", data)

    def test_07_scan_streaming(self):
        resp = self.client.post("/api/scan?stream=1", json={"username": "elonmusk", "src": "typed"})
        self.assertEqual(resp.status_code, 200)
        lines = [json.loads(line) for line in resp.text.strip().split("\n") if line.strip()]
        steps = [l.get("step") for l in lines]
        self.assertIn("profile", steps)
        self.assertIn("posts", steps)
        self.assertIn("analyze", steps)
        self.assertIn("card", steps)
        self.assertIn("done", steps)
        
        done_step = next(l for l in lines if l.get("step") == "done")
        self.assertEqual(done_step["status"], 200)
        self.assertTrue(done_step["result"]["card_data_url"].startswith("data:image/png;base64,"))

    def test_08_static_files(self):
        resp = self.client.get("/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("NICHESCAN", resp.text)

        resp_css = self.client.get("/styles.css")
        self.assertEqual(resp_css.status_code, 200)

        resp_js = self.client.get("/app.js")
        self.assertEqual(resp_js.status_code, 200)

        resp_leaves = self.client.get("/leaves.js")
        self.assertEqual(resp_leaves.status_code, 200)

        resp_peng = self.client.get("/penguin.webp")
        self.assertEqual(resp_peng.status_code, 200)

    def test_09_stats_views(self):
        resp = self.client.get("/stats")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("stats", resp.text.lower())

        resp_auth = self.client.get("/stats/admin")
        self.assertEqual(resp_auth.status_code, 200)
        self.assertIn("Total Scans", resp_auth.text)

        resp_csv = self.client.get("/api/stats.csv")
        self.assertEqual(resp_csv.status_code, 200)
        self.assertIn("timestamp,event,handle", resp_csv.text)

if __name__ == "__main__":
    unittest.main()
