import unittest
import json
from fastapi.testclient import TestClient
from api.index import app

class TestNicheScanPro(unittest.TestCase):
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
        self.assertIn("NICHESCAN", resp_index.text)

        resp_stats = self.client.get("/stats/admin")
        self.assertEqual(resp_stats.status_code, 200)
        self.assertIn("Total Scans", resp_stats.text)

        resp_csv = self.client.get("/api/stats.csv")
        self.assertEqual(resp_csv.status_code, 200)

if __name__ == "__main__":
    unittest.main()
