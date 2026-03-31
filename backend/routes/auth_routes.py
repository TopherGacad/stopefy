from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from config import settings
from auth import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from dependencies import get_current_user
import models
import schemas

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=schemas.RegisterResponse)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if username already exists
    existing_user = (
        db.query(models.User)
        .filter(models.User.username == user_data.username)
        .first()
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    # Check if email already exists
    existing_email = (
        db.query(models.User)
        .filter(models.User.email == user_data.email)
        .first()
    )
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Check if already pending
    existing_pending = (
        db.query(models.PendingRegistration)
        .filter(
            (models.PendingRegistration.email == user_data.email)
            | (models.PendingRegistration.username == user_data.username)
        )
        .first()
    )
    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A registration request is already pending for this email or username. Please wait for admin approval.",
        )

    pending = models.PendingRegistration(
        username=user_data.username,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        otp_code="",
        expires_at=datetime(2099, 1, 1),
    )
    db.add(pending)
    db.commit()

    return schemas.RegisterResponse(
        message="Your registration is pending admin approval. You'll be able to log in once approved.",
        email=user_data.email,
    )


@router.post("/login", response_model=schemas.TokenResponse)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    # Check if user is still pending approval
    pending = (
        db.query(models.PendingRegistration)
        .filter(models.PendingRegistration.username == credentials.username)
        .first()
    )
    if pending:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending admin approval. Please wait.",
        )

    user = (
        db.query(models.User)
        .filter(models.User.username == credentials.username)
        .first()
    )
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return schemas.TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=schemas.UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=schemas.TokenResponse)
def refresh_token(body: schemas.RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = int(payload.get("sub"))
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    new_access_token = create_access_token(data={"sub": str(user.id)})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return schemas.TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user=schemas.UserResponse.model_validate(user),
    )


@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return schemas.UserResponse.model_validate(current_user)


@router.patch("/me", response_model=schemas.UserResponse)
def update_profile(
    body: schemas.UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if body.username is not None:
        existing = (
            db.query(models.User)
            .filter(models.User.username == body.username, models.User.id != current_user.id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = body.username

    if body.email is not None:
        existing = (
            db.query(models.User)
            .filter(models.User.email == body.email, models.User.id != current_user.id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        current_user.email = body.email

    db.commit()
    db.refresh(current_user)
    return schemas.UserResponse.model_validate(current_user)


@router.post("/me/change-password")
def change_password(
    body: schemas.ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    current_user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Password changed successfully"}
