"""Consent-gated optional setup. No setup/download is performed by status checks."""

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import venv
from pathlib import Path

MODELS = {
    "tiny": (
        "65147644a518d12f04e32d6f3b26facc3f8dd46e5390956a9424a650c0ce22b9",
        75572083,
    ),
    "base": (
        "ed3a0b6b1c0edf879ad9b11b1af5a0e6ab5db9205f891f668f8b0e6c6326e34e",
        145262807,
    ),
    "small": (
        "9ecf779972d90ba49c06d968637d720dd632c55bbf19d441fb42bf17a411e794",
        483617219,
    ),
}


def emit(value):
    print(json.dumps(value), flush=True)


def progress(percent, message):
    emit({"type": "progress", "percent": percent, "message": message})


def cache_root():
    return Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "whisper"


def valid_model(path, expected):
    if not path.is_file():
        return False
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest() == expected


def model_info(name):
    if name not in MODELS:
        raise ValueError("Unsupported alignment model")
    expected, size = MODELS[name]
    path = cache_root() / f"{name}.pt"
    return {"ready": valid_model(path, expected), "bytes": size, "path": str(path)}


def cached_model(name):
    info = model_info(name)
    if not info["ready"]:
        raise ValueError(
            "Selected model is missing or damaged. Approve its download in Align words first."
        )
    return info["path"]


def download_model(name, opener=urllib.request.urlopen, staging=None):
    info = model_info(name)
    if info["ready"]:
        return info
    root = cache_root()
    root.mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(root).free < info["bytes"] + 100 * 1024 * 1024:
        raise ValueError("Not enough disk space for this model")
    expected, _ = MODELS[name]
    url = f"https://openaipublic.azureedge.net/main/whisper/models/{expected}/{name}.pt"
    # Never replace a cache entry with a partial or unverified model.
    handle, temporary = tempfile.mkstemp(prefix=f".lrcget-{name}-", dir=staging or root)
    try:
        digest = hashlib.sha256()
        downloaded = 0
        previous = -1
        with os.fdopen(handle, "wb") as target, opener(url, timeout=30) as source:
            while chunk := source.read(1024 * 1024):
                downloaded += len(chunk)
                if downloaded > info["bytes"] + 1024 * 1024:
                    raise ValueError("Unexpected model download size")
                digest.update(chunk)
                target.write(chunk)
                percent = min(99, downloaded * 100 // info["bytes"])
                if percent != previous:
                    progress(percent, f"Downloading {name}: {downloaded // 1000000} MB")
                    previous = percent
            target.flush()
            os.fsync(target.fileno())
        if digest.hexdigest() != expected:
            raise ValueError("Model verification failed; retry the download")
        os.replace(temporary, info["path"])
        progress(100, "Model downloaded and verified")
        return {**info, "ready": True}
    finally:
        Path(temporary).unlink(missing_ok=True)


def run_checked(args):
    result = subprocess.run(args, stdout=sys.stderr, stderr=sys.stderr, check=False)
    if result.returncode:
        raise ValueError(
            "Optional package setup failed. Check network access and Python/venv support, then retry."
        )


def install_engine(target):
    if sys.platform != "linux":
        raise ValueError(
            "Integrated setup currently supports Linux. Basic mode remains available."
        )
    if not (3, 10) <= sys.version_info[:2] <= (3, 12):
        raise ValueError(
            "Optional setup needs Python 3.10–3.12. Basic mode remains available."
        )
    if not shutil.which("ffmpeg"):
        raise ValueError(
            "Install ffmpeg using your package manager first (Debian: sudo apt install ffmpeg python3-venv)."
        )
    target = Path(target)
    if shutil.disk_usage(target.parent).free < 4 * 1024**3:
        raise ValueError("Optional setup requires at least 4 GiB free disk space")
    progress(5, "Creating private Python environment")
    # Reuse compatible existing libraries without changing them; pip installs only here.
    try:
        venv.EnvBuilder(with_pip=True, system_site_packages=True).create(target)
    except (OSError, subprocess.SubprocessError) as error:
        raise ValueError(
            "Python venv is unavailable. Install python3-venv with your package manager, then retry."
        ) from error
    python = str(target / "bin/python")
    existing = (
        subprocess.run(
            [
                python,
                "-c",
                "import torch, torchaudio; assert torch.__version__.split('+')[0] == torchaudio.__version__.split('+')[0]",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        ).returncode
        == 0
    )
    if not existing:
        progress(20, "Installing CPU PyTorch (download size varies; please wait)")
        run_checked(
            [
                python,
                "-m",
                "pip",
                "--isolated",
                "install",
                "--disable-pip-version-check",
                "--no-cache-dir",
                # Broken inherited packages must not satisfy the private repair.
                "--ignore-installed",
                "torch==2.9.1",
                "torchaudio==2.9.1",
                "--index-url",
                "https://download.pytorch.org/whl/cpu",
            ]
        )
    progress(65, "Installing Whisper and stable-ts")
    run_checked(
        [
            python,
            "-m",
            "pip",
            "--isolated",
            "install",
            "--disable-pip-version-check",
            "--no-cache-dir",
            "--index-url",
            "https://pypi.org/simple",
            "openai-whisper==20250625",
            "stable-ts==2.19.1",
        ]
    )
    progress(90, "Verifying optional alignment engine")
    run_checked(
        [
            python,
            "-c",
            "import stable_whisper, whisper, torch, torchaudio; assert hasattr(stable_whisper, 'load_model'); assert torch.__version__.split('+')[0] == torchaudio.__version__.split('+')[0]",
        ]
    )
    progress(100, "Optional engine installed and verified")
    return {"ready": True}


def main():
    request = json.load(sys.stdin)
    action = request["action"]
    if action == "model-status":
        result = model_info(request["model"])
    elif request.get("confirmed") is not True:
        raise ValueError("Explicit setup/download consent is required")
    elif action == "install":
        result = install_engine(request["target"])
    elif action == "download":
        result = download_model(request["model"], staging=request.get("target"))
    else:
        raise ValueError("Unsupported setup action")
    emit({"type": "result", **result})


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001 -- send actionable worker failure to UI
        emit({"type": "error", "message": str(error)})
        sys.exit(1)
