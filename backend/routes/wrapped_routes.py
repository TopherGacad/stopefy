from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, distinct
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
import models
import schemas

router = APIRouter(prefix="/api/wrapped", tags=["wrapped"])


@router.get("/enabled")
def wrapped_enabled(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    setting = db.query(models.AppSettings).filter(models.AppSettings.key == "wrapped_enabled").first()
    enabled = setting.value == "true" if setting else False
    return {"enabled": enabled}


@router.get("/{year}", response_model=schemas.WrappedResponse)
def get_wrapped(
    year: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Check if wrapped is enabled (admins can always access)
    if not current_user.is_admin:
        setting = db.query(models.AppSettings).filter(models.AppSettings.key == "wrapped_enabled").first()
        if not setting or setting.value != "true":
            raise HTTPException(status_code=403, detail="Wrapped is not available yet")

    start_date = datetime(year, 1, 1)
    end_date = datetime(year, 12, 31, 23, 59, 59)

    # Base query: listening history for this user in the given year
    base_filter = (
        (models.ListeningHistory.user_id == current_user.id)
        & (models.ListeningHistory.listened_at >= start_date)
        & (models.ListeningHistory.listened_at <= end_date)
    )

    # Total minutes listened
    total_duration = (
        db.query(func.sum(models.ListeningHistory.duration_listened))
        .filter(base_filter)
        .scalar()
    )
    total_minutes = (total_duration or 0) / 60.0

    # Total tracks played (total history records)
    total_tracks_played = (
        db.query(func.count(models.ListeningHistory.id))
        .filter(base_filter)
        .scalar()
    ) or 0

    # Total unique tracks
    total_unique_tracks = (
        db.query(func.count(distinct(models.ListeningHistory.track_id)))
        .filter(base_filter)
        .scalar()
    ) or 0

    # Top tracks: group by track_id, count plays, top 10
    top_tracks_query = (
        db.query(
            models.ListeningHistory.track_id,
            func.count(models.ListeningHistory.id).label("plays"),
        )
        .filter(base_filter)
        .group_by(models.ListeningHistory.track_id)
        .order_by(func.count(models.ListeningHistory.id).desc())
        .limit(10)
        .all()
    )

    top_tracks = []
    for track_id, plays in top_tracks_query:
        track = db.query(models.Track).filter(models.Track.id == track_id).first()
        if track:
            cover_art_url = f"/api/tracks/{track.id}/cover" if track.cover_art_path else None
            top_tracks.append(
                schemas.WrappedTopTrack(
                    id=track.id,
                    title=track.title,
                    artist=track.artist,
                    album=track.album,
                    cover_art_url=cover_art_url,
                    plays=plays,
                )
            )

    # Top artists: group by track.artist, count plays and sum minutes, top 10
    top_artists_query = (
        db.query(
            models.Track.artist,
            func.count(models.ListeningHistory.id).label("plays"),
            func.sum(models.ListeningHistory.duration_listened).label("total_duration"),
        )
        .join(models.Track, models.ListeningHistory.track_id == models.Track.id)
        .filter(base_filter)
        .group_by(models.Track.artist)
        .order_by(func.count(models.ListeningHistory.id).desc())
        .limit(10)
        .all()
    )

    top_artists = [
        schemas.WrappedTopArtist(
            name=artist_name,
            plays=plays,
            minutes=(total_dur or 0) / 60.0,
        )
        for artist_name, plays, total_dur in top_artists_query
    ]

    # Top genres: group by track.genre, count plays, top 5
    top_genres_query = (
        db.query(
            models.Track.genre,
            func.count(models.ListeningHistory.id).label("plays"),
        )
        .join(models.Track, models.ListeningHistory.track_id == models.Track.id)
        .filter(base_filter)
        .group_by(models.Track.genre)
        .order_by(func.count(models.ListeningHistory.id).desc())
        .limit(5)
        .all()
    )

    top_genres = [
        schemas.WrappedTopGenre(genre=genre_name, plays=plays)
        for genre_name, plays in top_genres_query
    ]

    # If no data at all, we still return a valid response with zeros
    return schemas.WrappedResponse(
        year=year,
        total_minutes=round(total_minutes, 2),
        top_tracks=top_tracks,
        top_artists=top_artists,
        top_genres=top_genres,
        total_tracks_played=total_tracks_played,
        total_unique_tracks=total_unique_tracks,
    )
