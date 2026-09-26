"""NCRP-aligned schema. Suspect + optional fields are nullable (§user-spec)."""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Index
from datetime import datetime
from app.db.session import Base


class Case(Base):
    """1 row = 1 NCRP complaint/report. Maps to spec §18 `cases` + user NCRP table."""
    __tablename__ = "cases"
    id = Column(Integer, primary_key=True)
    # complaint identity
    external_case_id = Column(String, unique=True, index=True)  # C-100234 / ack ID
    incident_datetime = Column(DateTime, nullable=True)
    reported_at = Column(DateTime, default=datetime.utcnow)
    incident_details = Column(Text, default="")
    crime_category = Column(String, default="Online Financial Fraud")
    crime_subcategory = Column(String, default="UPI")  # UPI/card/netbanking...
    fraud_type = Column(String, default="UPI")  # legacy alias of subcategory
    # geography (complainant context + incident geography)
    complainant_state = Column(String, default="")
    complainant_district = Column(String, default="")
    incident_state = Column(String, default="")
    incident_district = Column(String, default="")
    victim_lat = Column(Float, nullable=True)
    victim_lon = Column(Float, nullable=True)
    # financial context (masked refs only — never raw PAN/account)
    bank_name = Column(String, default="")
    transaction_id = Column(String, nullable=True)  # UTR, nullable
    transaction_datetime = Column(DateTime, nullable=True)
    fraud_amount = Column(Float, default=0)
    amount = Column(Float, default=0)  # legacy alias
    debited_account_ref = Column(String, default="")  # masked
    destination_bank = Column(String, default="")
    destination_account_ref = Column(String, nullable=True)  # masked, nullable
    merchant = Column(String, nullable=True)
    gateway = Column(String, nullable=True)
    card_ref = Column(String, nullable=True)  # masked
    evidence_ref = Column(String, default="")
    complainant_contact_ref = Column(String, default="")  # masked mobile/email
    # suspect block — ALL nullable ("if available" per NCRP)
    suspect_mobile = Column(String, nullable=True)
    suspect_email = Column(String, nullable=True)
    suspect_account_ref = Column(String, nullable=True)
    suspect_address = Column(String, nullable=True)
    suspect_photo_ref = Column(String, nullable=True)
    suspect_url = Column(String, nullable=True)
    status = Column(String, default="OPEN")
    created_at = Column(DateTime, default=datetime.utcnow)
    # ingestion source: manual (dashboard) vs cfcrms (I4C auto-fetch)
    source = Column(String, default="manual")


class Account(Base):
    """Account/network info from bank feeds (authorized integration)."""
    __tablename__ = "accounts"
    id = Column(Integer, primary_key=True)
    masked_account_ref = Column(String, unique=True, index=True)
    bank_id = Column(String, default="")
    state = Column(String, default="")
    recent_tx_count = Column(Integer, default=0)
    incoming_amount = Column(Float, default=0)
    outgoing_amount = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class Transaction(Base):
    """Transaction feed: tx after/around complaint (bank/FI integration)."""
    __tablename__ = "transactions"
    __table_args__ = (Index("ix_txn_case_id", "case_id"),)
    id = Column(Integer, primary_key=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True)
    transaction_id = Column(String, index=True, default="")
    timestamp = Column(DateTime, default=datetime.utcnow)
    source_account_ref = Column(String, default="")
    destination_account_ref = Column(String, default="")
    amount = Column(Float, default=0)
    transaction_type = Column(String, default="UPI")
    bank = Column(String, default="")
    status = Column(String, default="SETTLED")
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)


class ATM(Base):
    """ATM master reference data (platform-maintained)."""
    __tablename__ = "atms"
    id = Column(Integer, primary_key=True)
    atm_code = Column(String, unique=True, index=True)
    bank_id = Column(String, default="BANK-1")
    lat = Column(Float, default=0)
    lon = Column(Float, default=0)
    state = Column(String, default="")
    district = Column(String, default="")
    city = Column(String, default="")
    pincode = Column(String, default="")
    police_station = Column(String, default="")
    h3_cell = Column(String, default="")
    is_active = Column(Integer, default=1)
    nearby_atm_count = Column(Integer, default=0)  # P2: precomputed at seed time, avoids O(n²) haversine per request


class Withdrawal(Base):
    """Withdrawal info = future observed event / prediction target (NOT known at complaint time)."""
    __tablename__ = "withdrawals"
    # P4: composite index on (atm_id, timestamp) — used by fraud_withdrawals_7d/30d feature every prediction
    __table_args__ = (Index("ix_withdrawal_atm_ts", "atm_id", "timestamp"),)
    id = Column(Integer, primary_key=True)
    atm_id = Column(Integer, ForeignKey("atms.id"))
    linked_case_id = Column(Integer, ForeignKey("cases.id"), nullable=True)
    amount = Column(Float, default=0)
    timestamp = Column(DateTime, default=datetime.utcnow)
    withdrawal_type = Column(String, default="CASH")


class Prediction(Base):
    __tablename__ = "predictions"
    # P4: index on case_id — queried on every /cases/{id}/predictions GET
    __table_args__ = (Index("ix_pred_case_id", "case_id"),)
    id = Column(Integer, primary_key=True)
    case_id = Column(Integer, ForeignKey("cases.id"))
    atm_id = Column(Integer, ForeignKey("atms.id"))
    h3_cell = Column(String, default="")
    prediction_score = Column(Float, default=0)
    risk_level = Column(String, default="LOW")
    horizon_minutes = Column(Integer, default=60)
    model_version = Column(String, default="cashout_xgb:0.1.0")
    generated_at = Column(DateTime, default=datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True)
    case_id = Column(Integer, ForeignKey("cases.id"))
    prediction_id = Column(Integer, ForeignKey("predictions.id"), nullable=True)
    severity = Column(String, default="MEDIUM")
    status = Column(String, default="OPEN")
    channel = Column(String, default="dashboard")  # dashboard + SSE primary
    message = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    """Who did what, when. No sensitive payloads — refs only."""
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    actor_role = Column(String, default="demo")
    action = Column(String, index=True, default="")
    resource_type = Column(String, default="")
    resource_id = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
