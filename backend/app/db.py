"""
SQLite persistence layer for the AI Negotiator.

Money values are stored as TEXT rather than REAL.

This is intentional:
    Decimal -> str -> SQLite TEXT -> Decimal

A float must never touch the money path.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional
from uuid import UUID


# ============================================================================
# Database configuration
# ============================================================================

APP_DIR = Path(__file__).resolve().parent

DATABASE_PATH = APP_DIR.parent / "negotiator.db"


# ============================================================================
# Connection helper
# ============================================================================


def get_connection() -> sqlite3.Connection:
    """
    Create a SQLite connection.

    Row factory lets callers access columns by name.
    """

    connection = sqlite3.connect(
        DATABASE_PATH,
    )

    connection.row_factory = sqlite3.Row

    return connection


# ============================================================================
# Database initialization
# ============================================================================


def init_db() -> None:
    """
    Create all required tables if they do not already exist.

    Also initializes the demo product inventory if it does not exist.
    """

    with get_connection() as connection:

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                round_counter INTEGER NOT NULL DEFAULT 0,
                max_rounds INTEGER NOT NULL,
                history_json TEXT NOT NULL DEFAULT '[]',
                status TEXT NOT NULL DEFAULT 'active'
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                round_number INTEGER,
                offered_price TEXT,
                countered_price TEXT,
                decision_reason TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS stock (
                product_id TEXT PRIMARY KEY,
                quantity INTEGER NOT NULL
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS merchant_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                p_list TEXT NOT NULL,
                floor_1_9 TEXT NOT NULL,
                floor_10_49 TEXT NOT NULL,
                floor_50_99 TEXT NOT NULL,
                floor_100_plus TEXT NOT NULL,
                alpha TEXT NOT NULL,
                max_rounds INTEGER NOT NULL
            )
            """
        )

        connection.execute(
            """
            INSERT OR IGNORE INTO merchant_config (
                id,
                p_list,
                floor_1_9,
                floor_10_49,
                floor_50_99,
                floor_100_plus,
                alpha,
                max_rounds
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                1,
                "100.00",
                "90.00",
                "88.00",
                "85.00",
                "80.00",
                "1.5",
                5,
            ),
        )

        connection.execute(
            """
            INSERT OR IGNORE INTO stock (
                product_id,
                quantity
            )
            VALUES (?, ?)
            """,
            (
                "demo-product",
                100,
            ),
        )

        connection.commit()


# ============================================================================
# Session management
# ============================================================================


def create_session(
    *,
    session_id: UUID,
    max_rounds: int,
) -> None:
    """
    Create a new negotiation session.
    """

    with get_connection() as connection:

        connection.execute(
            """
            INSERT INTO sessions (
                session_id,
                round_counter,
                max_rounds,
                history_json,
                status
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                str(session_id),
                0,
                max_rounds,
                "[]",
                "active",
            ),
        )

        connection.commit()


def get_session(
    session_id: UUID,
) -> Optional[sqlite3.Row]:
    """
    Retrieve one negotiation session.
    """

    with get_connection() as connection:

        return connection.execute(
            """
            SELECT
                session_id,
                round_counter,
                max_rounds,
                history_json,
                status
            FROM sessions
            WHERE session_id = ?
            """,
            (
                str(session_id),
            ),
        ).fetchone()


def update_session(
    *,
    session_id: UUID,
    round_counter: int,
    history: list[dict[str, Any]],
    status: str,
) -> None:
    """
    Persist the current state of a negotiation session.
    """

    with get_connection() as connection:

        connection.execute(
            """
            UPDATE sessions
            SET
                round_counter = ?,
                history_json = ?,
                status = ?
            WHERE session_id = ?
            """,
            (
                round_counter,
                json.dumps(
                    history,
                    default=str,
                ),
                status,
                str(session_id),
            ),
        )

        connection.commit()


# ============================================================================
# Session velocity
# ============================================================================


def count_session_requests(
    session_id: UUID,
) -> int:
    """
    Count normal negotiation requests recorded for a session.

    Security-rejection events are intentionally stored separately and
    therefore do not affect this negotiation velocity count.
    """

    with get_connection() as connection:

        row = connection.execute(
            """
            SELECT COUNT(*)
            FROM audit_logs
            WHERE session_id = ?
            """,
            (
                str(session_id),
            ),
        ).fetchone()

        return int(row[0])


# ============================================================================
# Historical buyer maximum
# ============================================================================


def get_highest_offer(
    session_id: UUID,
) -> Optional[Decimal]:
    """
    Return the highest buyer offer recorded for a session.

    Prices are reconstructed directly from SQLite TEXT.

    No float conversion occurs.
    """

    with get_connection() as connection:

        rows = connection.execute(
            """
            SELECT offered_price
            FROM audit_logs
            WHERE session_id = ?
              AND offered_price IS NOT NULL
            """,
            (
                str(session_id),
            ),
        ).fetchall()

    if not rows:
        return None

    offers = [
        Decimal(row["offered_price"])
        for row in rows
    ]

    return max(offers)


# ============================================================================
# Negotiation audit logging
# ============================================================================


