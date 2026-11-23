from pathlib import Path

import cv2
import numpy as np
import pytest

from app.faces.embedding import (
    FaceError,
    NoFaceError,
    embed_for_enrollment,
    embed_for_identify,
)
from app.people.models import EMBEDDING_SIZE

# NASA portraits from Wikimedia Commons (public domain), cropped to 320x320 like the browser does.
FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
FACE = FIXTURES / "armstrong_1.jpg"
SAME_PERSON = FIXTURES / "armstrong_2.jpg"
OTHER_PERSON = FIXTURES / "jemison.jpg"

# Similarity at or above this is a match (OpenCV's published value, see GIL-57).
MATCH_THRESHOLD = 0.363


def embedding(photo: Path) -> list[float]:
    return embed_for_enrollment(photo.read_bytes())


def similarity(embedding_a: list[float], embedding_b: list[float]) -> float:
    """Cosine similarity. The embeddings have length 1, so it's their dot product."""
    return float(np.dot(embedding_a, embedding_b))


def face_image(photo: Path = FACE) -> np.ndarray:
    return cv2.imread(str(photo))


def as_png(image: np.ndarray) -> bytes:
    return cv2.imencode(".png", image)[1].tobytes()


def test_one_face_gives_128_numbers_of_length_1():
    face = embedding(FACE)

    assert len(face) == EMBEDDING_SIZE
    assert np.linalg.norm(face) == pytest.approx(1.0)


def test_the_same_photo_gives_the_same_embedding():
    assert embedding(FACE) == pytest.approx(embedding(FACE))


def test_two_photos_of_the_same_person_match():
    assert similarity(embedding(FACE), embedding(SAME_PERSON)) >= MATCH_THRESHOLD


def test_photos_of_different_people_dont_match():
    assert similarity(embedding(FACE), embedding(OTHER_PERSON)) < MATCH_THRESHOLD


def two_faces(big: Path, small: Path) -> bytes:
    """A 320x640 gray canvas: the big face fills the left half, a half-size face sits on the right."""
    canvas = np.full((320, 640, 3), 128, np.uint8)
    canvas[:, :320] = face_image(big)
    canvas[80:240, 400:560] = cv2.resize(face_image(small), (160, 160))
    return as_png(canvas)


def test_enrollment_refuses_two_faces():
    with pytest.raises(FaceError, match="more than one face"):
        embed_for_enrollment(two_faces(FACE, OTHER_PERSON))


@pytest.mark.parametrize(("big", "small"), [(FACE, OTHER_PERSON), (OTHER_PERSON, FACE)])
def test_identify_uses_the_biggest_of_two_faces(big: Path, small: Path):
    face = embed_for_identify(two_faces(big, small))

    assert similarity(face, embedding(big)) >= MATCH_THRESHOLD
    assert similarity(face, embedding(small)) < MATCH_THRESHOLD


@pytest.mark.parametrize("embed", [embed_for_enrollment, embed_for_identify])
def test_no_face_raises_no_face_error(embed):
    gray = np.full((320, 320, 3), 128, np.uint8)

    with pytest.raises(NoFaceError, match="No face"):
        embed(as_png(gray))


@pytest.mark.parametrize("photo", [b"", b"not an image"])
def test_a_file_that_isnt_an_image_is_refused(photo):
    with pytest.raises(FaceError, match="not an image"):
        embed_for_enrollment(photo)


def test_a_photo_under_112_px_is_refused():
    small = cv2.resize(face_image(), (100, 100))

    with pytest.raises(FaceError, match="too small"):
        embed_for_enrollment(as_png(small))


def test_a_photo_over_4096x4096_is_refused_before_decoding():
    huge = np.zeros((4100, 4100, 3), np.uint8)

    with pytest.raises(FaceError, match="not an image"):
        embed_for_enrollment(as_png(huge))
