import os
import traceback

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from dependencies import require_admin
from routes.track_routes import track_to_response
import models
import schemas

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# GET /api/admin/stats
# ---------------------------------------------------------------------------

@router.get("/stats")
def admin_stats(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    total_users = db.query(models.User).count()
    total_tracks = db.query(models.Track).count()
    total_playlists = db.query(models.Playlist).count()
    total_plays = db.query(func.sum(models.Track.play_count)).scalar() or 0

    # Storage used
    tracks = db.query(models.Track).all()
    total_size = sum(t.file_size or 0 for t in tracks)

    return {
        "total_users": total_users,
        "total_tracks": total_tracks,
        "total_playlists": total_playlists,
        "total_plays": total_plays,
        "storage_bytes": total_size,
    }


# ---------------------------------------------------------------------------
# GET /api/admin/users
# ---------------------------------------------------------------------------

@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    result = []
    for u in users:
        track_count = db.query(models.Track).filter(models.Track.uploaded_by == u.id).count()
        result.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "is_admin": u.is_admin,
            "created_at": u.created_at.isoformat(),
            "track_count": track_count,
        })
    return result


# ---------------------------------------------------------------------------
# GET /api/admin/tracks
# ---------------------------------------------------------------------------

@router.get("/tracks")
def list_all_tracks(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    search: str | None = None,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    query = db.query(models.Track)

    if search:
        term = f"%{search}%"
        query = query.filter(
            (models.Track.title.ilike(term))
            | (models.Track.artist.ilike(term))
            | (models.Track.album.ilike(term))
        )

    total = query.count()
    offset = (page - 1) * limit
    tracks = query.order_by(models.Track.uploaded_at.desc()).offset(offset).limit(limit).all()

    # Get uploader usernames
    user_ids = {t.uploaded_by for t in tracks}
    users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()
    user_map = {u.id: u.username for u in users}

    results = []
    for t in tracks:
        resp = track_to_response(t)
        results.append({
            **resp.model_dump(),
            "uploaded_by_username": user_map.get(t.uploaded_by, "Unknown"),
        })

    return {
        "tracks": results,
        "total": total,
        "page": page,
    }


# ---------------------------------------------------------------------------
# DELETE /api/admin/tracks/{track_id}
# ---------------------------------------------------------------------------

@router.delete("/tracks/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_track(
    track_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    track = db.query(models.Track).filter(models.Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # Remove files from disk
    if track.file_path and os.path.isfile(track.file_path):
        os.remove(track.file_path)
    if track.cover_art_path and os.path.isfile(track.cover_art_path):
        os.remove(track.cover_art_path)

    db.delete(track)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# DELETE /api/admin/tracks  (bulk delete)
# ---------------------------------------------------------------------------

@router.post("/tracks/bulk-delete")
def admin_bulk_delete_tracks(
    body: dict,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    track_ids = body.get("track_ids", [])
    if not track_ids:
        raise HTTPException(status_code=400, detail="No track IDs provided")

    tracks = db.query(models.Track).filter(models.Track.id.in_(track_ids)).all()
    deleted = 0
    for track in tracks:
        if track.file_path and os.path.isfile(track.file_path):
            os.remove(track.file_path)
        if track.cover_art_path and os.path.isfile(track.cover_art_path):
            os.remove(track.cover_art_path)
        db.delete(track)
        deleted += 1

    db.commit()
    return {"deleted": deleted}


# ---------------------------------------------------------------------------
# PATCH /api/admin/users/{user_id}/toggle-admin
# ---------------------------------------------------------------------------

@router.patch("/users/{user_id}/toggle-admin")
def toggle_admin(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own admin status")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_admin = not user.is_admin
    db.commit()
    db.refresh(user)

    return {"id": user.id, "username": user.username, "is_admin": user.is_admin}


# ---------------------------------------------------------------------------
# DELETE /api/admin/users/{user_id}
# ---------------------------------------------------------------------------

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        # Reassign uploaded tracks to admin so music stays in the app
        db.query(models.Track).filter(models.Track.uploaded_by == user_id).update(
            {"uploaded_by": admin.id}, synchronize_session="fetch"
        )

        # Delete playlist-track entries for user's playlists, then playlists
        playlist_ids = [p.id for p in db.query(models.Playlist.id).filter(models.Playlist.created_by == user_id).all()]
        if playlist_ids:
            db.query(models.PlaylistTrack).filter(models.PlaylistTrack.playlist_id.in_(playlist_ids)).delete(synchronize_session="fetch")
            db.query(models.Playlist).filter(models.Playlist.id.in_(playlist_ids)).delete(synchronize_session="fetch")

        # Delete user's listening history
        db.query(models.ListeningHistory).filter(models.ListeningHistory.user_id == user_id).delete(synchronize_session="fetch")

        # Expire cached relationships so ORM sees the changes
        db.expire(user)
        db.delete(user)
        db.commit()
    except Exception as e:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    return None


# ---------------------------------------------------------------------------
# POST /api/admin/compress-all
# ---------------------------------------------------------------------------

@router.post("/compress-all")
def compress_all_tracks(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    """Re-compress all tracks to the configured bitrate to save storage."""
    from config import settings
    from routes.track_routes import _compress_audio

    tracks = db.query(models.Track).all()
    compressed = 0
    saved_bytes = 0

    for track in tracks:
        if not track.file_path or not os.path.isfile(track.file_path):
            continue

        old_size = os.path.getsize(track.file_path)
        new_path = _compress_audio(track.file_path, settings.AUDIO_BITRATE)

        if new_path and new_path != track.file_path:
            new_size = os.path.getsize(new_path) if os.path.isfile(new_path) else 0
            # Only keep compressed version if it's valid and smaller
            if new_size > 1000 and new_size < old_size:
                os.remove(track.file_path)
                track.file_path = new_path
                track.file_size = new_size
                saved_bytes += old_size - new_size
                compressed += 1
            else:
                if os.path.isfile(new_path):
                    os.remove(new_path)

    if compressed > 0:
        db.commit()

    saved_mb = round(saved_bytes / (1024 * 1024), 1)
    return {
        "compressed": compressed,
        "total": len(tracks),
        "saved_mb": saved_mb,
        "message": f"Compressed {compressed} tracks, saved {saved_mb} MB",
    }


# ---------------------------------------------------------------------------
# GET /api/admin/settings
# ---------------------------------------------------------------------------

@router.get("/settings")
def get_app_settings(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    settings_rows = db.query(models.AppSettings).all()
    return {s.key: s.value for s in settings_rows}


# ---------------------------------------------------------------------------
# PATCH /api/admin/settings
# ---------------------------------------------------------------------------

@router.patch("/settings")
def update_app_settings(
    body: dict,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    for key, value in body.items():
        row = db.query(models.AppSettings).filter(models.AppSettings.key == key).first()
        if row:
            row.value = str(value)
        else:
            db.add(models.AppSettings(key=key, value=str(value)))
    db.commit()
    settings_rows = db.query(models.AppSettings).all()
    return {s.key: s.value for s in settings_rows}
