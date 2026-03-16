import math
import mimetypes
import os
import shutil
import subprocess
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from dependencies import get_current_user
import models
import schemas

router = APIRouter(prefix="/api/tracks", tags=["tracks"])


def _find_ffmpeg_bin() -> str | None:
    """Return the path to ffmpeg binary, or None if not found."""
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        return ffmpeg

    # WinGet install location
    winget_base = os.path.join(
        os.environ.get("LOCALAPPDATA", ""),
        "Microsoft", "WinGet", "Packages",
    )
    if os.path.isdir(winget_base):
        for dirpath, _, filenames in os.walk(winget_base):
            if "ffmpeg.exe" in filenames:
                return os.path.join(dirpath, "ffmpeg.exe")
    return None


_FFMPEG_BIN = _find_ffmpeg_bin()


def _compress_audio(file_path: str, target_bitrate: str) -> str | None:
    """Compress an audio file to MP3 at the target bitrate. Returns new path or None on failure."""
    if not _FFMPEG_BIN:
        return None

    # Skip if already a small mp3
    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    ext = os.path.splitext(file_path)[1].lower()

    # Only compress if file is larger than ~1MB per minute estimate
    # or if it's not already mp3
    if ext == ".mp3" and file_size_mb < 4:
        return None  # Already small enough

    out_name = f"{uuid.uuid4()}.mp3"
    out_path = os.path.join(settings.UPLOAD_DIR, out_name)

    try:
        result = subprocess.run(
            [
                _FFMPEG_BIN, "-i", file_path,
                "-vn",  # no video
                "-ab", f"{target_bitrate}k",
                "-ar", "44100",  # 44.1kHz sample rate
                "-ac", "2",  # stereo
                "-y",  # overwrite
                out_path,
            ],
            capture_output=True,
            timeout=120,
        )
        if result.returncode == 0 and os.path.isfile(out_path) and os.path.getsize(out_path) > 0:
            return out_path
        else:
            # Cleanup failed output
            if os.path.isfile(out_path):
                os.remove(out_path)
            return None
    except Exception:
        if os.path.isfile(out_path):
            os.remove(out_path)
        return None


def track_to_response(track: models.Track) -> schemas.TrackResponse:
    """Convert a Track SQLAlchemy model to a TrackResponse schema."""
    cover_art_url = f"/api/tracks/{track.id}/cover" if track.cover_art_path else None
    return schemas.TrackResponse(
        id=track.id,
        title=track.title,
        artist=track.artist,
        album=track.album,
        genre=track.genre,
        duration=track.duration,
        cover_art_url=cover_art_url,
        uploaded_by=track.uploaded_by,
        uploaded_at=track.uploaded_at,
        play_count=track.play_count,
        year=track.year,
        file_size=track.file_size,
    )


@router.get("", response_model=schemas.PaginatedTracks)
@router.get("/", response_model=schemas.PaginatedTracks)
def list_tracks(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    genre: str | None = None,
    artist: str | None = None,
    search: str | None = None,
    sort: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Track)

    if genre:
        query = query.filter(models.Track.genre.ilike(f"%{genre}%"))
    if artist:
        query = query.filter(models.Track.artist.ilike(f"%{artist}%"))
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (models.Track.title.ilike(search_term))
            | (models.Track.artist.ilike(search_term))
            | (models.Track.album.ilike(search_term))
        )

    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 1
    offset = (page - 1) * limit

    if sort == "most_played":
        tracks = query.order_by(models.Track.play_count.desc()).offset(offset).limit(limit).all()
    else:
        tracks = query.order_by(models.Track.uploaded_at.desc()).offset(offset).limit(limit).all()

    return schemas.PaginatedTracks(
        tracks=[track_to_response(t) for t in tracks],
        total=total,
        page=page,
        pages=pages,
    )


