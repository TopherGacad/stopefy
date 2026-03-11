from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# --- User Schemas ---


class UserCreate(BaseModel):
    username: str
    email: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    is_admin: bool
    avatar_url: Optional[str] = None
    created_at: datetime


# --- Token Schemas ---


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserResponse


class RefreshRequest(BaseModel):
    refresh_token: str


# --- Track Schemas ---


class TrackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    artist: str
    album: str
    genre: str
    duration: float
    cover_art_url: Optional[str] = None
    uploaded_by: int
    uploaded_at: datetime
    play_count: int
    year: Optional[int] = None
    file_size: Optional[int] = None


class PaginatedTracks(BaseModel):
    tracks: list[TrackResponse]
    total: int
    page: int
    pages: int


# --- Playlist Schemas ---


class PlaylistCreate(BaseModel):
    name: str
    description: str = ""


class PlaylistUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class PlaylistAddTrack(BaseModel):
    track_id: int


class PlaylistResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    cover_image: Optional[str] = None
    created_by: int
    created_at: datetime
    updated_at: datetime
    tracks: list[TrackResponse] = []
    track_count: int = 0


# --- Search Schemas ---


class SearchResults(BaseModel):
    tracks: list[TrackResponse]
    artists: list[str]
    playlists: list[PlaylistResponse]


# --- Wrapped Schemas ---


class WrappedTopTrack(BaseModel):
    id: int
    title: str
    artist: str
    album: str
    cover_art_url: Optional[str] = None
    plays: int


class WrappedTopArtist(BaseModel):
    name: str
    plays: int
    minutes: float


class WrappedTopGenre(BaseModel):
    genre: str
    plays: int


class WrappedResponse(BaseModel):
    year: int
    total_minutes: float
    top_tracks: list[WrappedTopTrack]
    top_artists: list[WrappedTopArtist]
    top_genres: list[WrappedTopGenre]
    total_tracks_played: int
    total_unique_tracks: int
