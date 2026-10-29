"""Emergency alert delivery.
SMS is sent ONLY when Twilio credentials are configured. Otherwise every alert is recorded with
status "not_sent" so the UI can tell the user honestly that nobody was notified automatically.
Phone calls and emergency-services dispatch are NOT implemented."""
import requests


class NullNotifier:
    channel = "none"

    def send_sms(self, to: str, body: str) -> str:
        return "not_sent"


class TwilioNotifier:
    channel = "sms"

    def __init__(self, sid, token, from_number):
        self.sid, self.token, self.from_number = sid, token, from_number

    def send_sms(self, to, body):
        try:
            r = requests.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{self.sid}/Messages.json",
                auth=(self.sid, self.token), data={"To": to, "From": self.from_number, "Body": body}, timeout=15)
            return "sent" if r.status_code < 300 else "failed"
        except requests.RequestException:
            return "failed"


def build_notifier(cfg):
    if cfg["TWILIO_ACCOUNT_SID"] and cfg["TWILIO_AUTH_TOKEN"] and cfg["TWILIO_FROM_NUMBER"]:
        return TwilioNotifier(cfg["TWILIO_ACCOUNT_SID"], cfg["TWILIO_AUTH_TOKEN"], cfg["TWILIO_FROM_NUMBER"])
    return NullNotifier()
