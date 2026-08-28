"""
Razorpay Test Mode payment-link integration.

IMPORTANT:
- Negotiation prices are Decimal values in rupees.
- This module is the ONLY place where rupees are converted to paise.
- Real credentials are loaded from .env.
- Live Razorpay credentials are explicitly rejected.
- Payment links receive an explicit expiration timestamp.
"""

from __future__ import annotations

import os
import time
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

import razorpay
from dotenv import load_dotenv


# ============================================================================
# Environment
# ============================================================================

load_dotenv()


RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

PAYMENT_LINK_TTL_MINUTES = int(
    os.getenv(
        "PAYMENT_LINK_TTL_MINUTES",
        "15",
    )
)


# ============================================================================
# Validation helpers
# ============================================================================


def rupees_to_paise(
    amount_rupees: Decimal,
) -> int:
    """
    Convert a rupee Decimal into Razorpay's integer paise unit.

    Example:
        ₹100.00 -> 10000 paise

    No float conversion is allowed.
    """

    if amount_rupees < Decimal("0"):
        raise ValueError(
            "Payment amount cannot be negative."
        )

    try:
        paise = (
            amount_rupees * Decimal("100")
        ).quantize(
            Decimal("1")
        )
    except InvalidOperation as exc:
        raise ValueError(
            "Invalid monetary amount."
        ) from exc

    if paise != paise.to_integral_value():
        raise ValueError(
            "Payment amount cannot contain fractions of a paise."
        )

    return int(paise)


def validate_test_credentials() -> None:
    """
    Refuse to create payment links unless Razorpay Test Mode
    credentials are being used.

    This is an explicit demo safety guard.
    """

    if not RAZORPAY_KEY_ID:
        raise RuntimeError(
            "RAZORPAY_KEY_ID is not configured."
        )

    if not RAZORPAY_KEY_SECRET:
        raise RuntimeError(
            "RAZORPAY_KEY_SECRET is not configured."
        )

    if not RAZORPAY_KEY_ID.startswith(
        "rzp_test_"
    ):
        raise RuntimeError(
            "Refusing to use non-test Razorpay credentials."
        )


def build_reference_id(
    *,
    session_id: UUID,
    round_number: int,
) -> str:
    """
    Build a deterministic Razorpay reference ID.

    Razorpay limits reference_id to 40 characters.
    """

    reference_id = (
        f"neg-{str(session_id)}-r{round_number}"
    )

    if len(reference_id) > 40:
        # UUIDv4 alone makes the full descriptive value too long.
        # Preserve uniqueness while satisfying Razorpay's limit.
        reference_id = (
            f"neg-{str(session_id).replace('-', '')[:24]}"
            f"-r{round_number}"
        )

    if len(reference_id) > 40:
        raise ValueError(
            "Generated Razorpay reference_id exceeds 40 characters."
        )

    return reference_id


# ============================================================================
# Payment-link creation
# ============================================================================


def create_payment_link(
    *,
    session_id: UUID,
    quantity: int,
    agreed_price_per_unit: Decimal,
    round_number: int,
) -> dict[str, Any]:
    """
    Create a short-lived Razorpay Test Mode payment link.

    The negotiation engine supplies the agreed price in rupees.

    This function converts it to paise immediately before making
    the Razorpay API request.
    """

    validate_test_credentials()

    if quantity <= 0:
        raise ValueError(
            "Payment quantity must be positive."
        )

    if agreed_price_per_unit < Decimal("0"):
        raise ValueError(
            "Agreed price cannot be negative."
        )

    amount_rupees = (
        agreed_price_per_unit
        * Decimal(quantity)
    )

    amount_paise = rupees_to_paise(
        amount_rupees
    )

    # Razorpay requires expire_by to be at least 15 minutes
    # in the future when the API processes the request.
    # Add a small safety buffer so network/request latency cannot
    # push an exactly-15-minute timestamp below Razorpay's minimum.
    expire_by = int(
        time.time()
        + (
            PAYMENT_LINK_TTL_MINUTES 
            * 60
        )
        + 60
    )

    reference_id = build_reference_id(
        session_id=session_id,
        round_number=round_number,
    )

    client = razorpay.Client(
        auth=(
            RAZORPAY_KEY_ID,
            RAZORPAY_KEY_SECRET,
        )
    )

    payload = {
        "amount": amount_paise,
        "currency": "INR",
        "accept_partial": False,
        "expire_by": expire_by,
        "reference_id": reference_id,
        "description": (
            f"Negotiated purchase — "
            f"{quantity} units at "
            f"₹{agreed_price_per_unit} per unit"
        ),
        "notes": {
            "session_id": str(session_id),
            "quantity": str(quantity),
            "agreed_price_per_unit": str(
                agreed_price_per_unit
            ),
            "round_number": str(round_number),
        },
        "notify": {
            "sms": False,
            "email": False,
        },
    }

    try:
        response = client.payment_link.create(
            data=payload
        )

    except Exception as exc:
        # Keep the original SDK exception available to the server logs,
        # but do not expose its potentially sensitive request/response
        # details to the API client.
        raise RuntimeError(
            "Razorpay payment-link creation failed."
        ) from exc

    if not isinstance(response, dict):
        raise RuntimeError(
            "Razorpay returned an invalid payment-link response."
        )

    payment_link_id = response.get("id")
    short_url = response.get("short_url")

    if not payment_link_id or not short_url:
        raise RuntimeError(
            "Razorpay response did not contain a payment link."
        )

    return {
        "id": payment_link_id,
        "short_url": short_url,
        "status": response.get("status"),
        "created_at": response.get("created_at"),
        "expire_by": response.get(
            "expire_by",
            expire_by,
        ),
        "reference_id": reference_id,
    }