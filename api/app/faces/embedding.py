"""Turn a face photo into a 128-number embedding with OpenCV YuNet (detect) and SFace (embed).

The photo is the browser's 320x320 face crop (see GIL-57). It stays in memory and is never saved.
"""

import os

# Refuse images over 4096x4096 before decoding, so a huge file can't fill the memory.
# OpenCV reads this once, when cv2 is first imported.
os.environ["OPENCV_IO_MAX_IMAGE_PIXELS"] = str(4096 * 4096)

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
        # The input size is set again for each image in embed_face.
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


def embed_face(photo: bytes) -> list[float]:
    """The embedding of the one face in the photo: 128 numbers, scaled to length 1.

    Raises FaceError when the photo isn't an image, is too small, or has no face or more than one face.
    """
    image = _decode(photo)
    height, width = image.shape[:2]
    if height < MIN_IMAGE_SIZE or width < MIN_IMAGE_SIZE:
        raise FaceError(f"The photo is too small. It must be at least {MIN_IMAGE_SIZE} px on each side.")

    with _lock:
        detector, embedder = _load_models()
        detector.setInputSize((width, height))
        _, faces = detector.detect(image)
        # Each row of faces is one face: box, 5 landmarks, score.
        if faces is None:
            raise FaceError("No face found in the photo.")
        if len(faces) > 1:
            raise FaceError("More than one face in the photo. Use a photo of one person.")
        aligned = embedder.alignCrop(image, faces[0])
        feature = embedder.feature(aligned)

    embedding = feature.flatten()
    embedding = embedding / np.linalg.norm(embedding)
    return embedding.tolist()
