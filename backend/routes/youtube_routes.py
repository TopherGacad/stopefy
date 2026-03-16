import glob
import os
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from dependencies import get_current_user
from routes.track_routes import track_to_response
import models
import schemas

router = APIRouter(prefix="/api/youtube", tags=["youtube"])


def _find_ffmpeg() -> str | None:
    """Return the directory containing ffmpeg, or None if it's already on PATH."""
    import shutil

    if shutil.which("ffmpeg"):
        return None  # already on PATH

    # WinGet install location
    winget_base = os.path.join(
        os.environ.get("LOCALAPPDATA", ""),
        "Microsoft", "WinGet", "Packages",
    )
    if os.path.isdir(winget_base):
        for dirpath, dirnames, filenames in os.walk(winget_base):
            if "ffmpeg.exe" in filenames:
                return dirpath

    return None


FFMPEG_LOCATION = _find_ffmpeg()


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class YouTubeDownloadRequest(BaseModel):
    url: str


class YouTubeSearchRequest(BaseModel):
    query: str


class YouTubeSearchResult(BaseModel):
    id: str
    url: str
    title: str
    channel: str
    duration: float
    thumbnail: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_artist_title(video_title: str, channel: str | None) -> tuple[str, str]:
    """Try to split 'Artist - Title' from the video title.

    Falls back to (channel_name, video_title) when the pattern is not found.
    """
    # Common separators: " - ", " – ", " — "
    match = re.match(r"^(.+?)\s*[-–—]\s*(.+)$", video_title)
    if match:
        artist = match.group(1).strip()
        title = match.group(2).strip()
        # Strip common suffixes like "(Official Video)", "[Lyrics]", etc.
        title = re.sub(r"\s*[\(\[](official|lyrics|audio|video|hd|hq|mv|music video).*?[\)\]]", "", title, flags=re.IGNORECASE).strip()
        if artist and title:
            return artist, title

    # Fallback: use channel name as artist, full title as track title
    artist = channel or "Unknown Artist"
    title = video_title or "Unknown Title"
    return artist, title


# ---------------------------------------------------------------------------
# POST /api/youtube/download
# ---------------------------------------------------------------------------


