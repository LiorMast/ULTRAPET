"""test_mailer.py — The email backends (app/mailer.py) and who receives the staff notifications."""
import logging

from app import mailer
from app.database.models.settings import Setting


def test_memory_keeps_the_message(app, database, outbox):
    mailer.send_mail(["a@x.co"], "Hello", "Body text", reply_to="b@x.co")
    [message] = outbox
    assert (message["To"], message["Subject"], message["Reply-To"], message["From"]) == ("a@x.co", "Hello", "b@x.co", "no-reply@ultrapet.co.il")
    assert message.get_content().strip() == "Body text"


def test_log_writes_it_to_the_log_and_off_sends_nothing(app, database, outbox, caplog):
    app.config["MAIL_BACKEND"] = "log"
    try:
        with caplog.at_level(logging.INFO, logger=app.logger.name):
            mailer.send_mail(["a@x.co"], "Logged", "Body")
        app.config["MAIL_BACKEND"] = "off"
        mailer.send_mail(["a@x.co"], "Dropped", "Body")
    finally:
        app.config["MAIL_BACKEND"] = "memory"
    assert "Logged" in caplog.text and "Dropped" not in caplog.text
    assert outbox == []


def test_nothing_is_sent_without_a_recipient(app, database, outbox):
    mailer.send_mail([], "Nobody", "Body")
    assert outbox == []


def test_recipients_fall_back_to_the_contact_email(app, database):
    assert mailer.staff_recipients() == []
    database.add(Setting(key="contact_email", value="office@ultrapet.co.il"))
    database.commit()
    assert mailer.staff_recipients() == ["office@ultrapet.co.il"]
    app.config["LEADS_NOTIFY_TO"] = " sales@ultrapet.co.il ,, "
    try:
        assert mailer.staff_recipients() == ["sales@ultrapet.co.il"]
    finally:
        app.config["LEADS_NOTIFY_TO"] = ""
