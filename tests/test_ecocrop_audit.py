"""ECOCROP audit should flag missing and inconsistent source data without repair."""
import unittest
from scripts.audit_ecocrop import audit, inspect_row


class EcocropAuditTests(unittest.TestCase):
    def test_missing_fields_and_inversion(self):
        flags = inspect_row({"ecology": {"tmin": 40, "tmax": 10, "phmin": 160}})
        self.assertIn("inverted_range:tmin/tmax", flags)
        self.assertIn("outside_broad_bounds:phmin", flags)
        self.assertIn("missing:rmin", flags)

    def test_optimum_outside_general(self):
        flags = inspect_row({"ecology": {
            "tmin": 0, "tmax": 40, "topmn": 5, "topmx": 45,
        }})
        self.assertIn("optimum_outside_general:topmn/topmx", flags)

    def test_no_inferred_flags_for_absent_pairs(self):
        flags = inspect_row({"ecology": {"tmin": None, "tmax": None}})
        self.assertNotIn("inverted_range:tmin/tmax", flags)

    def test_audit_preserves_values_and_provenance(self):
        row = {"id": "ecocrop_1", "scientific_name": "Testus plantus",
               "ecology": {"tmin": 160}}
        source = {"locally_validated": False, "species": [row],
                  "sha256": "pinned", "source": "FAO"}
        before = row["ecology"].copy()
        report = audit(source)
        self.assertEqual(row["ecology"], before)
        self.assertEqual(report["source_sha256"], "pinned")
        self.assertEqual(report["records"], 1)
        self.assertEqual(report["records_with_flags"], 1)
        self.assertIn("outside_broad_bounds:tmin", report["records_flagged"][0]["flags"])
        self.assertFalse(report["locally_validated"])

    def test_duplicate_identifier_rejected(self):
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            audit({"locally_validated": False, "species": [
                {"id": "x", "ecology": {}}, {"id": "x", "ecology": {}}
            ]})

    def test_no_local_validation_claim(self):
        with self.assertRaises(ValueError):
            audit({"locally_validated": True, "species": []})

    def test_bools_not_numbers(self):
        self.assertIn("invalid_number:tmin", inspect_row({"ecology": {"tmin": True}}))


if __name__ == "__main__":
    unittest.main()
