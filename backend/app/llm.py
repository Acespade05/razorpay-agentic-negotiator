"""
LLM explanation layer.

CRITICAL ARCHITECTURAL RULE:

The LLM NEVER decides:
    - the price
    - the floor
    - whether a deal is accepted
    - whether a deal is rejected
    - the negotiation round

All of those decisions are already made by engine.py.

The LLM only turns the deterministic decision into natural language.

If Groq fails or exceeds the 1.2 second timeout, the deterministic
fallback template is returned immediately.
"""

from __future__ import annotations

import asyncio
import logging
import os
from decimal import Decimal

from dotenv import load_dotenv
from groq import AsyncGroq


# ============================================================================
# Environment
# ============================================================================

load_dotenv()


GROQ_API_KEY = os.getenv("GROQ_API_KEY")

GROQ_MODEL = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-120b",
)

LLM_TIMEOUT_SECONDS = 1.2


# ============================================================================
# Logging
# ============================================================================

logger = logging.getLogger("ai-negotiator.llm")


# ============================================================================
# Groq client
# ============================================================================

client: AsyncGroq | None = None

if GROQ_API_KEY:
    client = AsyncGroq(
        api_key=GROQ_API_KEY,
    )


# ============================================================================
# Deterministic fallback
# ============================================================================


def fallback_explanation(
    *,
    quantity: int,
    calculated_price: Decimal,
) -> str:
    """
    Deterministic fallback used whenever the LLM is unavailable.

    IMPORTANT:
    This function does not recalculate or modify the price.
    It only formats the already-calculated deterministic price.
    """

    return (
        f"Based on volume tier Q={quantity}, our best optimized "
        f"unit price for this step is ₹{calculated_price}."
    )


# ============================================================================
# LLM explanation
# ============================================================================


async def generate_explanation(
    *,
    quantity: int,
    offered_price: Decimal,
    calculated_price: Decimal,
    floor_price: Decimal,
    round_number: int,
    status: str,
    reason: str,
) -> str:
    """
    Generate a natural-language explanation for an already-determined
    negotiation decision.

    The LLM receives the deterministic result as facts.

    It is explicitly forbidden from changing or recalculating the price.

    If:
        - no API key exists
        - Groq errors
        - Groq times out
        - the response is malformed

    the deterministic fallback is returned.
    """

    fallback = fallback_explanation(
        quantity=quantity,
        calculated_price=calculated_price,
    )

    if client is None:
        logger.warning(
            "GROQ_API_KEY missing; using deterministic fallback."
        )

        return fallback

    system_prompt = """
You are the explanation layer for a merchant negotiation system.

Your ONLY task is to explain a negotiation decision that has ALREADY
been calculated by deterministic Python code.

You MUST NOT:
- calculate a new price
- suggest a different price
- change the given price
- change the negotiation status
- override the merchant floor
- negotiate independently
- invent discounts
- claim authority over the decision

The provided calculated price, floor price, status, round, and reason
are authoritative facts.

Return only a short, natural-language explanation suitable for a
checkout negotiation UI.

Do not mention that you are an AI.
Do not mention internal implementation details.
Do not output JSON.
"""

    user_prompt = f"""
Explain this already-determined negotiation result:

Quantity: {quantity}
Buyer offer per unit: ₹{offered_price}
Calculated merchant price per unit: ₹{calculated_price}
Hard floor per unit: ₹{floor_price}
Round: {round_number}
Decision status: {status}
Deterministic decision reason: {reason}

The calculated merchant price is authoritative.
Do not change it.

Keep the explanation to 1-2 concise sentences.
"""

    try:
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt.strip(),
                    },
                    {
                        "role": "user",
                        "content": user_prompt.strip(),
                    },
                ],
                temperature=0.2,
                max_completion_tokens=120,
            ),
            timeout=LLM_TIMEOUT_SECONDS,
        )

        content = response.choices[0].message.content

        if not content or not content.strip():
            logger.warning(
                "GROQ_EMPTY_RESPONSE; using fallback."
            )

            return fallback

        return content.strip()

    except asyncio.TimeoutError:
        logger.warning(
            "GROQ_TIMEOUT after %.1fs; using fallback.",
            LLM_TIMEOUT_SECONDS,
        )

        return fallback

    except Exception:
        logger.exception(
            "GROQ_CALL_FAILURE; using fallback."
        )

        return fallback