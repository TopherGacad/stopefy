import os

from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from config import settings
from database import engine, Base, get_db
from dependencies import get_current_user
from routes import auth_router, track_router, playlist_router, wrapped_router, youtube_router, admin_router
from routes.track_routes import track_to_response
import models
import schemas

app = FastAPI(title="Stopefy API", version="1.0.0", redirect_slashes=False)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(track_router)
app.include_router(playlist_router)
app.include_router(wrapped_router)
app.include_router(youtube_router)
app.include_router(admin_router)


@app.on_event("startup")
def on_startup():
    # Run Alembic migrations automatically (creates tables if fresh, migrates if existing)
    from alembic.config import Config
    from alembic import command

    alembic_cfg = Config("alembic.ini")
    try:
        command.upgrade(alembic_cfg, "head")
    except Exception:
        # Fallback: if Alembic fails (e.g. fresh install without versions), use create_all
        Base.metadata.create_all(bind=engine)

    # Create uploads directory if it doesn't exist
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


@app.get("/")
def root():
    return {"message": "Stopefy API", "version": "1.0.0"}


@app.get("/api/search", response_model=schemas.SearchResults)
def search(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    search_term = f"%{q}%"

    # Search tracks
    tracks = (
        db.query(models.Track)
        .filter(
            (models.Track.title.ilike(search_term))
            | (models.Track.artist.ilike(search_term))
            | (models.Track.album.ilike(search_term))
            | (models.Track.genre.ilike(search_term))
        )
        .limit(20)
        .all()
    )

    # Get unique artists from matching tracks
    artist_rows = (
        db.query(models.Track.artist)
        .filter(models.Track.artist.ilike(search_term))
        .distinct()
        .limit(10)
        .all()
    )
    artists = [row[0] for row in artist_rows]

    # Search playlists
    playlists_db = (
        db.query(models.Playlist)
        .filter(
            (models.Playlist.name.ilike(search_term))
            | (models.Playlist.description.ilike(search_term))
        )
        .limit(10)
        .all()
    )

    playlist_responses = []
    for p in playlists_db:
        pt_entries = (
            db.query(models.PlaylistTrack)
            .filter(models.PlaylistTrack.playlist_id == p.id)
            .order_by(models.PlaylistTrack.position)
            .all()
        )
        p_tracks = []
        for pt in pt_entries:
            t = db.query(models.Track).filter(models.Track.id == pt.track_id).first()
            if t:
                p_tracks.append(track_to_response(t))
        playlist_responses.append(
            schemas.PlaylistResponse(
                id=p.id,
                name=p.name,
                description=p.description,
                cover_image=p.cover_image,
                created_by=p.created_by,
                created_at=p.created_at,
                updated_at=p.updated_at,
                tracks=p_tracks,
                track_count=len(p_tracks),
            )
        )

    return schemas.SearchResults(
        tracks=[track_to_response(t) for t in tracks],
        artists=artists,
        playlists=playlist_responses,
    )
