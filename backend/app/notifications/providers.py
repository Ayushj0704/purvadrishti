"""Alert fan-out per PS deliverable (d): dashboard + webhook live;
email/SMS send for real only when provider keys are configured, else the
attempt is LOGGED with status provider-missing (never silently faked).
"""
import httpx
from .base import NotificationProvider
from app.core.config import settings
from app.core.logging import log


class DashboardProvider(NotificationProvider):
    def __init__(self, queue):
        self.queue = queue

    async def send(self, recipient, message):
        await self.queue.put({"event": "alert.created", "data": message})
        return {"channel": "dashboard", "status": "queued"}


class WebhookProvider(NotificationProvider):
    """Real HTTP POST to LEA/bank/I4C endpoint (works free)."""

    async def send(self, recipient, message):
        url = settings.alert_webhook_url
        if not url:
            log.info(f"webhook skipped (no URL): {message}")
            return {"channel": "webhook", "status": "skipped-no-url"}
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post(url, json={"to": recipient, "alert": message})
            return {"channel": "webhook", "status": f"http-{r.status_code}"}
        except Exception as e:
            log.warning(f"webhook failed: {e}")
            return {"channel": "webhook", "status": f"error: {e}"}


class EmailProvider(NotificationProvider):
    """Sends via Resend API when RESEND_API_KEY set; else logged."""

    async def send(self, recipient, message):
        if not settings.resend_api_key or not recipient:
            log.info(f"email logged (no provider key) to={recipient}: {message}")
            return {"channel": "email", "status": "logged-no-provider-key"}
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                r = await c.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                    json={"from": settings.alert_from_email, "to": [recipient],
                          "subject": f"[{message.get('severity')}] Cash-out alert",
                          "text": str(message)})
            return {"channel": "email", "status": f"http-{r.status_code}"}
        except Exception as e:
            return {"channel": "email", "status": f"error: {e}"}


class SMSProvider(NotificationProvider):
    """Sends via generic SMS HTTP API when SMS_API_URL+SMS_API_KEY set;
    else logged. (No free-SMS illusion: needs a real gateway key.)"""

    async def send(self, recipient, message):
        if not settings.sms_api_url or not settings.sms_api_key or not recipient:
            log.info(f"sms logged (no gateway) to={recipient}: {message}")
            return {"channel": "sms", "status": "logged-no-gateway"}
        try:
            text = f"ALERT {message.get('severity')}: {message.get('atm_id')} score={message.get('score')}"
            async with httpx.AsyncClient(timeout=15) as c:
                r = await c.post(settings.sms_api_url,
                                 headers={"Authorization": f"Bearer {settings.sms_api_key}"},
                                 json={"to": recipient, "text": text})
            return {"channel": "sms", "status": f"http-{r.status_code}"}
        except Exception as e:
            return {"channel": "sms", "status": f"error: {e}"}


class FirebaseProvider(NotificationProvider):
    """Stub: enable only when FIREBASE_ENABLED=true + credentials provided."""

    async def send(self, recipient, message):
        if not settings.firebase_enabled:
            return {"channel": "firebase", "status": "skipped-disabled"}
        return {"channel": "firebase", "status": "not-wired"}


async def fan_out(alert_id, case_id, severity, atm_code, score, window,
                  queue, emails=(), phones=()):
    """Send across enabled channels; returns delivery report list."""
    msg = {"alert_id": alert_id, "case_id": case_id, "severity": severity,
           "atm_id": atm_code, "score": score, "window": window}
    report = [await DashboardProvider(queue).send("dashboard", msg)]
    if "webhook" in settings.alert_channels:
        report.append(await WebhookProvider().send(settings.alert_webhook_url, msg))
    if "email" in settings.alert_channels:
        for to in (emails or [settings.alert_email_to]):
            if to:
                report.append(await EmailProvider().send(to, msg))
    if "sms" in settings.alert_channels:
        for to in phones:
            report.append(await SMSProvider().send(to, msg))
    return report
