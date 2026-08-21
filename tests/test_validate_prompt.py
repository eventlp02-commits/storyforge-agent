from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "validate_prompt.py"


def load_validator():
    spec = importlib.util.spec_from_file_location("validate_prompt", MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load prompt validator")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


GOOD_PROMPT = (ROOT / "tests" / "fixtures" / "good_prompt.txt").read_text(
    encoding="utf-8"
)


class PromptValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.validator = load_validator()

    def test_accepts_copy_ready_local_timeline(self) -> None:
        self.assertEqual(self.validator.validate_prompt(GOOD_PROMPT, duration=15), [])

    def test_rejects_accumulated_or_gapped_timeline(self) -> None:
        prompt = """\
15-20秒：人物起身。
21-30秒：人物向前奔跑。
"""
        errors = self.validator.validate_prompt(prompt, duration=15)
        self.assertTrue(any("start at 0" in error for error in errors))
        self.assertTrue(any("gap" in error for error in errors))
        self.assertTrue(any("exceeds" in error for error in errors))

    def test_rejects_production_metadata_and_files(self) -> None:
        prompt = """\
# CLIP-02 prompt-only
直接引用 REF-001_main.png。
0-15秒：生成下一段。
"""
        errors = self.validator.validate_prompt(prompt, duration=15)
        joined = "\n".join(errors)
        self.assertIn("Markdown heading", joined)
        self.assertIn("internal ID", joined)
        self.assertIn("filename", joined)
        self.assertIn("production phrase", joined)

    def test_rejects_reverse_range(self) -> None:
        errors = self.validator.validate_prompt("0-5秒：开始。\n5-4秒：倒退。", duration=5)
        self.assertTrue(any("invalid range" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
