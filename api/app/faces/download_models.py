"""Download the face models into api/face_models/ and check each file's SHA-256.

Run from api/: uv run python -m app.faces.download_models
A file that is already there with the right hash is kept.
"""

import hashlib
import urllib.request
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parents[2] / "face_models"

# From github.com/opencv/opencv_zoo, pinned to a commit. Each hash is the Git LFS oid of the file.
ZOO = "https://media.githubusercontent.com/media/opencv/opencv_zoo/48b10fa505aeb51fbd127fc60a5c660040e823b7/models"
MODELS = {
    "face_detection_yunet_2023mar.onnx": {
        "url": f"{ZOO}/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "expected_hash": "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
    },
    "face_recognition_sface_2021dec.onnx": {
        "url": f"{ZOO}/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        "expected_hash": "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79",
    },
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download(name: str, url: str, expected_hash: str) -> None:
    path = MODELS_DIR / name
    if path.exists() and sha256(path) == expected_hash:
        print(f"{name}: already there.")
        return

    # Download to a temporary file first, so a failed or bad download
    # never leaves a broken model at the real path.
    temp_path = path.with_suffix(".part")
    print(f"{name}: downloading...")
    urllib.request.urlretrieve(url, temp_path)

    if sha256(temp_path) != expected_hash:
        temp_path.unlink()  # delete the bad file
        raise SystemExit(f"{name}: wrong SHA-256. The download was deleted.")

    temp_path.replace(path)  # move it to the real name
    print(f"{name}: done.")


if __name__ == "__main__":
    MODELS_DIR.mkdir(exist_ok=True)
    for name, model in MODELS.items():
        download(name, model["url"], model["expected_hash"])