@router.get("/suggested", response_model=list[schemas.TrackResponse])
def suggested_tracks(
    limit: int = Query(6, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Suggest tracks based on the user's listening history."""
    from sqlalchemy import func, or_

    # Get user's top genres (up to 3)
    top_genres = (
        db.query(models.Track.genre, func.count().label("cnt"))
        .join(models.ListeningHistory, models.ListeningHistory.track_id == models.Track.id)
        .filter(
            models.ListeningHistory.user_id == current_user.id,
            models.Track.genre.isnot(None),
            models.Track.genre != "Unknown",
        )
        .group_by(models.Track.genre)
        .order_by(func.count().desc())
        .limit(3)
        .all()
    )
    genre_names = [g[0] for g in top_genres]

    # Get user's top artists (up to 3)
    top_artists = (
        db.query(models.Track.artist, func.count().label("cnt"))
        .join(models.ListeningHistory, models.ListeningHistory.track_id == models.Track.id)
        .filter(
            models.ListeningHistory.user_id == current_user.id,
            models.Track.artist.isnot(None),
            models.Track.artist != "Unknown Artist",
        )
        .group_by(models.Track.artist)
        .order_by(func.count().desc())
        .limit(3)
        .all()
    )
    artist_names = [a[0] for a in top_artists]

    # Get IDs of tracks the user has listened to a lot
    heavily_played_ids = (
        db.query(models.ListeningHistory.track_id)
        .filter(models.ListeningHistory.user_id == current_user.id)
        .group_by(models.ListeningHistory.track_id)
        .having(func.count() >= 3)
        .all()
    )
    exclude_ids = {row[0] for row in heavily_played_ids}

    if genre_names or artist_names:
        conditions = []
        if genre_names:
            conditions.append(models.Track.genre.in_(genre_names))
        if artist_names:
            conditions.append(models.Track.artist.in_(artist_names))

        query = db.query(models.Track).filter(or_(*conditions))

        if exclude_ids:
            query = query.filter(models.Track.id.notin_(exclude_ids))

        tracks = query.order_by(models.Track.play_count.asc()).limit(limit).all()
    else:
        # No history — return least-played tracks as discovery
        query = db.query(models.Track)
        if exclude_ids:
            query = query.filter(models.Track.id.notin_(exclude_ids))
        tracks = query.order_by(models.Track.play_count.asc()).limit(limit).all()

    return [track_to_response(t) for t in tracks]


@router.get("/{track_id}", response_model=schemas.TrackResponse)
def get_track(track_id: int, db: Session = Depends(get_db)):
    track = db.query(models.Track).filter(models.Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    return track_to_response(track)


@router.get("/{track_id}/stream")
def stream_track(track_id: int, request: Request, db: Session = Depends(get_db)):
    track = db.query(models.Track).filter(models.Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    file_path = track.file_path
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found on disk")

    file_size = os.path.getsize(file_path)
    content_type, _ = mimetypes.guess_type(file_path)
    if content_type is None:
        content_type = "application/octet-stream"

    range_header = request.headers.get("range")

    if range_header:
        # Parse Range header, e.g. "bytes=0-1023"
        try:
            range_spec = range_header.strip().replace("bytes=", "")
            parts = range_spec.split("-")
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if parts[1] else file_size - 1
        except (ValueError, IndexError):
            start = 0
            end = file_size - 1

        if start >= file_size:
            raise HTTPException(
                status_code=416,
                detail="Range not satisfiable",
            )

        end = min(end, file_size - 1)
        content_length = end - start + 1

        def iter_file():
            with open(file_path, "rb") as f:
                f.seek(start)
                remaining = content_length
                chunk_size = 8192
                while remaining > 0:
                    read_size = min(chunk_size, remaining)
                    data = f.read(read_size)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": content_type,
        }

        return StreamingResponse(
            iter_file(),
            status_code=206,
            headers=headers,
            media_type=content_type,
        )
    else:
        return FileResponse(
            file_path,
            media_type=content_type,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
            },
        )


@router.get("/{track_id}/download")
def download_track(track_id: int, db: Session = Depends(get_db)):
    track = db.query(models.Track).filter(models.Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    file_path = track.file_path
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found on disk")

    filename = f"{track.artist} - {track.title}{os.path.splitext(file_path)[1]}"

    return FileResponse(
        file_path,
        filename=filename,
        media_type="application/octet-stream",
    )


@router.get("/{track_id}/cover")
def get_cover_art(track_id: int, db: Session = Depends(get_db)):
    track = db.query(models.Track).filter(models.Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    if not track.cover_art_path or not os.path.isfile(track.cover_art_path):
        raise HTTPException(status_code=404, detail="Cover art not found")

    content_type, _ = mimetypes.guess_type(track.cover_art_path)
    if content_type is None:
        content_type = "image/jpeg"

    return FileResponse(track.cover_art_path, media_type=content_type)


@router.post("/upload", response_model=schemas.TrackResponse)
def upload_track(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Ensure uploads directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Generate a unique filename
    ext = os.path.splitext(file.filename)[1] if file.filename else ".mp3"
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_name)

    # Save the uploaded file
    with open(file_path, "wb") as f:
        contents = file.file.read()
        f.write(contents)

    file_size = os.path.getsize(file_path)

    # Extract metadata with mutagen
    title = os.path.splitext(file.filename)[0] if file.filename else "Unknown Title"
    artist = "Unknown Artist"
    album = "Unknown Album"
    genre = "Unknown"
    duration = 0.0
    year = None
    cover_art_path = None

    try:
        import mutagen
        from mutagen.easyid3 import EasyID3
        from mutagen.mp3 import MP3
        from mutagen.id3 import ID3
        from mutagen.flac import FLAC
        from mutagen.mp4 import MP4
        from mutagen.oggopus import OggOpus
        from mutagen.oggvorbis import OggVorbis

        audio = mutagen.File(file_path)

        if audio is not None:
            # Get duration
            if hasattr(audio, "info") and audio.info:
                duration = audio.info.length if audio.info.length else 0.0

            # Try to extract tags based on file type
            if isinstance(audio, MP3):
                try:
                    tags = EasyID3(file_path)
                    title = tags.get("title", [title])[0]
                    artist = tags.get("artist", [artist])[0]
                    album = tags.get("album", [album])[0]
                    genre = tags.get("genre", [genre])[0]
                    date_val = tags.get("date", [None])[0]
                    if date_val:
                        try:
                            year = int(date_val[:4])
                        except (ValueError, TypeError):
                            pass
                except Exception:
                    pass

                # Extract cover art from ID3
                try:
                    id3_tags = ID3(file_path)
                    for key in id3_tags:
                        if key.startswith("APIC"):
                            apic = id3_tags[key]
                            img_ext = ".jpg"
                            if apic.mime and "png" in apic.mime:
                                img_ext = ".png"
                            cover_name = f"{uuid.uuid4()}{img_ext}"
                            cover_art_path = os.path.join(settings.UPLOAD_DIR, cover_name)
                            with open(cover_art_path, "wb") as img_f:
                                img_f.write(apic.data)
                            break
                except Exception:
                    pass

            elif isinstance(audio, FLAC):
                title = audio.get("title", [title])[0]
                artist = audio.get("artist", [artist])[0]
                album = audio.get("album", [album])[0]
                genre = audio.get("genre", [genre])[0]
                date_val = audio.get("date", [None])[0]
                if date_val:
                    try:
                        year = int(date_val[:4])
                    except (ValueError, TypeError):
                        pass
                # FLAC cover art
                if audio.pictures:
                    pic = audio.pictures[0]
                    img_ext = ".jpg"
                    if pic.mime and "png" in pic.mime:
                        img_ext = ".png"
                    cover_name = f"{uuid.uuid4()}{img_ext}"
                    cover_art_path = os.path.join(settings.UPLOAD_DIR, cover_name)
                    with open(cover_art_path, "wb") as img_f:
                        img_f.write(pic.data)

            elif isinstance(audio, MP4):
                title = audio.tags.get("\xa9nam", [title])[0] if audio.tags else title
                artist = audio.tags.get("\xa9ART", [artist])[0] if audio.tags else artist
                album = audio.tags.get("\xa9alb", [album])[0] if audio.tags else album
                genre = audio.tags.get("\xa9gen", [genre])[0] if audio.tags else genre
                date_val = audio.tags.get("\xa9day", [None])[0] if audio.tags else None
                if date_val:
                    try:
                        year = int(str(date_val)[:4])
                    except (ValueError, TypeError):
                        pass
                # MP4 cover art
                if audio.tags and "covr" in audio.tags:
                    cover_data = audio.tags["covr"][0]
                    cover_name = f"{uuid.uuid4()}.jpg"
                    cover_art_path = os.path.join(settings.UPLOAD_DIR, cover_name)
                    with open(cover_art_path, "wb") as img_f:
                        img_f.write(bytes(cover_data))

            elif isinstance(audio, (OggOpus, OggVorbis)):
                if audio.tags:
                    title = audio.tags.get("title", [title])[0]
                    artist = audio.tags.get("artist", [artist])[0]
                    album = audio.tags.get("album", [album])[0]
                    genre = audio.tags.get("genre", [genre])[0]
                    date_val = audio.tags.get("date", [None])[0] if "date" in audio.tags else None
                    if date_val:
                        try:
                            year = int(date_val[:4])
                        except (ValueError, TypeError):
                            pass
                # OGG cover art: stored as base64 FLAC Picture in metadata_block_picture
                if audio.tags and "metadata_block_picture" in audio.tags:
                    import base64
                    from mutagen.flac import Picture
                    try:
                        pic_data = base64.b64decode(audio.tags["metadata_block_picture"][0])
                        pic = Picture(pic_data)
                        if pic.data:
                            img_ext = ".jpg"
                            if pic.mime and "png" in pic.mime:
                                img_ext = ".png"
                            cover_name = f"{uuid.uuid4()}{img_ext}"
                            cover_art_path = os.path.join(settings.UPLOAD_DIR, cover_name)
                            with open(cover_art_path, "wb") as img_f:
                                img_f.write(pic.data)
                    except Exception:
                        pass

            else:
                # Generic mutagen file - try to get common tags
                if audio.tags:
                    title = str(audio.tags.get("title", [title])[0]) if "title" in audio.tags else title
                    artist = str(audio.tags.get("artist", [artist])[0]) if "artist" in audio.tags else artist
                    album = str(audio.tags.get("album", [album])[0]) if "album" in audio.tags else album
                    genre = str(audio.tags.get("genre", [genre])[0]) if "genre" in audio.tags else genre

            # ----- Fallback: try ID3 on any file (some m4a/webm have ID3 tags) -----
            if cover_art_path is None:
                try:
                    id3_tags = ID3(file_path)
                    for key in id3_tags:
                        if key.startswith("APIC"):
                            apic = id3_tags[key]
                            img_ext = ".jpg"
                            if apic.mime and "png" in apic.mime:
                                img_ext = ".png"
                            cover_name = f"{uuid.uuid4()}{img_ext}"
                            cover_art_path = os.path.join(settings.UPLOAD_DIR, cover_name)
                            with open(cover_art_path, "wb") as img_f:
                                img_f.write(apic.data)
                            break
                except Exception:
                    pass

            # ----- Fallback: try pictures attribute (works for FLAC, OGG) -----
            if cover_art_path is None and hasattr(audio, "pictures") and audio.pictures:
                try:
                    pic = audio.pictures[0]
                    img_ext = ".jpg"
                    if pic.mime and "png" in pic.mime:
                        img_ext = ".png"
                    cover_name = f"{uuid.uuid4()}{img_ext}"
                    cover_art_path = os.path.join(settings.UPLOAD_DIR, cover_name)
                    with open(cover_art_path, "wb") as img_f:
                        img_f.write(pic.data)
                except Exception:
                    pass

    except Exception:
        # If mutagen fails entirely, just use defaults
        pass

    # --- Compress audio to target bitrate to save storage ---
    compressed_path = _compress_audio(file_path, settings.AUDIO_BITRATE)
    if compressed_path and compressed_path != file_path:
        # Remove the original, use compressed version
        os.remove(file_path)
        file_path = compressed_path
        file_size = os.path.getsize(file_path)
        # Re-read duration from compressed file if needed
        try:
            import mutagen
            compressed_audio = mutagen.File(compressed_path)
            if compressed_audio and hasattr(compressed_audio, "info") and compressed_audio.info:
                duration = compressed_audio.info.length or duration
        except Exception:
            pass

    track = models.Track(
        title=title,
        artist=artist,
        album=album,
        genre=genre,
        duration=duration,
        cover_art_path=cover_art_path,
        file_path=file_path,
        file_size=file_size,
        uploaded_by=current_user.id,
        year=year,
    )
    db.add(track)
    db.commit()
    db.refresh(track)

    return track_to_response(track)


class TrackUpdate(BaseModel):
    title: str | None = None
    artist: str | None = None
    album: str | None = None
    genre: str | None = None


@router.patch("/{track_id}", response_model=schemas.TrackResponse)
def update_track(
    track_id: int,
    body: TrackUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    track = db.query(models.Track).filter(models.Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # Only admin or uploader can edit
    if not current_user.is_admin and track.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this track")

    if body.title is not None:
        track.title = body.title
    if body.artist is not None:
        track.artist = body.artist
    if body.album is not None:
        track.album = body.album
    if body.genre is not None:
        track.genre = body.genre

    db.commit()
    db.refresh(track)
    return track_to_response(track)


class PlayRequest(BaseModel):
    played_at: str | None = None  # ISO timestamp from offline queue


@router.post("/{track_id}/play")
def record_play(
    track_id: int,
    body: PlayRequest | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    track = db.query(models.Track).filter(models.Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # Increment play count
    track.play_count = (track.play_count or 0) + 1

    # Use provided timestamp (offline play) or default to now
    from datetime import datetime, timezone
    listened_at = None
    if body and body.played_at:
        try:
            listened_at = datetime.fromisoformat(body.played_at.replace("Z", "+00:00"))
        except ValueError:
            pass

    # Create listening history entry
    history = models.ListeningHistory(
        user_id=current_user.id,
        track_id=track_id,
        duration_listened=track.duration,
    )
    if listened_at:
        history.listened_at = listened_at
    db.add(history)
    db.commit()

    return {"message": "Play recorded", "play_count": track.play_count}


@router.delete("/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_track(
    track_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    track = db.query(models.Track).filter(models.Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # Only admin or uploader can delete
    if not current_user.is_admin and track.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this track",
        )

    # Remove files from disk
    if track.file_path and os.path.isfile(track.file_path):
        os.remove(track.file_path)
    if track.cover_art_path and os.path.isfile(track.cover_art_path):
        os.remove(track.cover_art_path)

    db.delete(track)
    db.commit()

    return None
