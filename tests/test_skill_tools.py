from __future__ import annotations

import csv
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

from lint_copy_ready_prompt import lint_prompt  # noqa: E402


GOOD_PROMPT = """\
以@视频1最后一个稳定画面为开场，保持人物站位、机位高度和光线方向不变。@图片1锁定人物外观。
0-3秒：人物从半蹲抬眼，镜头低机位缓慢后移，风声保持低沉。
3-8秒：人物站起并把武器移到身侧，冷光沿地面推进，甲片发出轻响。
8-15秒：人物转向高处阴影并进入戒备，镜头停止移动，只保留呼吸和碎石落地声。
语言：中文。无配乐。动作连续，不重复起身，不瞬移。
"""


class PromptLintTests(unittest.TestCase):
    def test_accepts_local_timing_and_model_references(self) -> None:
        self.assertEqual(lint_prompt(GOOD_PROMPT, duration=15), [])

    def test_rejects_accumulated_timing(self) -> None:
        prompt = "15-20秒：人物抬头。\n20-30秒：人物离开。"
        errors = lint_prompt(prompt, duration=15)
        self.assertTrue(any("must start at 0" in item for item in errors))
        self.assertTrue(any("exceeds Clip duration" in item for item in errors))

    def test_rejects_internal_filename_and_explanation(self) -> None:
        prompt = (
            "上图只是制作板，直接引用 REF-001_villager-squad.png。\n"
            "0-15秒：人物向前走。"
        )
        errors = lint_prompt(prompt, duration=15)
        self.assertTrue(any("Forbidden prompt phrase" in item for item in errors))
        self.assertTrue(any("internal asset ID" in item for item in errors))
        self.assertTrue(any("filename or file extension" in item for item in errors))


class ProjectValidationTests(unittest.TestCase):
    def run_tool(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, *args],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )

    def test_scaffold_validates_and_clip_two_requires_actual_end(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            init = self.run_tool(
                str(SCRIPTS / "init_video_project.py"),
                "--output",
                str(output),
                "--title",
                "测试项目",
                "--type",
                "narrative-short",
                "--duration",
                "60",
                "--clip-duration",
                "15",
            )
            self.assertEqual(init.returncode, 0, init.stdout + init.stderr)
            project_root = Path(init.stdout.strip())

            initial = self.run_tool(
                str(SCRIPTS / "validate_video_project.py"),
                str(project_root),
            )
            self.assertEqual(initial.returncode, 0, initial.stdout + initial.stderr)

            clip_one = project_root / "03_clips/CLIP-01"
            metadata = json.loads((clip_one / "clip.json").read_text(encoding="utf-8"))
            metadata["status"] = "waiting_for_result"
            (clip_one / "clip.json").write_text(
                json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            (clip_one / "prompt.txt").write_text(GOOD_PROMPT, encoding="utf-8")
            with (clip_one / "shot_plan.csv").open(
                "w",
                encoding="utf-8-sig",
                newline="",
            ) as handle:
                writer = csv.DictWriter(
                    handle,
                    fieldnames=[
                        "shot_id",
                        "start_s",
                        "end_s",
                        "duration_s",
                        "scene_job",
                        "shot_size",
                        "camera_position",
                        "camera_motion",
                        "blocking_and_action",
                        "lighting",
                        "dialogue",
                        "voiceover",
                        "ambience",
                        "sfx",
                        "music",
                        "transition",
                        "continuity",
                        "status",
                    ],
                )
                writer.writeheader()
                writer.writerow(
                    {
                        "shot_id": "CLIP-01-S01",
                        "start_s": "0",
                        "end_s": "15",
                        "duration_s": "15",
                        "status": "planned",
                    }
                )

            clip_two = project_root / "03_clips/CLIP-02"
            (clip_two / "result").mkdir(parents=True)
            (clip_two / "prompt.txt").write_text(GOOD_PROMPT, encoding="utf-8")
            (clip_two / "director_card.json").write_text(
                json.dumps({"clip_id": "CLIP-02"}, ensure_ascii=False),
                encoding="utf-8",
            )
            (clip_two / "clip.json").write_text(
                json.dumps(
                    {
                        "clip_id": "CLIP-02",
                        "clip_index": 2,
                        "planned_duration_s": 15,
                        "local_start_s": 0,
                        "prior_clip_id": "CLIP-01",
                        "requires_prior_actual_end_state": True,
                        "prompt_path": "03_clips/CLIP-02/prompt.txt",
                        "status": "prompt_ready",
                    },
                    ensure_ascii=False,
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )
            source_header = clip_one / "shot_plan.csv"
            (clip_two / "shot_plan.csv").write_bytes(source_header.read_bytes())

            project = json.loads((project_root / "project.json").read_text(encoding="utf-8"))
            project["current_clip_id"] = "CLIP-02"
            (project_root / "project.json").write_text(
                json.dumps(project, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

            blocked = self.run_tool(
                str(SCRIPTS / "validate_video_project.py"),
                str(project_root),
            )
            self.assertNotEqual(blocked.returncode, 0)
            self.assertIn("is not end_locked or completed", blocked.stdout)
            self.assertIn("missing CLIP-01 actual_end_state.json", blocked.stdout)

    def test_create_next_clip_inherits_locked_actual_end(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            init = self.run_tool(
                str(SCRIPTS / "init_video_project.py"),
                "--output",
                str(output),
                "--title",
                "连续性测试",
                "--type",
                "narrative-short",
                "--duration",
                "45",
                "--clip-duration",
                "15",
            )
            self.assertEqual(init.returncode, 0, init.stdout + init.stderr)
            project_root = Path(init.stdout.strip())
            clip_one = project_root / "03_clips/CLIP-01"

            metadata = json.loads((clip_one / "clip.json").read_text(encoding="utf-8"))
            metadata["status"] = "end_locked"
            (clip_one / "clip.json").write_text(
                json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            (clip_one / "prompt.txt").write_text(GOOD_PROMPT, encoding="utf-8")
            actual_end = {
                "clip_id": "CLIP-01",
                "actual_duration_s": 14.8,
                "last_stable_frame_s": 14.6,
                "subjects": [
                    {
                        "name": "主角",
                        "screen_position": "画面右侧",
                        "pose": "半蹲",
                        "action_phase": "recovery",
                    }
                ],
                "camera": {},
                "lighting": {},
                "environment": {},
                "audio_tail": {},
                "deviations_from_plan": ["镜头提前停止推进"],
            }
            (clip_one / "actual_end_state.json").write_text(
                json.dumps(actual_end, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

            created = self.run_tool(
                str(SCRIPTS / "create_next_clip.py"),
                str(project_root),
                "--duration",
                "12",
            )
            self.assertEqual(created.returncode, 0, created.stdout + created.stderr)

            clip_two = project_root / "03_clips/CLIP-02"
            director_card = json.loads(
                (clip_two / "director_card.json").read_text(encoding="utf-8")
            )
            self.assertEqual(director_card["start_state"], actual_end)
            self.assertEqual(director_card["continuity_risks"], ["镜头提前停止推进"])

            validated = self.run_tool(
                str(SCRIPTS / "validate_video_project.py"),
                str(project_root),
            )
            self.assertEqual(validated.returncode, 0, validated.stdout + validated.stderr)


if __name__ == "__main__":
    unittest.main()
