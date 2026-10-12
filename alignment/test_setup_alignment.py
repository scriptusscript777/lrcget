"""Isolated consent, cache integrity and failure tests without model downloads."""

import hashlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import setup_alignment as setup


class SetupTests(unittest.TestCase):
    def test_setup_requires_consent(self):
        for action in ["install", "download"]:
            result = subprocess.run(
                [sys.executable, str(Path(setup.__file__))],
                input=json.dumps(
                    {"action": action, "model": "tiny", "target": "/unused"}
                ),
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("consent", result.stdout)

    def test_status_and_alignment_never_download_missing_model(self):
        with (
            tempfile.TemporaryDirectory() as root,
            patch.object(setup, "cache_root", return_value=Path(root)),
            patch.object(
                setup.urllib.request,
                "urlopen",
                side_effect=AssertionError("No network allowed"),
            ),
        ):
            self.assertFalse(setup.model_info("tiny")["ready"])
            with self.assertRaisesRegex(ValueError, "Approve"):
                setup.cached_model("tiny")
            self.assertEqual(list(Path(root).iterdir()), [])

    def test_invalid_models_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unsupported"):
            setup.model_info("../../anything")

    def test_verified_download_and_cached_reuse(self):
        data = b"synthetic verified model"
        digest = hashlib.sha256(data).hexdigest()
        with (
            tempfile.TemporaryDirectory() as root,
            patch.object(setup, "cache_root", return_value=Path(root)),
            patch.dict(setup.MODELS, {"tiny": (digest, len(data))}),
        ):
            info = setup.download_model(
                "tiny", opener=lambda *_args, **_kw: io.BytesIO(data)
            )
            self.assertTrue(info["ready"])
            self.assertEqual(Path(info["path"]).read_bytes(), data)
            self.assertEqual(setup.cached_model("tiny"), info["path"])
            setup.download_model(
                "tiny",
                opener=lambda *_args, **_kw: self.fail("Cached model redownloaded"),
            )
            self.assertEqual([path.name for path in Path(root).iterdir()], ["tiny.pt"])

    def test_corrupt_download_preserves_existing_cache_and_removes_partial(self):
        with (
            tempfile.TemporaryDirectory() as root,
            patch.object(setup, "cache_root", return_value=Path(root)),
        ):
            path = Path(root) / "tiny.pt"
            path.write_bytes(b"existing damaged model")
            with self.assertRaisesRegex(ValueError, "verification"):
                setup.download_model(
                    "tiny", opener=lambda *_args, **_kw: io.BytesIO(b"bad")
                )
            self.assertEqual(path.read_bytes(), b"existing damaged model")
            self.assertEqual(list(Path(root).iterdir()), [path])

    def test_no_space_prevents_network(self):
        with (
            tempfile.TemporaryDirectory() as root,
            patch.object(setup, "cache_root", return_value=Path(root)),
            patch.object(
                setup.shutil,
                "disk_usage",
                return_value=setup.shutil._ntuple_diskusage(1, 1, 0),
            ),
            self.assertRaisesRegex(ValueError, "disk space"),
        ):
            setup.download_model(
                "tiny",
                opener=lambda *_args, **_kw: self.fail(
                    "No space must prevent download"
                ),
            )

    def test_missing_ffmpeg_prevents_environment_creation(self):
        with (
            patch.object(setup.shutil, "which", return_value=None),
            patch.object(
                setup.venv.EnvBuilder,
                "create",
                side_effect=AssertionError("Must not create venv"),
            ),
            self.assertRaisesRegex(ValueError, "ffmpeg"),
        ):
            setup.install_engine("/unused")

    def test_broken_visible_torch_is_repaired_inside_private_environment(self):
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(setup.shutil, "which", return_value="/usr/bin/ffmpeg"),
            patch.object(
                setup.shutil,
                "disk_usage",
                return_value=SimpleNamespace(free=8 * 1024**3),
            ),
            patch.object(setup.venv.EnvBuilder, "create"),
            patch.object(
                setup.subprocess, "run", return_value=SimpleNamespace(returncode=1)
            ),
            patch.object(setup, "run_checked") as install,
        ):
            setup.install_engine(str(Path(directory) / "venv"))
            cpu_command = install.call_args_list[0].args[0]
            self.assertIn("--ignore-installed", cpu_command)
            self.assertIn(
                str(setup.environment_python(Path(directory) / "venv")), cpu_command
            )
            self.assertIn("https://download.pytorch.org/whl/cpu", cpu_command)

    def test_private_setup_uses_windows_layout_without_modifying_system_packages(self):
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(setup.sys, "platform", "win32"),
            patch.object(setup.shutil, "which", return_value="ffmpeg.exe"),
            patch.object(
                setup.shutil,
                "disk_usage",
                return_value=SimpleNamespace(free=8 * 1024**3),
            ),
            patch.object(setup.venv.EnvBuilder, "create"),
            patch.object(
                setup.subprocess, "run", return_value=SimpleNamespace(returncode=1)
            ),
            patch.object(setup, "run_checked") as install,
        ):
            target = Path(directory) / "private"
            self.assertTrue(setup.install_engine(target)["ready"])
            for call in install.call_args_list:
                self.assertEqual(call.args[0][0], str(target / "Scripts/python.exe"))
            self.assertIn("--ignore-installed", install.call_args_list[0].args[0])

    def test_missing_venv_returns_prerequisite_error_before_package_install(self):
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(setup.shutil, "which", return_value="/usr/bin/ffmpeg"),
            patch.object(
                setup.shutil,
                "disk_usage",
                return_value=SimpleNamespace(free=8 * 1024**3),
            ),
            patch.object(
                setup.venv.EnvBuilder,
                "create",
                side_effect=subprocess.CalledProcessError(1, "ensurepip"),
            ),
            patch.object(setup, "run_checked") as install,
        ):
            with self.assertRaisesRegex(ValueError, "python3-venv"):
                setup.install_engine(str(Path(directory) / "venv"))
            install.assert_not_called()


if __name__ == "__main__":
    unittest.main()
