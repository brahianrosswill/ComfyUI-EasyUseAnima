import importlib.util
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]


def load_api_module():
    package_name = "easyuse_anima_profile_test_package"
    package = types.ModuleType(package_name)
    package.__path__ = [str(ROOT)]
    sys.modules[package_name] = package

    spec = importlib.util.spec_from_file_location(
        f"{package_name}.api",
        ROOT / "api.py",
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class LoraProfileStorageTests(unittest.TestCase):
    def test_api_import_tolerates_prompt_server_without_instance(self):
        fake_server = types.ModuleType("server")
        fake_server.PromptServer = type("PromptServer", (), {})
        fake_aiohttp = types.ModuleType("aiohttp")
        fake_aiohttp.web = types.SimpleNamespace()

        with patch.dict(sys.modules, {"server": fake_server, "aiohttp": fake_aiohttp}):
            api = load_api_module()

        self.assertIsNone(api.routes)

    def test_save_and_load_lora_profile_set(self):
        api = load_api_module()
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(api, "LORA_PROFILE_DIR", Path(tmp)):
                saved = api._save_lora_profile(
                    "style:preset",
                    {
                        "profile_count": "2",
                        "profile_index": 5,
                        "profile_data": {
                            "1": {"name": "Old name", "style_prompt": "@a", "loras": []},
                            "2": {
                                "style_prompt": "@b",
                                "loras": [{"name": "foo.safetensors", "strength": 0.8}],
                            },
                        },
                    },
                )

                self.assertEqual(saved["name"], "style_preset")
                self.assertEqual(saved["profile_count"], 2)
                self.assertEqual(saved["profile_index"], 1)
                self.assertNotIn("name", saved["profile_data"]["1"])
                self.assertTrue((Path(tmp) / "style_preset.json").is_file())

                profiles = api._list_lora_profiles()
                self.assertEqual([profile["name"] for profile in profiles], ["style_preset"])

                loaded = api._load_lora_profile("style_preset")
                self.assertEqual(loaded["profile_data"]["2"]["style_prompt"], "@b")
                self.assertEqual(loaded["profile_data"]["2"]["loras"][0]["name"], "foo.safetensors")

    def test_empty_lora_profile_name_is_rejected(self):
        api = load_api_module()
        with self.assertRaises(ValueError):
            api._sanitize_lora_profile_name(" ")


if __name__ == "__main__":
    unittest.main()
