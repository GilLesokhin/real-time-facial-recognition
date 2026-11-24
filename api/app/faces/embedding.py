"""Turn a face photo into a 128-number embedding with OpenCV YuNet (detect) and SFace (embed).

The photo is the browser's 320x320 face crop (see GIL-57). It stays in memory and is never saved.
"""

import os

# Refuse images over 4096x4096 before decoding, so a huge file can't fill the memory.
# OpenCV reads this once, when cv2 is first imported.
os.environ["OPENCV_IO_MAX_IMAGE_PIXELS"] = str(4096 * 4096)
# Show only OpenCV errors. Loading the models prints a harmless warning ("Targets are not supported
# by the new graph engine"), which made the scripts look broken. Errors still show.
os.environ.setdefault("OPENCV_LOG_LEVEL", "ERROR")

import threading  # noqa: E402

import cv2  # noqa: E402
import numpy as np  # noqa: E402

from app.faces.download_models import MODELS_DIR  # noqa: E402

YUNET_PATH = MODELS_DIR / "face_detection_yunet_2023mar.onnx"
SFACE_PATH = MODELS_DIR / "face_recognition_sface_2021dec.onnx"

# SFace aligns every face to 112x112, so a smaller image has too few pixels.
MIN_IMAGE_SIZE = 112
# The browser already checked the face, so YuNet can be less strict than its 0.9 default.
SCORE_THRESHOLD = 0.7


class FaceError(Exception):
    """The photo can't be used. The message is safe to show the admin."""


class NoFaceError(FaceError):
    """The photo is fine but has no face. The door logs this as denied, not as a bad request."""


# Loaded on first use. OpenCV's model objects aren't safe to share between threads,
# and FastAPI runs sync endpoints in a thread pool, so one lock guards loading and every use.
_lock = threading.Lock()
_detector: cv2.FaceDetectorYN | None = None
_embedder: cv2.FaceRecognizerSF | None = None


def _load_models() -> tuple[cv2.FaceDetectorYN, cv2.FaceRecognizerSF]:
    """Call only while holding _lock."""
    global _detector, _embedder
    if _detector is None or _embedder is None:
        if not YUNET_PATH.exists() or not SFACE_PATH.exists():
            raise RuntimeError("Face models missing. From api/, run: uv run python -m app.faces.download_models")
        # The input size is set again for each image.
        _detector = cv2.FaceDetectorYN.create(str(YUNET_PATH), "", (320, 320), SCORE_THRESHOLD)
        _embedder = cv2.FaceRecognizerSF.create(str(SFACE_PATH), "")
    return _detector, _embedder


def _decode(photo: bytes) -> np.ndarray:
    """The photo as a BGR image."""
    try:
        image = cv2.imdecode(np.frombuffer(photo, np.uint8), cv2.IMREAD_COLOR)
    except cv2.error:
        image = None
    if image is None:
        raise FaceError("The file is not an image.")
    return image


def _read_image(photo: bytes) -> np.ndarray:
    """The photo as a BGR image. Raises FaceError when it isn't an image or is too small."""
    image = _decode(photo)
    height, width = image.shape[:2]
    if height < MIN_IMAGE_SIZE or width < MIN_IMAGE_SIZE:
        raise FaceError(f"The photo is too small. It must be at least {MIN_IMAGE_SIZE} px on each side.")
    return image


def embed_for_enrollment(photo: bytes) -> list[float]:
    """The one face in the photo: 128 numbers, scaled to length 1. More than one face is refused, so the admin retakes it.

    Raises NoFaceError when there is no face, and FaceError when the photo isn't an image, is too small,
    or has more than one face.
    """
    image = _read_image(photo)
    height, width = image.shape[:2]
    with _lock:
        detector, embedder = _load_models()
        detector.setInputSize((width, height))
        # Each row of faces is one face: x, y, w, h, 5 landmarks, score.
        _, faces = detector.detect(image)
        if faces is None:
            raise NoFaceError("No face found in the photo.")
        if len(faces) > 1:
            raise FaceError("This photo shows more than one face. Retake it with only one person in view.")
        aligned = embedder.alignCrop(image, faces[0])
        feature = embedder.feature(aligned)

    embedding = feature.flatten()
    embedding = embedding / np.linalg.norm(embedding)
    return embedding.tolist()


def embed_for_identify(photo: bytes) -> list[float]:
    """The biggest face in the photo, by box area: 128 numbers, scaled to length 1. In a tie, the first face wins.

    Raises NoFaceError when there is no face, and FaceError when the photo isn't an image or is too small.
    """
    image = _read_image(photo)
    height, width = image.shape[:2]
    with _lock:
        detector, embedder = _load_models()
        detector.setInputSize((width, height))
        # Each row of faces is one face: x, y, w, h, 5 landmarks, score.
        _, faces = detector.detect(image)
        if faces is None:
            raise NoFaceError("No face found in the photo.")
        biggest = max(faces, key=lambda face: face[2] * face[3])
        aligned = embedder.alignCrop(image, biggest)
        feature = embedder.feature(aligned)

    embedding = feature.flatten()
    embedding = embedding / np.linalg.norm(embedding)
    return embedding.tolist()
