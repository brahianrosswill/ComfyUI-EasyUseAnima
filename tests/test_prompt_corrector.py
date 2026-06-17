from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from nodes import EasyUseAnimaPromptCorrector


class PromptCorrectorTests(unittest.TestCase):
    def test_corrects_without_animadex_data(self):
        corrected, report = EasyUseAnimaPromptCorrector().correct(
            "long_hair, 1girl, long_hair",
            "prompt",
            True,
            True,
            "",
            "",
            "",
            "",
            "",
            "",
        )

        self.assertEqual(corrected, "1girl, @no-artist, long hair")
        data = json.loads(report)
        self.assertEqual(data["duplicate_tags"], ["long hair"])

    def test_uses_animadex_indexes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            character_index = root / "character_index.jsonl"
            artist_index = root / "artist_index.jsonl"
            character_index.write_text(
                json.dumps(
                    {
                        "character": "hatsune miku",
                        "copyright": "vocaloid",
                        "trigger": "hatsune miku, vocaloid",
                        "trigger_character": "hatsune miku",
                        "trigger_copyright": "vocaloid",
                        "core_tags": ["1girl"],
                        "count": 1,
                        "url": "",
                    },
                    ensure_ascii=False,
                )
                + "\n",
                encoding="utf-8",
            )
            artist_index.write_text(
                json.dumps(
                    {
                        "artist": "artist name",
                        "trigger": "artist name",
                        "count": 1,
                        "url": "",
                    },
                    ensure_ascii=False,
                )
                + "\n",
                encoding="utf-8",
            )

            corrected, report = EasyUseAnimaPromptCorrector().correct(
                "long_hair, vocaloid, @artist_name, hatsune_miku, 1girl",
                "prompt",
                True,
                True,
                "",
                "",
                "",
                "",
                str(character_index),
                str(artist_index),
            )

        self.assertEqual(
            corrected,
            "1girl, hatsune miku, vocaloid, @artist_name, long hair",
        )
        data = json.loads(report)
        self.assertEqual(
            data["sections"],
            ["count", "character", "copyright", "artist", "unknown"],
        )


if __name__ == "__main__":
    unittest.main()
