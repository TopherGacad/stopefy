from routes.auth_routes import router as auth_router
from routes.track_routes import router as track_router
from routes.playlist_routes import router as playlist_router
from routes.wrapped_routes import router as wrapped_router
from routes.youtube_routes import router as youtube_router
from routes.admin_routes import router as admin_router

__all__ = ["auth_router", "track_router", "playlist_router", "wrapped_router", "youtube_router", "admin_router"]
