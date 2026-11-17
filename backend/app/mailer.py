"""mailer.py — Sends the backend's emails (for now: staff are told about every new request for a business account).

One function, `send_mail`, through the backend the config MAIL_BACKEND picks:
- "smtp": through the SMTP server SMTP_HOST:SMTP_PORT (STARTTLS when SMTP_TLS, signing in with SMTP_USER /
  SMTP_PASSWORD when set), from MAIL_FROM, in a background thread so the request that caused it answers at once;
- "log": writes the message to the app log instead (the default when no SMTP_HOST is configured);
- "memory": keeps the messages in `app.extensions["outbox"]` (the tests read them there);
- "off": does nothing.
A failed send is logged and never fails the request. Development runs Mailpit (compose service `mailpit`): every
message lands in its inbox at http://localhost:8025 instead of being delivered.

`staff_recipients` reads who gets the staff emails: LEADS_NOTIFY_TO (comma separated), else the site's contact email
(setting `contact_email`). Used by the customers blueprint (POST /api/leads).
"""
import smtplib
import threading
from email.message import EmailMessage
from typing import Any

from flask import Flask, current_app

from app.database.models.settings import get_setting


def staff_recipients() -> list[str]:
    """Who receives the staff notifications.

    Returns:
        The addresses of LEADS_NOTIFY_TO (comma separated), else the setting `contact_email`; empty when neither is set.
    """
    configured = [address.strip() for address in current_app.config.get("LEADS_NOTIFY_TO", "").split(",")]
    addresses = [address for address in configured if address]
    if addresses:
        return addresses
    fallback = get_setting("contact_email")
    return [fallback] if isinstance(fallback, str) and fallback.strip() else []


def build_message(config: dict[str, Any], to: list[str], subject: str, body: str, reply_to: str | None) -> EmailMessage:
    """Builds a plain-text email.

    Args:
        config: The app config (MAIL_FROM).
        to: The recipients.
        subject: The subject line.
        body: The plain-text body.
        reply_to: The Reply-To address (the person the mail is about), or None.

    Returns:
        The message.
    """
    message = EmailMessage()
    message["From"] = config.get("MAIL_FROM") or "no-reply@ultrapet.co.il"
    message["To"] = ", ".join(to)
    message["Subject"] = subject
    if reply_to:
        message["Reply-To"] = reply_to
    message.set_content(body)
    return message


def deliver(app: Flask, message: EmailMessage) -> None:
    """Sends a message through the configured SMTP server (a background thread's job); a failure is logged.

    Args:
        app: The application (its config and logger).
        message: The message to send.
    """
    config = app.config
    try:
        with smtplib.SMTP(config["SMTP_HOST"], int(config.get("SMTP_PORT") or 587), timeout=20) as server:
            if config.get("SMTP_TLS", True):
                server.starttls()
            if config.get("SMTP_USER"):
                server.login(config["SMTP_USER"], config.get("SMTP_PASSWORD", ""))
            server.send_message(message)
    except (OSError, smtplib.SMTPException):
        app.logger.exception("Could not send the email %r", message["Subject"])


def send_mail(to: list[str], subject: str, body: str, reply_to: str | None = None) -> None:
    """Sends an email through the configured backend (see the module docstring); never raises.

    Args:
        to: The recipients; nothing is sent when empty.
        subject: The subject line.
        body: The plain-text body.
        reply_to: The Reply-To address, or None.
    """
    app = current_app._get_current_object()  # noqa: SLF001 (the real app, for the thread)
    backend = app.config.get("MAIL_BACKEND") or ("smtp" if app.config.get("SMTP_HOST") else "log")
    if backend == "off" or not to:
        if not to:
            app.logger.warning("No recipient for the email %r (set LEADS_NOTIFY_TO or contact_email)", subject)
        return
    message = build_message(app.config, to, subject, body, reply_to)
    if backend == "memory":
        app.extensions.setdefault("outbox", []).append(message)
    elif backend == "smtp":
        threading.Thread(target=deliver, args=(app, message), daemon=True, name="mail").start()
    else:
        app.logger.info("Email (MAIL_BACKEND=log) to %s: %s\n%s", message["To"], subject, body)
