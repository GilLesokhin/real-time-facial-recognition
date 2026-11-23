import uuid

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.access import db as access_db
from app.access.models import AccessEvent, AccessResult
from app.access.schemas import AccessLogItem, IdentifyResponse
from app.buildings.models import Building
from app.faces.embedding import FaceError, NoFaceError, embed_for_identify
from app.faces.upload import read_photo
from app.people.models import Person
from app.terminals.models import Terminal

# Granted only above this similarity. OpenCV's published value for SFace (see GIL-57).
MATCH_THRESHOLD = 0.363


def identify(session: Session, terminal: Terminal, photo: UploadFile) -> IdentifyResponse:
    """Checks the face at the door and logs the check.

    No face is a denied check with a null score. A file that isn't a usable image is a 422 and isn't logged.
    """
    try:
        embedding = embed_for_identify(read_photo(photo))
    except NoFaceError:
        # No face is a door check. Deny it and log it.
        embedding = None
    except FaceError as error:
        # The file is not an image, or it is too small. The terminal sent bad data, so return 422 and do not log it.
        raise HTTPException(422, str(error)) from error

    # Find the nearest person. None when there is no face or no enrolled person.
    match = None
    if embedding is not None:
        match = access_db.closest_match(session, terminal.building_id, embedding)

    # Log the score for each match, also when it is too low.
    score: float | None = None
    if match is not None:
        score = match.score

    # Grant only above the threshold. A score means that match is not None.
    person: Person | None = None
    if score is not None and score > MATCH_THRESHOLD:
        person = match.Person

    # Deny when there is no face, no enrolled person, or the score is too low.
    if person is None:
        result = AccessResult.DENIED
    else:
        result = AccessResult.GRANTED

    access_db.add_event(
        session,
        AccessEvent(
            building_id=terminal.building_id,
            terminal_id=terminal.id,
            person_id=person.id if person else None,
            result=result,
            score=score,
        ),
    )
    session.commit()
    return IdentifyResponse(result=result, person_name=person.name if person else None)


def list_access_log(
    session: Session, building: Building, terminal_id: uuid.UUID | None, result: AccessResult | None
) -> list[AccessLogItem]:
    """The building's newest checks, newest first, with the person and terminal names."""
    items = []
    for row in access_db.list_events(session, building.id, terminal_id, result):
        event = row.AccessEvent
        items.append(
            AccessLogItem(
                id=event.id,
                terminal_id=event.terminal_id,
                terminal_name=row.terminal_name,
                person_id=event.person_id,
                person_name=row.person_name,
                result=event.result,
                score=event.score,
                created_at=event.created_at,
            )
        )
    return items
