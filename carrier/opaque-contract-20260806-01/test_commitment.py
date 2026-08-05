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
        cls.raw = MANIFEST.read_text(encoding="utf-8")
        cls.data = json.loads(cls.raw)

    def test_commitments_are_well_formed_and_unique(self):
        self.assertTrue(HEX64.fullmatch(self.data["source_head_sha256"]))
        artifacts = self.data["artifact_commitments"]
        self.assertEqual(list(artifacts), ["artifact_1", "artifact_2", "artifact_3"])
        self.assertEqual(len(set(artifacts.values())), 3)
        for digest in artifacts.values():
            self.assertTrue(HEX64.fullmatch(digest))

    def test_bundle_commitment_recomputes(self):
        payload = "".join(
            f"{label}\0{digest}\n"
            for label, digest in self.data["artifact_commitments"].items()
        ).encode("utf-8")
        self.assertEqual(hashlib.sha256(payload).hexdigest(), self.data["bundle_sha256"])

    def test_local_validation_receipt_is_bounded(self):
        receipt = self.data["local_exact_content_validation"]
        self.assertEqual(receipt, {
            "json_parse": "not_applicable",
            "unit_tests_passed": 3,
            "unit_tests_failed": 0,
        })

    def test_public_payload_is_opaque(self):
        disclosure = self.data["disclosure"]
        self.assertEqual(disclosure["classification"], "opaque_hashes_only")
        for key, value in disclosure.items():
            if key != "classification":
                self.assertFalse(value)
        forbidden = (
            "newonly2",
            "production/",
            "research/market_data_hf",
            "0e61e05c2a2898863d43d1933fd6d6df039ab8e8",
            "hf_token",
            "aws_access_key",
            "private_key",
            "sk-",
        )
        lowered = self.raw.lower()
        for token in forbidden:
            self.assertNotIn(token.lower(), lowered)


if __name__ == "__main__":
    unittest.main()
