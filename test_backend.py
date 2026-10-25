import unittest
import json
from fastapi.testclient import TestClient
from api.index import app

class TestCloutRadar(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_health(self):
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get("ok"))
        self.assertEqual(data.get("version"), "2.0.0")

    def test_02_demos_rotation(self):
        resp = self.client.get("/api/demos")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data["demos"]), 5)
        self.assertEqual(data["set_count"], 7)

    def test_03_trending(self):
        resp = self.client.get("/api/trending")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("trending", data)
        self.assertTrue(len(data["trending"]) > 0)

    def test_04_scan_themes_and_story(self):
        # Test scan with matrix_emerald theme
        resp = self.client.post("/api/scan", json={
            "username": "vitalikbuterin",
            "src": "demo",
            "theme": "matrix_emerald"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["username"].lower(), "vitalikbuterin")
        self.assertTrue(data["card_data_url"].startswith("data:image/png;base64,"))
        self.assertTrue(data["story_card_data_url"].startswith("data:image/png;base64,"))
        self.assertIn("radar_scores", data)
        self.assertIn("roast", data)
        self.assertIn("superpower", data)
        self.assertIn("vibe", data)
        self.assertEqual(data["theme"], "matrix_emerald")

    def test_05_streaming_scan(self):
        resp = self.client.post("/api/scan?stream=1", json={
            "username": "sama",
            "src": "typed",
            "theme": "glacier_blue"
        })
        self.assertEqual(resp.status_code, 200)
        lines = [json.loads(line) for line in resp.text.strip().split("\n") if line.strip()]
        steps = [l.get("step") for l in lines]
        self.assertIn("profile", steps)
        self.assertIn("posts", steps)
        self.assertIn("analyze", steps)
        self.assertIn("card", steps)
        self.assertIn("done", steps)

    def test_06_battle_compare(self):
        resp = self.client.post("/api/compare", json={
            "user1": "sama",
            "user2": "elonmusk",
            "theme": "crimson_degen"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("victor", data)
        self.assertIn("user1", data)
        self.assertIn("user2", data)
        self.assertTrue(data["battle_card_data_url"].startswith("data:image/png;base64,"))

    def test_07_stats_and_static(self):
        resp_index = self.client.get("/")
        self.assertEqual(resp_index.status_code, 200)
        self.assertIn("CLOUTRADAR", resp_index.text)

        resp_stats = self.client.get("/stats/admin")
        self.assertEqual(resp_stats.status_code, 200)
        self.assertIn("Total Scans", resp_stats.text)

        resp_csv = self.client.get("/api/stats.csv")
        self.assertEqual(resp_csv.status_code, 200)

    def test_08_xlee_and_fallback_resilience(self):
        # Test xlee_istheking (the demo chip that previously 404ed)
        resp1 = self.client.post("/api/scan", json={"username": "xlee_istheking", "theme": "cyber_violet"})
        self.assertEqual(resp1.status_code, 200)
        d1 = resp1.json()
        self.assertEqual(d1["username"], "xlee_istheking")
        self.assertTrue(d1["card_data_url"].startswith("data:image/png;base64,"))
        self.assertGreater(d1["followers"], 1000)

        # Test completely unknown username (should never 500 or return undefined)
        resp2 = self.client.post("/api/scan", json={"username": "random_ghost_anon_998877", "theme": "cyber_violet"})
        self.assertEqual(resp2.status_code, 200)
        d2 = resp2.json()
        self.assertEqual(d2["username"], "random_ghost_anon_998877")
        self.assertTrue(d2["card_data_url"].startswith("data:image/png;base64,"))
        self.assertIn("overall_score", d2)

if __name__ == "__main__":
    unittest.main()
