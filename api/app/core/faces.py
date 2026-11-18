"""Face recognition with OpenCV: YuNet finds the face, SFace turns it into 128 numbers.

Decided in GIL-57. The models download into api/models/ on first use.
"""

import urllib.request
from functools import cache
from pathlib import Path

import cv2
import numpy as np

MODELS = Path(__file__).resolve().parents[2] / "models"
ZOO = "https://github.com/opencv/opencv_zoo/raw/main/models"
YUNET = MODELS / "face_detection_yunet_2023mar.onnx"
SFACE = MODELS / "face_recognition_sface_2021dec.onnx"
DOWNLOADS = {
    YUNET: f"{ZOO}/face_detection_yunet/{YUNET.name}",
    SFACE: f"{ZOO}/face_recognition_sface/{SFACE.name}",
}

# OpenCV's published SFace value: cosine similarity >= 0.363 means "same person".
MATCH_THRESHOLD = 0.363
DETECT_SCORE = 0.6
# Stored photos are resized so their longest side is at most this.
PHOTO_SIDE = 512


class NoFaceError(ValueError):
    pass


class NotAnImageError(ValueError):
    pass


@cache
def _models() -> tuple[cv2.FaceDetectorYN, cv2.FaceRecognizerSF]:
    MODELS.mkdir(exist_ok=True)
    for path, url in DOWNLOADS.items():
        if not path.exists():
            urllib.request.urlretrieve(url, path)
    detector = cv2.FaceDetectorYN.create(str(YUNET), "", (320, 320), DETECT_SCORE, 0.3, 5000)
    recognizer = cv2.FaceRecognizerSF.create(str(SFACE), "")
    return detector, recognizer


def _decode(data: bytes) -> np.ndarray:
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise NotAnImageError("This file isn't an image.")
    return img


def _shrink(img: np.ndarray, side: int) -> np.ndarray:
    scale = side / max(img.shape[:2])
    if scale >= 1:
        return img
    return cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)


def _embed(img: np.ndarray) -> list[float]:
    detector, recognizer = _models()
    h, w = img.shape[:2]
    detector.setInputSize((w, h))
    _, faces = detector.detect(img)
    if faces is None or len(faces) == 0:
        raise NoFaceError("No face found in the photo.")
    face = max(faces, key=lambda f: f[2] * f[3])  # the biggest face
    embedding = recognizer.feature(recognizer.alignCrop(img, face)).flatten()
    return (embedding / np.linalg.norm(embedding)).tolist()


def prepare_photo(data: bytes) -> tuple[bytes, list[float]]:
    """For enrollment: the photo resized to a JPEG, and its face's embedding."""
    img = _shrink(_decode(data), PHOTO_SIDE)
    embedding = _embed(img)
    ok, jpeg = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not ok:
        raise NotAnImageError("This file isn't an image.")
    return jpeg.tobytes(), embedding


def embed_face(data: bytes) -> list[float]:
    """For the door: the embedding of the face in a terminal's crop."""
    return _embed(_shrink(_decode(data), PHOTO_SIDE))
