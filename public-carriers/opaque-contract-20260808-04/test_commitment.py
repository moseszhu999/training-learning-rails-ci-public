import hashlib
import json
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).parent
MANIFEST = ROOT / "commitment.json"
HEX64 = re.compile(r"^[0-9a-f]{64}$")

class OpaqueCommitmentTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(MANIFEST.read_text(encoding="utf-8"))

    def test_commitments(self):
        self.assertTrue(HEX64.fullmatch(self.data["source_head_sha256"]))
        items = self.data["artifact_commitments"]
        self.assertEqual(list(items), ["artifact_1", "artifact_2", "artifact_3"])
        self.assertEqual(len(set(items.values())), 3)
        self.assertTrue(all(HEX64.fullmatch(v) for v in items.values()))

    def test_bundle(self):
        items = self.data["artifact_commitments"]
        payload = "".join(f"{k}\0{v}\n" for k, v in items.items()).encode()
        self.assertEqual(hashlib.sha256(payload).hexdigest(), self.data["bundle_sha256"])

    def test_disclosure_flags(self):
        d = self.data["disclosure"]
        self.assertEqual(d["classification"], "opaque_hashes_only")
        for k, v in d.items():
            if k != "classification":
                self.assertFalse(v)

    def test_private_ci_marker(self):
        v = self.data["local_exact_content_validation"]
        self.assertEqual(v["private_ci_step_execution"], "unavailable")
        self.assertEqual(v["public_commitment_tests_failed"], 0)

if __name__ == "__main__":
    unittest.main()
