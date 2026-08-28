"""
FastAPI application for the AI Negotiator.

Both front doors use the same endpoint:

    POST /api/negotiate/step

with the same payload:

    {
        "session_id": "...",
        "quantity": 10,
        "offered_price_per_unit": 90
    }

The frontend does not contain negotiation logic.

All pricing decisions come from engine.py.
"""

from __future__ import annotations

import functools
import json
import logging
from contextlib import asynccontextmanager
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

import anyio
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .db import (
    count_session_requests,
    create_session,
    get_highest_offer,
    get_session,
    get_stock,
    init_db,
    log_negotiation_event,
    log_security_rejection,
    update_session,
)
from .engine import (
    NegotiationConfig,
    NegotiationRequest,
    NegotiationStatus,
    decide_negotiation_step,
)
from .llm import generate_explanation
from .razorpay_client import create_payment_link


# ============================================================================
# Logging
# ============================================================================

logger = logging.getLogger("ai-negotiator")

logging.basicConfig(
    level=logging.INFO,
)


# ============================================================================
# Configuration
# ============================================================================

MAX_REQUESTS_PER_SESSION = 5
DEFAULT_PRODUCT_ID = "demo-product"

config = NegotiationConfig()


# ============================================================================
# Application lifecycle
# ============================================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Initialize SQLite before the application starts accepting requests.
    """

    init_db()

    yield


app = FastAPI(
    title="AI Negotiator with Bounded Price Slopes",
    version="1.0.0",
    lifespan=lifespan,
)


# ============================================================================
# CORS
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


# ============================================================================
# Security validation helpers
# ============================================================================


def extract_session_id_from_body(
    body: Any,
) -> Optional[UUID]:
    """
    Best-effort extraction of a UUIDv4 from an invalid request.

    This value is used ONLY to correlate a security-rejection audit event.

    It is never trusted for normal negotiation state.
    """

    if not isinstance(body, dict):
        return None

    raw_session_id = body.get("session_id")

    if not isinstance(raw_session_id, str):
        return None

    try:
        candidate = UUID(raw_session_id)
    except (ValueError, TypeError, AttributeError):
        return None

    if candidate.version != 4:
        return None

    return candidate


# ============================================================================
# FastAPI validation exception handler
# ============================================================================


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """
    Handle malformed JSON and Pydantic validation failures.

    FastAPI/Starlette may surface malformed JSON through
    RequestValidationError rather than a raw JSONDecodeError.

    Therefore this single handler covers the required security-rejection path.
    """

    session_id: Optional[UUID] = None

    try:
        body = await request.json()
        session_id = extract_session_id_from_body(body)
    except Exception:
        # Malformed JSON cannot be parsed.
        # The security event is still recorded with a NULL session ID.
        pass

    errors = exc.errors()

    reason = json.dumps(
        errors,
        default=str,
    )

    logger.warning(
        "SECURITY_REJECTION session=%s reason=%s",
        session_id,
        reason,
    )

    # Only the security-rejection audit record is written.
    # No normal negotiation session is created or modified.
    log_security_rejection(
        session_id=session_id,
        reason=reason,
    )

    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "SECURITY_REJECTION",
                "message": "Request failed validation.",
                "details": errors,
            }
        },
    )


# ============================================================================
# Negotiation endpoint
# ============================================================================


@app.post("/api/negotiate/step")
async def negotiate_step(
    request: NegotiationRequest,
) -> dict[str, Any]:
    """
    Execute exactly one negotiation turn.

    Pydantic validation has already completed before this function runs.
    """

    # ========================================================================
    # 1. Session initialization
    # ========================================================================

    session = get_session(
        request.session_id,
    )

    if session is None:
        create_session(
            session_id=request.session_id,
            max_rounds=config.max_rounds,
        )

        session = get_session(
            request.session_id,
        )

        if session is None:
            logger.error(
                "SESSION_INITIALIZATION_FAILED session=%s",
                request.session_id,
            )

            return JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "code": "SESSION_INITIALIZATION_FAILED",
                        "message": (
                            "Unable to initialize negotiation session."
                        ),
                    }
                },
            )

    # ========================================================================
    # 2. Session velocity limit
    # ========================================================================

    request_count = count_session_requests(
        request.session_id,
    )

    if request_count >= MAX_REQUESTS_PER_SESSION:
        reason = (
            f"Session velocity limit exceeded: maximum of "
            f"{MAX_REQUESTS_PER_SESSION} negotiation requests "
            f"per session."
        )

        logger.warning(
            "SESSION_VELOCITY_LIMIT session=%s",
            request.session_id,
        )

        update_session(
            session_id=request.session_id,
            round_counter=session["round_counter"],
            history=json.loads(session["history_json"]),
            status=NegotiationStatus.NO_DEAL.value,
        )

        return JSONResponse(
            status_code=429,
            content={
                "session_id": str(request.session_id),
                "status": NegotiationStatus.NO_DEAL.value,
                "error": {
                    "code": "SESSION_VELOCITY_LIMIT",
                    "message": reason,
                },
            },
        )

    # ========================================================================
    # 3. Round limit
    # ========================================================================

    current_round = int(
        session["round_counter"]
    ) + 1

    if current_round > config.max_rounds:
        update_session(
            session_id=request.session_id,
            round_counter=session["round_counter"],
            history=json.loads(session["history_json"]),
            status=NegotiationStatus.NO_DEAL.value,
        )

        return {
            "session_id": str(request.session_id),
            "status": NegotiationStatus.NO_DEAL.value,
            "round_number": config.max_rounds,
            "max_rounds": config.max_rounds,
            "reason": (
                f"No deal: maximum of {config.max_rounds} "
                "rounds has already been reached."
            ),
            "explanation": (
                "The negotiation window has ended without "
                "an agreement."
            ),
            "payment_link": None,
        }

    # ========================================================================
    # 4. Inventory re-validation
    # ========================================================================

    stock = get_stock(
        DEFAULT_PRODUCT_ID,
    )

    if stock <= 0:
        reason = (
            "No deal: requested product is currently "
            "out of stock."
        )

        history = json.loads(
            session["history_json"],
        )

        history.append(
            {
                "round": current_round,
                "requested_quantity": request.quantity,
                "effective_quantity": 0,
                "offered_price_per_unit": str(
                    request.offered_price_per_unit,
                ),
                "countered_price": None,
                "reason": reason,
                "status": NegotiationStatus.NO_DEAL.value,
            }
        )

        update_session(
            session_id=request.session_id,
            round_counter=current_round,
            history=history,
            status=NegotiationStatus.NO_DEAL.value,
        )

        log_negotiation_event(
            session_id=request.session_id,
            round_number=current_round,
            offered_price=request.offered_price_per_unit,
            countered_price=None,
            decision_reason=reason,
        )

        return {
            "session_id": str(request.session_id),
            "status": NegotiationStatus.NO_DEAL.value,
            "round_number": current_round,
            "max_rounds": config.max_rounds,
            "quantity": 0,
            "reason": reason,
            "explanation": (
                "Unfortunately, there is no remaining stock "
                "available for this negotiation."
            ),
            "payment_link": None,
        }

    # Reduce requested quantity if inventory has fallen.
    effective_quantity = min(
        request.quantity,
        stock,
    )

    quantity_reduced = (
        effective_quantity < request.quantity
    )

    effective_request = request.model_copy(
        update={
            "quantity": effective_quantity,
        },
    )

    # ========================================================================
    # 5. Historical buyer maximum
    # ========================================================================

    previous_max_offer = get_highest_offer(
        request.session_id,
    )

    # ========================================================================
    # 6. Deterministic negotiation engine
    # ========================================================================

    decision = decide_negotiation_step(
        request=effective_request,
        round_number=current_round,
        previous_max_offer=previous_max_offer,
        config=config,
    )

    reason = decision.reason

    if quantity_reduced:
        reason = (
            f"Inventory re-validation reduced the negotiable "
            f"quantity from {request.quantity} to "
            f"{effective_quantity}. {reason}"
        )

    # ========================================================================
    # 7. Persist history
    # ========================================================================

    history = json.loads(
        session["history_json"],
    )

    history.append(
        {
            "round": current_round,
            "requested_quantity": request.quantity,
            "effective_quantity": effective_quantity,
            "stock_at_turn": stock,
            "offered_price_per_unit": str(
                request.offered_price_per_unit,
            ),
            "countered_price": str(
                decision.calculated_price,
            ),
            "floor_price_per_unit": str(
                decision.floor_price_per_unit,
            ),
            "buyer_effective_max": str(
                decision.buyer_effective_max,
            ),
            "reason": reason,
            "status": decision.status.value,
        }
    )

    update_session(
        session_id=request.session_id,
        round_counter=current_round,
        history=history,
        status=decision.status.value,
    )

    # ========================================================================
    # 8. Audit log
    # ========================================================================

    countered_price: Optional[Decimal] = None

    if decision.status == NegotiationStatus.CONTINUE:
        countered_price = decision.calculated_price

    log_negotiation_event(
        session_id=request.session_id,
        round_number=current_round,
        offered_price=request.offered_price_per_unit,
        countered_price=countered_price,
        decision_reason=reason,
    )

    # ========================================================================
    # 9. LLM explanation
    # ========================================================================
    #
    # IMPORTANT:
    #
    # The deterministic engine has ALREADY made the decision.
    #
    # The LLM can explain it but cannot change:
    #
    #     - calculated_price
    #     - floor
    #     - status
    #     - acceptance
    #     - ZOPA
    #
    # ========================================================================

    explanation = await generate_explanation(
        quantity=effective_quantity,
        offered_price=request.offered_price_per_unit,
        calculated_price=decision.calculated_price,
        floor_price=decision.floor_price_per_unit,
        round_number=current_round,
        status=decision.status.value,
        reason=reason,
    )

    # ========================================================================
    # 10. Razorpay Payment Link
    # ========================================================================

    payment_link = None

    if decision.status == NegotiationStatus.ACCEPTED:
        try:
            # functools.partial is REQUIRED here because
            # create_payment_link uses keyword-only arguments while
            # anyio.to_thread.run_sync forwards positional arguments.
            payment_link = await anyio.to_thread.run_sync(
                functools.partial(
                    create_payment_link,
                    session_id=request.session_id,
                    quantity=effective_quantity,
                    agreed_price_per_unit=decision.calculated_price,
                    round_number=current_round,
                )
            )

        except Exception:
            # Detailed Razorpay SDK errors stay server-side.
            # Never expose raw SDK exception messages to the client.
            logger.exception(
                "RAZORPAY_PAYMENT_LINK_FAILURE session=%s round=%s",
                request.session_id,
                current_round,
            )

            payment_link = None

    # ========================================================================
    # 11. Final response
    # ========================================================================

    return {
        "session_id": str(request.session_id),
        "status": decision.status.value,
        "round_number": current_round,
        "max_rounds": config.max_rounds,
        "quantity": effective_quantity,
        "requested_quantity": request.quantity,
        "stock_remaining": stock,
        "quantity_reduced_due_to_inventory": quantity_reduced,
        "offered_price_per_unit": str(
            request.offered_price_per_unit,
        ),
        "calculated_price": str(
            decision.calculated_price,
        ),
        "floor_price_per_unit": str(
            decision.floor_price_per_unit,
        ),
        "buyer_effective_max": str(
            decision.buyer_effective_max,
        ),
        "reason": reason,
        "explanation": explanation,
        "payment_link": payment_link,
    }


# ============================================================================
# Health check
# ============================================================================


@app.get("/health")
async def health() -> dict[str, str]:
    """
    Basic application health endpoint.
    """

    return {
        "status": "ok",
    }