@router.post("/download", response_model=schemas.TrackResponse)
def youtube_download(
    body: YouTubeDownloadRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    import yt_dlp

    # --- Extract info first (no download) to check for duplicates ---
    ydl_info_opts: dict = {
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
    }
    if FFMPEG_LOCATION:
        ydl_info_opts["ffmpeg_location"] = FFMPEG_LOCATION

    try:
        with yt_dlp.YoutubeDL(ydl_info_opts) as ydl:
            pre_info = ydl.extract_info(body.url, download=False)
    except Exception:
        pre_info = None

    if pre_info:
        video_title_pre = pre_info.get("title", "")
        channel_pre = pre_info.get("uploader") or pre_info.get("channel") or pre_info.get("artist")
        artist_pre, title_pre = _parse_artist_title(video_title_pre, channel_pre)

        # Check if a track with the same title + artist already exists (any user)
        existing = (
            db.query(models.Track)
            .filter(
                models.Track.title == title_pre,
                models.Track.artist == artist_pre,
            )
            .first()
        )
        if existing:
            data = track_to_response(existing)
            return JSONResponse(
                content=data.model_dump(mode="json"),
                headers={"X-Track-Existing": "true"},
            )

        # Reject videos longer than 10 minutes — likely not a song
        duration_pre = float(pre_info.get("duration", 0) or 0)
        if duration_pre > 600:
            raise HTTPException(
                status_code=400,
                detail="This video is too long to be a song (over 10 minutes)",
            )

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    audio_id = str(uuid.uuid4())
    audio_filename = f"{audio_id}.mp3"
    audio_path = os.path.join(settings.UPLOAD_DIR, audio_filename)

    thumb_id = str(uuid.uuid4())

    ydl_opts: dict = {
        "format": "bestaudio/best",
        "outtmpl": os.path.join(settings.UPLOAD_DIR, f"{audio_id}.%(ext)s"),
        "writethumbnail": True,
        # Thumbnail output template (yt-dlp >= 2023.01)
        "outtmpl_na_placeholder": "",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": settings.AUDIO_BITRATE,
            },
            {
                "key": "FFmpegThumbnailsConvertor",
                "format": "jpg",
            },
        ],
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
    }
    if FFMPEG_LOCATION:
        ydl_opts["ffmpeg_location"] = FFMPEG_LOCATION

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(body.url, download=True)
    except yt_dlp.utils.DownloadError as exc:
        raise HTTPException(status_code=400, detail=f"Download failed: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not process URL: {exc}")

    if info is None:
        raise HTTPException(status_code=400, detail="Could not extract video information")

    # Ensure the mp3 file actually exists
    if not os.path.isfile(audio_path):
        raise HTTPException(status_code=500, detail="Audio conversion failed – mp3 file not found")

    # --- Locate the thumbnail that yt-dlp wrote ---
    cover_art_path: str | None = None
    # yt-dlp writes the thumbnail next to the audio file using the same stem
    thumb_patterns = [
        os.path.join(settings.UPLOAD_DIR, f"{audio_id}.jpg"),
        os.path.join(settings.UPLOAD_DIR, f"{audio_id}.png"),
        os.path.join(settings.UPLOAD_DIR, f"{audio_id}.webp"),
    ]
    for candidate in thumb_patterns:
        if os.path.isfile(candidate):
            # Rename to a dedicated thumb file so it won't clash
            final_thumb = os.path.join(settings.UPLOAD_DIR, f"{thumb_id}.jpg")
            os.rename(candidate, final_thumb)
            cover_art_path = final_thumb
            break

    # If we still don't have a thumbnail, try a broader glob
    if cover_art_path is None:
        for match in glob.glob(os.path.join(settings.UPLOAD_DIR, f"{audio_id}.*")):
            ext_lower = os.path.splitext(match)[1].lower()
            if ext_lower in (".jpg", ".jpeg", ".png", ".webp"):
                final_thumb = os.path.join(settings.UPLOAD_DIR, f"{thumb_id}.jpg")
                os.rename(match, final_thumb)
                cover_art_path = final_thumb
                break

    # Fallback: download thumbnail from URL provided by yt-dlp
    if cover_art_path is None:
        thumb_url = info.get("thumbnail")
        if thumb_url:
            import urllib.request
            try:
                final_thumb = os.path.join(settings.UPLOAD_DIR, f"{thumb_id}.jpg")
                urllib.request.urlretrieve(thumb_url, final_thumb)
                if os.path.isfile(final_thumb) and os.path.getsize(final_thumb) > 0:
                    cover_art_path = final_thumb
            except Exception:
                pass  # Non-critical — track works without cover art

    # --- Extract metadata ---
    video_title: str = info.get("title", "Unknown Title")
    channel: str | None = info.get("uploader") or info.get("channel") or info.get("artist")
    duration: float = float(info.get("duration", 0) or 0)

    artist, title = _parse_artist_title(video_title, channel)

    file_size = os.path.getsize(audio_path)

    # Try to extract genre from yt-dlp metadata
    genre = "Unknown"
    yt_genre = info.get("genre") or info.get("categories", [None])[0] if info.get("categories") else None
    if yt_genre and yt_genre.lower() not in ("music", "entertainment", "people & blogs", ""):
        genre = yt_genre
    elif info.get("tags"):
        # Check tags for known genre keywords
        known_genres = {
            "pop", "rock", "hip-hop", "hip hop", "rap", "r&b", "rnb",
            "electronic", "edm", "jazz", "classical", "country", "metal",
            "indie", "latin", "k-pop", "kpop", "reggae", "blues", "soul",
            "folk", "punk", "alternative", "dance", "opm", "acoustic",
        }
        for tag in info["tags"]:
            if tag.lower() in known_genres:
                genre = tag.title()
                break

    track = models.Track(
        title=title,
        artist=artist,
        album="YouTube",
        genre=genre,
        duration=duration,
        cover_art_path=cover_art_path,
        file_path=audio_path,
        file_size=file_size,
        uploaded_by=current_user.id,
        year=None,
    )
    db.add(track)
    db.commit()
    db.refresh(track)

    return track_to_response(track)


# ---------------------------------------------------------------------------
# POST /api/youtube/search
# ---------------------------------------------------------------------------


