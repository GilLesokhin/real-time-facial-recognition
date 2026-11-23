from pathlib import Path

import cv2
import numpy as np
import pytest

from app.faces.embedding import FaceError, embed_face
from app.people.models import EMBEDDING_SIZE

# NASA portraits from Wikimedia Commons (public domain), cropped like the browser does: 320x320, mirrored.
FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
FACE = FIXTURES / "armstrong_1.jpg"
SAME_PERSON = FIXTURES / "armstrong_2.jpg"
OTHER_PERSON = FIXTURES / "jemison.jpg"

# Similarity at or above this is a match (OpenCV's published value, see GIL-57).
MATCH_THRESHOLD = 0.363


def similarity(photo_a: Path, photo_b: Path) -> float:
    """Cosine similarity. The embeddings have length 1, so it's their dot product."""
    return float(np.dot(embed_face(photo_a.read_bytes()), embed_face(photo_b.read_bytes())))


def face_image() -> np.ndarray:
    return cv2.imread(str(FACE))


def as_png(image: np.ndarray) -> bytes:
    return cv2.imencode(".png", image)[1].tobytes()


def test_one_face_gives_128_numbers_of_length_1():
    embedding = embed_face(FACE.read_bytes())

    assert len(embedding) == EMBEDDING_SIZE
    assert np.linalg.norm(embedding) == pytest.approx(1.0)


def test_the_same_photo_gives_the_same_embedding():
    assert embed_face(FACE.read_bytes()) == pytest.approx(embed_face(FACE.read_bytes()))


def test_two_photos_of_the_same_person_match():
    assert similarity(FACE, SAME_PERSON) >= MATCH_THRESHOLD


def test_photos_of_different_people_dont_match():
    assert similarity(FACE, OTHER_PERSON) < MATCH_THRESHOLD


def test_two_faces_are_refused():
    two_faces = np.hstack([face_image(), face_image()])

    with pytest.raises(FaceError, match="More than one face"):
        embed_face(as_png(two_faces))


def test_no_face_is_refused():
    gray = np.full((320, 320, 3), 128, np.uint8)

    with pytest.raises(FaceError, match="No face"):
        embed_face(as_png(gray))


@pytest.mark.parametrize("photo", [b"", b"not an image"])
def test_a_file_that_isnt_an_image_is_refused(photo):
    with pytest.raises(FaceError, match="not an image"):
        embed_face(photo)


def test_a_photo_under_112_px_is_refused():
    small = cv2.resize(face_image(), (100, 100))

    with pytest.raises(FaceError, match="too small"):
        embed_face(as_png(small))


def test_a_photo_over_4096x4096_is_refused_before_decoding():
    huge = np.zeros((4100, 4100, 3), np.uint8)

    with pytest.raises(FaceError, match="not an image"):
        embed_face(as_png(huge))
