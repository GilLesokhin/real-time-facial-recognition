from fastapi import HTTPException, UploadFile

from app.faces.embedding import FaceError, embed_for_enrollment

# The browser sends a 320x320 JPEG of about 22 KB. 1 MB leaves room for any real photo.
MAX_PHOTO_BYTES = 1024 * 1024


def read_photo(photo: UploadFile) -> bytes:
    # Read one byte past the limit: that's enough to know the file is too big.
    data = photo.file.read(MAX_PHOTO_BYTES + 1)
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(413, "The photo is over 1 MB.")
    return data


def embed_enrollment_photo(photo: UploadFile) -> list[float]:
    """The face's embedding. Any FaceError becomes a 422. The photo itself is never saved."""
    try:
        return embed_for_enrollment(read_photo(photo))
    except FaceError as error:
        raise HTTPException(422, str(error)) from error
