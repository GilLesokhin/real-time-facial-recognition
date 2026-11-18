import uuid
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.access import db
from app.access.models import AccessEvent, AccessResult
from app.access.schemas import AccessEventOut, IdentifyOut, MatchOut
from app.buildings.service import reachable_building
from app.core import faces
from app.terminals.models import Terminal
from app.users.models import User


def identify(session: Session, terminal: Terminal, image: bytes) -> IdentifyOut:
    """Finds the most similar face in the terminal's building. Every check is logged."""
    try:
        embedding = faces.embed_face(image)
    except (faces.NoFaceError, faces.NotAnImageError) as e:
        # Not logged: the browser only sends crops where it saw a face, so this is rare noise.
        raise HTTPException(422, str(e)) from e

    closest = db.similarity_face_search(session, terminal.building_id, embedding)

    person = None
    score = None
    if closest is not None:
        score = round(closest.similarity, 3)
        if closest.similarity >= faces.MATCH_THRESHOLD:
            person = closest.person

    result = AccessResult.GRANTED if person else AccessResult.DENIED

    db.add_event(
        session,
        AccessEvent(
            building_id=terminal.building_id,
            terminal_id=terminal.id,
            person_id=person.id if person else None,
            result=result,
            score=score,
            # The real time, not the transaction's start, so the log order is exact.
            created_at=datetime.now(UTC),
        ),
    )
    session.commit()
    return IdentifyOut(
        result=result,
        person=MatchOut(id=person.id, name=person.name) if person else None,
        score=score,
    )


def access_log(
    session: Session,
    admin: User,
    building_id: uuid.UUID,
    terminal_id: uuid.UUID | None,
    result: AccessResult | None,
    limit: int,
) -> list[AccessEventOut]:
    reachable_building(session, admin, building_id)
    return [
        AccessEventOut(
            id=event.id,
            terminal_id=event.terminal_id,
            terminal_name=terminal_name,
            person_id=event.person_id,
            person_name=person_name,
            result=event.result,
            score=event.score,
            created_at=event.created_at,
        )
        for event, terminal_name, person_name in db.list_events(session, building_id, terminal_id, result, limit)
    ]