@router.post("/backfill-covers")
def backfill_covers(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Find tracks without cover art and try to download thumbnails from YouTube."""
    import urllib.request

    tracks = (
        db.query(models.Track)
        .filter(
            models.Track.cover_art_path.is_(None),
            models.Track.uploaded_by == current_user.id,
        )
        .all()
    )

    updated = 0
    for track in tracks:
        # Search YouTube for this track to find a thumbnail
        query = f"{track.artist} {track.title}"
        thumb_url = None

        try:
            import yt_dlp

            ydl_opts = {
                "default_search": "ytsearch1",
                "noplaylist": True,
                "quiet": True,
                "no_warnings": True,
                "skip_download": True,
                "extract_flat": False,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(f"ytsearch1:{query}", download=False)
                if info and "entries" in info and info["entries"]:
                    entry = info["entries"][0]
                    if entry:
                        thumb_url = entry.get("thumbnail")
        except Exception:
            continue

        if not thumb_url:
            continue

        try:
            thumb_id = str(uuid.uuid4())
            final_thumb = os.path.join(settings.UPLOAD_DIR, f"{thumb_id}.jpg")
            urllib.request.urlretrieve(thumb_url, final_thumb)
            if os.path.isfile(final_thumb) and os.path.getsize(final_thumb) > 0:
                track.cover_art_path = final_thumb
                updated += 1
        except Exception:
            continue

    if updated > 0:
        db.commit()

    return {"message": f"Updated cover art for {updated} of {len(tracks)} tracks"}


@router.post("/search", response_model=list[YouTubeSearchResult])
def youtube_search(body: YouTubeSearchRequest):
    import yt_dlp

    if not body.query.strip():
        raise HTTPException(status_code=400, detail="Search query must not be empty")

    # Use extract_flat to get search listing without hitting each video
    # This avoids failures from unavailable/geo-blocked videos
    ydl_opts: dict = {
        "default_search": "ytsearch20",
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": "in_playlist",
        "ignoreerrors": True,
    }

    # Bias toward music results
    search_query = body.query.strip()
    query_lower = search_query.lower()
    music_keywords = {"song", "music", "audio", "lyrics", "official", "remix", "cover", "acoustic"}
    if not any(kw in query_lower for kw in music_keywords):
        search_query += " song"

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"ytsearch20:{search_query}", download=False)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Search failed: {exc}")

    if info is None or "entries" not in info:
        return []

    results: list[YouTubeSearchResult] = []
    for entry in info["entries"]:
        if entry is None:
            continue

        video_id = entry.get("id", "")
        video_title = entry.get("title", "Unknown Title")
        channel = entry.get("uploader") or entry.get("channel") or "Unknown Artist"
        duration = float(entry.get("duration", 0) or 0)
        url = entry.get("webpage_url") or entry.get("url") or ""

        # Skip non-music: too short (<30s) or too long (>10min)
        if duration > 0 and (duration < 30 or duration > 600):
            continue

        # Skip non-music content by title keywords
        title_lower = video_title.lower()
        non_music = {
            "vlog", "mukbang", "unboxing", "haul", "grwm", "get ready with me",
            "tutorial", "review", "reaction", "gameplay", "playthrough",
            "let's play", "podcast", "interview", "documentary", "trailer",
            "behind the scenes", "cooking", "recipe", "asmr", "prank",
            "challenge", "q&a", "storytime", "story time", "day in my life",
            "morning routine", "night routine", "room tour", "house tour",
            "full movie", "full episode", "compilation",
        }
        if any(kw in title_lower for kw in non_music):
            continue

        # With extract_flat, url may just be the video id
        if url and not url.startswith("http"):
            url = f"https://www.youtube.com/watch?v={video_id}"

        # Build thumbnail URL from video id if not provided
        thumbnail = entry.get("thumbnail") or ""
        if not thumbnail and video_id:
            thumbnail = f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"

        artist, title = _parse_artist_title(video_title, channel)

        results.append(
            YouTubeSearchResult(
                id=video_id or str(len(results)),
                url=url,
                title=title,
                channel=channel,
                duration=duration,
                thumbnail=thumbnail,
            )
        )

        if len(results) >= 5:
            break

    return results
