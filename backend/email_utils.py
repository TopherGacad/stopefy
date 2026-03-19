import random
import smtplib
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from config import settings


def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def send_otp_email(to_email: str, otp_code: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Stopefy — Your verification code is {otp_code}"
    msg["From"] = f"Stopefy <{settings.SMTP_USER}>"
    msg["To"] = to_email
    msg["Reply-To"] = "noreply@stopefy.app"
    msg["X-Auto-Response-Suppress"] = "All"

    text = (
        f"Your Stopefy verification code is: {otp_code}\n\n"
        f"This code expires in {settings.OTP_EXPIRE_MINUTES} minutes.\n\n"
        "Please do not reply to this email."
    )

    html = f"""\
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#121212;color:#fff;border-radius:16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h2 style="margin:0;color:#F5E500;">Stopefy</h2>
      </div>
      <p style="color:#ccc;font-size:15px;">Enter this code to verify your email:</p>
      <div style="text-align:center;margin:24px 0;">
        <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#F5E500;">{otp_code}</span>
      </div>
      <p style="color:#888;font-size:13px;">This code expires in {settings.OTP_EXPIRE_MINUTES} minutes. If you didn't request this, you can ignore this email.</p>
      <p style="color:#555;font-size:11px;margin-top:24px;text-align:center;">This is an automated message — please do not reply.</p>
    </div>
    """

    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_APP_PASSWORD)
        server.sendmail(settings.SMTP_USER, to_email, msg.as_string())
