import json, pathlib, re, unittest
P=pathlib.Path(__file__).with_name('commitment.json')
H=re.compile(r'^[0-9a-f]{64}$')
class T(unittest.TestCase):
 def test_commitment(self):
  d=json.loads(P.read_text())
  self.assertEqual(d['schema'],'opaque.private.exact_head.v1')
  self.assertTrue(H.fullmatch(d['source_head_sha256']))
  self.assertEqual(len(d['artifact_commitments']),3)
  self.assertTrue(all(H.fullmatch(x) for x in d['artifact_commitments'].values()))
  self.assertEqual(d['local_validation'],{'unit_tests_passed':4,'unit_tests_failed':0})
  self.assertEqual(d['disclosure'],'opaque_hashes_only')
if __name__=='__main__': unittest.main()
