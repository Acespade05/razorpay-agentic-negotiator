"""
Deterministic negotiation engine.

IMPORTANT ARCHITECTURAL RULE:

The LLM NEVER calculates, chooses, or modifies a price.

All negotiation mathematics, acceptance decisions, ZOPA checks,
round handling, and hard-floor enforcement happen here in Python.

Money is represented with Decimal throughout this module.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ============================================================================
# Configuration
# ============================================================================


class NegotiationConfig(BaseModel):
    """
    Merchant-side pricing configuration.

    P_list is the base unit list price.

    P_floor(Q) is determined by quantity tier:
        1-9    -> ₹90
        10-49  -> ₹88
        50-99  -> ₹85
        100+   -> ₹80

    These values assume a ₹100 list price as specified by the project.
    """

    model_config = ConfigDict(
        arbitrary_types_allowed=True
    )

    p_list: Decimal = Decimal("100.00")

    max_rounds: int = Field(
        default=5,
        ge=1,
    )

    alpha: Decimal = Decimal("1.5")

    @staticmethod
    def floor_for_quantity(quantity: int) -> Decimal:
        """
        Return the hard minimum acceptable unit price for quantity Q.
        """

        if quantity <= 0:
            raise ValueError(
                "Quantity must be positive."
            )

        if quantity <= 9:
            return Decimal("90.00")

        if quantity <= 49:
            return Decimal("88.00")

        if quantity <= 99:
            return Decimal("85.00")

        return Decimal("80.00")


# ============================================================================
# Request / response schemas
# ============================================================================


class NegotiationRequest(BaseModel):
    """
    Unified payload used by both front doors:

        {
            "session_id": "...",
            "quantity": 10,
            "offered_price_per_unit": 85
        }

    The human frontend and AI buyer-agent use exactly this schema.
    """

    model_config = ConfigDict(
        extra="forbid"
    )

    session_id: UUID
    quantity: int = Field(
        ...,
        gt=0,
    )
    offered_price_per_unit: Decimal = Field(
        ...,
        ge=Decimal("0"),
    )

    @field_validator("session_id")
    @classmethod
    def validate_uuid_v4(
        cls,
        value: UUID,
    ) -> UUID:
        """
        Only UUIDv4 session IDs are accepted.
        """

        if value.version != 4:
            raise ValueError(
                "session_id must be a UUIDv4."
            )

        return value


class NegotiationStatus(str, Enum):
    CONTINUE = "continue"
    ACCEPTED = "accepted"
    NO_DEAL = "no_deal"


class NegotiationDecision(BaseModel):
    """
    Output of the deterministic negotiation engine.

    The LLM receives this information later and may only explain it.
    """

    status: NegotiationStatus

    calculated_price: Decimal

    floor_price_per_unit: Decimal

    buyer_effective_max: Decimal

    reason: str

    @field_validator(
        "calculated_price",
        "floor_price_per_unit",
        "buyer_effective_max",
    )
    @classmethod
    def validate_non_negative_money(
        cls,
        value: Decimal,
    ) -> Decimal:
        if value < Decimal("0"):
            raise ValueError(
                "Money values cannot be negative."
            )

        return value


# ============================================================================
# Deterministic concession curve
# ============================================================================


def calculate_counter_price(
    *,
    p_list: Decimal,
    p_floor: Decimal,
    round_number: int,
    max_rounds: int,
    alpha: Decimal,
) -> Decimal:
    """
    Calculate the deterministic concession price.

    Formula:

        P_counter(k) =
            P_list
            - (P_list - P_floor)
              * ((k - 1) / (K_max - 1)) ^ alpha

    Required boundary behavior:

        Round 1       -> P_list exactly
        Round K_max   -> P_floor exactly

    Explicit boundary branches avoid floating/Decimal exponent drift
    at the two most important endpoints.

    The final result is ALWAYS clamped to the hard floor.
    """

    if max_rounds < 1:
        raise ValueError(
            "max_rounds must be at least 1."
        )

    if round_number < 1 or round_number > max_rounds:
        raise ValueError(
            "round_number must be within the configured round range."
        )

    if p_floor > p_list:
        raise ValueError(
            "p_floor cannot exceed p_list."
        )

    if alpha <= Decimal("0"):
        raise ValueError(
            "alpha must be positive."
        )

    # Round 1 = list price exactly.
    if round_number == 1:
        return p_list

    # Final round = floor exactly.
    if round_number == max_rounds:
        return p_floor

    # General concession curve.
    numerator = Decimal(round_number - 1)
    denominator = Decimal(max_rounds - 1)

    progress = numerator / denominator

    try:
        exponent = progress ** alpha
    except InvalidOperation:
        # Defensive fallback: if Decimal exponentiation ever encounters
        # an invalid operation, fail safely at the merchant floor rather
        # than allowing the negotiation to crash.
        exponent = Decimal("1")

    calculated = (
        p_list
        - (p_list - p_floor) * exponent
    )

    # Normalize monetary values to exactly two decimal places.
    # This changes only the Decimal representation, not the
    # underlying deterministic concession formula.
    calculated = calculated.quantize(
    Decimal("0.01")
    )

    # Defense-in-depth:
    # Never allow the deterministic engine to produce a price below
    # the configured hard floor.
    calculated = max(
        calculated,
        p_floor,
    )

    return calculated


# ============================================================================
# Negotiation decision
# ============================================================================


def decide_negotiation_step(
    *,
    request: NegotiationRequest,
    round_number: int,
    previous_max_offer: Optional[Decimal],
    config: NegotiationConfig,
) -> NegotiationDecision:
    """
    Determine the result of one negotiation round.

    Decision order:

    1. Calculate the quantity-specific hard floor.
    2. Calculate buyer's effective historical maximum.
    3. Check ZOPA.
    4. Apply automatic acceptance / anchoring rules.
    5. Otherwise produce the deterministic concession counter.

    The LLM is not involved anywhere in this function.
    """

    quantity = request.quantity
    offer = request.offered_price_per_unit

    p_list = config.p_list
    p_floor = config.floor_for_quantity(quantity)

    # ------------------------------------------------------------------
    # Buyer effective maximum
    # ------------------------------------------------------------------
    #
    # Option B from the locked specification:
    # highest offer submitted so far in this session.
    # ------------------------------------------------------------------

    if previous_max_offer is None:
        buyer_effective_max = offer
    else:
        buyer_effective_max = max(
            previous_max_offer,
            offer,
        )

    # ------------------------------------------------------------------
    # Hard floor validation
    # ------------------------------------------------------------------

    if p_floor > p_list:
        raise ValueError(
            "Configured floor cannot exceed list price."
        )

    # ------------------------------------------------------------------
    # ZOPA check
    # ------------------------------------------------------------------
    #
    # If the buyer's highest stated offer still cannot reach the merchant's
    # hard floor, there is no possible agreement.
    #
    # This check occurs before generating a counter so we never pretend
    # there is a path to agreement where none exists.
    # ------------------------------------------------------------------

    if buyer_effective_max < p_floor:
        return NegotiationDecision(
            status=NegotiationStatus.NO_DEAL,
            calculated_price=p_floor,
            floor_price_per_unit=p_floor,
            buyer_effective_max=buyer_effective_max,
            reason=(
                f"No deal: buyer's highest offer of "
                f"₹{buyer_effective_max:.2f} is below the "
                f"minimum acceptable unit price of "
                f"₹{p_floor:.2f} for quantity {quantity}."
            ),
        )

    # ------------------------------------------------------------------
    # Automatic acceptance / anchoring rule
    # ------------------------------------------------------------------

    # Rule 1:
    # Buyer's offer >= list price -> instant accept.
    if offer >= p_list:
        accepted_price = max(
            offer,
            p_floor,
        )

        return NegotiationDecision(
            status=NegotiationStatus.ACCEPTED,
            calculated_price=accepted_price,
            floor_price_per_unit=p_floor,
            buyer_effective_max=buyer_effective_max,
            reason=(
                f"Accepted immediately: buyer's offer of "
                f"₹{offer:.2f} meets or exceeds the "
                f"₹{p_list:.2f} list price."
            ),
        )

    # Rule 2:
    # Offer within 2% of list price -> instant accept.
    #
    # Explicit threshold:
    #     offer >= 0.98 * P_list
    acceptance_threshold = (
        p_list * Decimal("0.98")
    )

    if offer >= acceptance_threshold:
        accepted_price = max(
            offer,
            p_floor,
        )

        return NegotiationDecision(
            status=NegotiationStatus.ACCEPTED,
            calculated_price=accepted_price,
            floor_price_per_unit=p_floor,
            buyer_effective_max=buyer_effective_max,
            reason=(
                f"Accepted immediately: buyer's offer of "
                f"₹{offer:.2f} is within 2% of the "
                f"₹{p_list:.2f} list price."
            ),
        )

    # ------------------------------------------------------------------
    # Deterministic concession
    # ------------------------------------------------------------------

    counter_price = calculate_counter_price(
        p_list=p_list,
        p_floor=p_floor,
        round_number=round_number,
        max_rounds=config.max_rounds,
        alpha=config.alpha,
    )

    # ------------------------------------------------------------------
    # Defense-in-depth floor enforcement
    # ------------------------------------------------------------------

    counter_price = max(
        counter_price,
        p_floor,
    )

    # ------------------------------------------------------------------
    # Check whether the buyer's historical maximum can already close
    # against this deterministic threshold.
    #
    # This is intentionally based on buyer_effective_max, not only the
    # current offer. The buyer's highest submitted offer represents the
    # "stated max" under the locked Option B interpretation.
    # ------------------------------------------------------------------

    if buyer_effective_max >= counter_price:
        accepted_price = max(
            buyer_effective_max,
            p_floor,
        ).quantize(
            Decimal("0.01")
        )

        return NegotiationDecision(
            status=NegotiationStatus.ACCEPTED,
            calculated_price=accepted_price,
            floor_price_per_unit=p_floor,
            buyer_effective_max=buyer_effective_max,
            reason=(
                f"Accepted: buyer's highest submitted offer of "
                f"₹{buyer_effective_max:.2f} meets the deterministic "
                f"closing threshold of ₹{counter_price:.2f}."
            ),
        )

    # ------------------------------------------------------------------
    # Round limit
    # ------------------------------------------------------------------

    if round_number >= config.max_rounds:
        return NegotiationDecision(
            status=NegotiationStatus.NO_DEAL,
            calculated_price=p_floor,
            floor_price_per_unit=p_floor,
            buyer_effective_max=buyer_effective_max,
            reason=(
                f"No deal: the maximum of {config.max_rounds} "
                f"rounds was reached without the buyer's effective "
                f"maximum reaching the deterministic closing price."
            ),
        )

    # ------------------------------------------------------------------
    # Counter-offer
    # ------------------------------------------------------------------

    return NegotiationDecision(
        status=NegotiationStatus.CONTINUE,
        calculated_price=counter_price,
        floor_price_per_unit=p_floor,
        buyer_effective_max=buyer_effective_max,
        reason=(
            f"Counter-offer: for quantity {quantity}, the "
            f"deterministic round-{round_number} price is "
            f"₹{counter_price:.2f}. The buyer's effective maximum "
            f"of ₹{buyer_effective_max:.2f} has not reached it."
        ),
    )