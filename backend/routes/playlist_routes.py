from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
from routes.track_routes import track_to_response
import models
import schemas

router = APIRouter(prefix="/api/playlists", tags=["playlists"])


def playlist_to_response(
    playlist: models.Playlist, include_tracks: bool = False
) -> schemas.PlaylistResponse:
    """Convert a Playlist SQLAlchemy model to a PlaylistResponse schema."""
    tracks = []
    if include_tracks and playlist.playlist_tracks:
        tracks = [
            track_to_response(pt.track)
            for pt in sorted(playlist.playlist_tracks, key=lambda pt: pt.position)
            if pt.track is not None
        ]

    track_count = len(playlist.playlist_tracks) if playlist.playlist_tracks else 0

    return schemas.PlaylistResponse(
        id=playlist.id,
        name=playlist.name,
        description=playlist.description or "",
        cover_image=playlist.cover_image,
        created_by=playlist.created_by,
        created_at=playlist.created_at,
        updated_at=playlist.updated_at,
        tracks=tracks,
        track_count=track_count,
    )


@router.get("", response_model=list[schemas.PlaylistResponse])
@router.get("/", response_model=list[schemas.PlaylistResponse])
def list_playlists(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    playlists = (
        db.query(models.Playlist)
        .filter(models.Playlist.created_by == current_user.id)
        .order_by(models.Playlist.updated_at.desc())
        .all()
    )
    return [playlist_to_response(p, include_tracks=True) for p in playlists]


@router.get("/{playlist_id}", response_model=schemas.PlaylistResponse)
def get_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
):
    playlist = (
        db.query(models.Playlist)
        .filter(models.Playlist.id == playlist_id)
        .first()
    )
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist_to_response(playlist, include_tracks=True)


@router.post("", response_model=schemas.PlaylistResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=schemas.PlaylistResponse, status_code=status.HTTP_201_CREATED)
def create_playlist(
    data: schemas.PlaylistCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    playlist = models.Playlist(
        name=data.name,
        description=data.description,
        created_by=current_user.id,
    )
    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return playlist_to_response(playlist, include_tracks=True)


@router.put("/{playlist_id}", response_model=schemas.PlaylistResponse)
def update_playlist(
    playlist_id: int,
    data: schemas.PlaylistUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    playlist = (
        db.query(models.Playlist)
        .filter(models.Playlist.id == playlist_id)
        .first()
    )
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this playlist",
        )

    if data.name is not None:
        playlist.name = data.name
    if data.description is not None:
        playlist.description = data.description

    db.commit()
    db.refresh(playlist)
    return playlist_to_response(playlist, include_tracks=True)


@router.delete("/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    playlist = (
        db.query(models.Playlist)
        .filter(models.Playlist.id == playlist_id)
        .first()
    )
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this playlist",
        )

    db.delete(playlist)
    db.commit()
    return None


@router.post("/{playlist_id}/tracks", response_model=schemas.PlaylistResponse)
def add_track_to_playlist(
    playlist_id: int,
    data: schemas.PlaylistAddTrack,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    playlist = (
        db.query(models.Playlist)
        .filter(models.Playlist.id == playlist_id)
        .first()
    )
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this playlist",
        )

    # Check track exists
    track = db.query(models.Track).filter(models.Track.id == data.track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # Check if track already in playlist
    existing = (
        db.query(models.PlaylistTrack)
        .filter(
            models.PlaylistTrack.playlist_id == playlist_id,
            models.PlaylistTrack.track_id == data.track_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Track already in playlist",
        )

    # Get next position
    max_pos = (
        db.query(models.PlaylistTrack.position)
        .filter(models.PlaylistTrack.playlist_id == playlist_id)
        .order_by(models.PlaylistTrack.position.desc())
        .first()
    )
    next_position = (max_pos[0] + 1) if max_pos else 0

    playlist_track = models.PlaylistTrack(
        playlist_id=playlist_id,
        track_id=data.track_id,
        position=next_position,
    )
    db.add(playlist_track)
    db.commit()
    db.refresh(playlist)

    return playlist_to_response(playlist, include_tracks=True)


@router.put("/{playlist_id}/reorder", response_model=schemas.PlaylistResponse)
def reorder_playlist_tracks(
    playlist_id: int,
    data: schemas.PlaylistReorder,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    playlist = (
        db.query(models.Playlist)
        .filter(models.Playlist.id == playlist_id)
        .first()
    )
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this playlist",
        )

    # Build a map of track_id -> PlaylistTrack
    pt_map = {
        pt.track_id: pt for pt in playlist.playlist_tracks
    }

    # Validate all track_ids belong to this playlist
    for tid in data.track_ids:
        if tid not in pt_map:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Track {tid} is not in this playlist",
            )

    # Update positions based on the new order
    for position, track_id in enumerate(data.track_ids):
        pt_map[track_id].position = position

    db.commit()
    db.refresh(playlist)
    return playlist_to_response(playlist, include_tracks=True)


@router.delete("/{playlist_id}/tracks/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_track_from_playlist(
    playlist_id: int,
    track_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    playlist = (
        db.query(models.Playlist)
        .filter(models.Playlist.id == playlist_id)
        .first()
    )
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this playlist",
        )

    playlist_track = (
        db.query(models.PlaylistTrack)
        .filter(
            models.PlaylistTrack.playlist_id == playlist_id,
            models.PlaylistTrack.track_id == track_id,
        )
        .first()
    )
    if not playlist_track:
        raise HTTPException(status_code=404, detail="Track not in playlist")

    removed_position = playlist_track.position
    db.delete(playlist_track)

    # Reorder positions for tracks that came after the removed one
    remaining = (
        db.query(models.PlaylistTrack)
        .filter(
            models.PlaylistTrack.playlist_id == playlist_id,
            models.PlaylistTrack.position > removed_position,
        )
        .order_by(models.PlaylistTrack.position.asc())
        .all()
    )
    for pt in remaining:
        pt.position -= 1

    db.commit()
    return None