def log_negotiation_event(
    *,
    session_id: UUID,
    round_number: int,
    offered_price: Decimal,
    countered_price: Optional[Decimal],
    decision_reason: str,
) -> None:
    """
    Log an offer/counter-offer.

    Decimal values are converted directly to strings for SQLite TEXT storage.
    """

    timestamp = datetime.now(
        timezone.utc,
    ).isoformat()

    with get_connection() as connection:

        connection.execute(
            """
            INSERT INTO audit_logs (
                session_id,
                round_number,
                offered_price,
                countered_price,
                decision_reason,
                timestamp
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                str(session_id),
                round_number,
                str(offered_price),
                (
                    str(countered_price)
                    if countered_price is not None
                    else None
                ),
                decision_reason,
                timestamp,
            ),
        )

        connection.commit()


# ============================================================================
# Security rejection logging
# ============================================================================


def log_security_rejection(
    *,
    session_id: Optional[UUID],
    reason: str,
) -> None:
    """
    Record a validation/security rejection.

    This is intentionally independent from normal negotiation state.
    """

    timestamp = datetime.now(
        timezone.utc,
    ).isoformat()

    with get_connection() as connection:

        connection.execute(
            """
            INSERT INTO audit_logs (
                session_id,
                round_number,
                offered_price,
                countered_price,
                decision_reason,
                timestamp
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                (
                    str(session_id)
                    if session_id is not None
                    else None
                ),
                0,
                None,
                None,
                f"SECURITY_REJECTION: {reason}",
                timestamp,
            ),
        )

        connection.commit()


# ============================================================================
# Merchant analytics
# ============================================================================


def get_merchant_analytics() -> dict[str, Any]:
    """
    Calculate merchant analytics from completed negotiation sessions.

    Security rejections are excluded because they are validation events,
    not negotiation outcomes.
    """

    with get_connection() as connection:

        rows = connection.execute(
            """
            SELECT
                status,
                history_json
            FROM sessions
            WHERE status IN ('accepted', 'no_deal')
            """
        ).fetchall()

    accepted_count = 0
    no_deal_count = 0
    total_revenue = Decimal("0.00")
    discounts: list[Decimal] = []
    closing_rounds: list[int] = []

    for row in rows:

        history = json.loads(
            row["history_json"],
        )

        if not history:
            continue

        final_entry = history[-1]

        status = row["status"]

        if status == "accepted":
            accepted_count += 1

            quantity = int(
                final_entry["effective_quantity"],
            )

            accepted_price = Decimal(
                final_entry["offered_price_per_unit"],
            )

            list_price = Decimal(
                final_entry.get(
                    "list_price_per_unit",
                    "100.00",
                )
            )

            total_revenue += (
                accepted_price * quantity
            )

            if list_price > Decimal("0"):
                discount = (
                    (list_price - accepted_price)
                    / list_price
                ) * Decimal("100")

                discounts.append(discount)

            closing_rounds.append(
                int(final_entry["round"]),
            )

        elif status == "no_deal":
            no_deal_count += 1

    total_closed = (
        accepted_count + no_deal_count
    )

    if total_closed == 0:
        win_rate = None
    else:
        win_rate = (
            Decimal(accepted_count)
            / Decimal(total_closed)
        ) * Decimal("100")

    if discounts:
        average_discount = (
            sum(discounts)
            / Decimal(len(discounts))
        )
    else:
        average_discount = None

    if closing_rounds:
        average_rounds = (
            Decimal(sum(closing_rounds))
            / Decimal(len(closing_rounds))
        )
    else:
        average_rounds = None

    return {
        "accepted_count": accepted_count,
        "no_deal_count": no_deal_count,
        "total_negotiations": total_closed,
        "win_rate_percent": (
            str(win_rate.quantize(Decimal("0.01")))
            if win_rate is not None
            else None
        ),
        "average_discount_percent": (
            str(
                average_discount.quantize(
                    Decimal("0.01"),
                )
            )
            if average_discount is not None
            else None
        ),
        "average_rounds_to_close": (
            str(
                average_rounds.quantize(
                    Decimal("0.01"),
                )
            )
            if average_rounds is not None
            else None
        ),
        "total_negotiated_revenue": str(
            total_revenue.quantize(
                Decimal("0.01"),
            )
        ),
    }


# ============================================================================
# Inventory
# ============================================================================


def get_stock(
    product_id: str,
) -> int:
    """
    Return current stock for a product.
    """

    with get_connection() as connection:

        row = connection.execute(
            """
            SELECT quantity
            FROM stock
            WHERE product_id = ?
            """,
            (
                product_id,
            ),
        ).fetchone()

    if row is None:
        return 0

    return int(row["quantity"])


def set_stock(
    *,
    product_id: str,
    quantity: int,
) -> None:
    """
    Set stock quantity.

    This helper is useful for the live inventory-revalidation demo.
    """

    if quantity < 0:
        raise ValueError(
            "Stock quantity cannot be negative."
        )

    with get_connection() as connection:

        connection.execute(
            """
            INSERT INTO stock (
                product_id,
                quantity
            )
            VALUES (?, ?)
            ON CONFLICT(product_id)
            DO UPDATE SET quantity = excluded.quantity
            """,
            (
                product_id,
                quantity,
            ),
        )

        connection.commit()


def reduce_stock(
    *,
    product_id: str,
    quantity: int,
) -> None:
    """
    Atomically reduce inventory.

    This helper is available for the payment/fulfillment integration.
    """

    if quantity < 0:
        raise ValueError(
            "Reduction quantity cannot be negative."
        )

    with get_connection() as connection:

        cursor = connection.execute(
            """
            UPDATE stock
            SET quantity = quantity - ?
            WHERE product_id = ?
              AND quantity >= ?
            """,
            (
                quantity,
                product_id,
                quantity,
            ),
        )

        if cursor.rowcount != 1:
            raise ValueError(
                "Insufficient stock."
            )

        connection.commit()