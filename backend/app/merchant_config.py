"""
Runtime merchant configuration for the AI Negotiator.

This module provides a runtime-compatible configuration object for the
existing deterministic negotiation engine.

IMPORTANT:
The deterministic pricing formula remains in engine.py.
This module only supplies merchant-configurable values to that engine.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .db import get_connection
from .engine import NegotiationConfig


# ============================================================================
# Runtime configuration model
# ============================================================================


class MerchantConfig(BaseModel):
    """
    Merchant-editable pricing configuration.

    The quantity tier boundaries are intentionally fixed:
        1-9
        10-49
        50-99
        100+
    """

    model_config = ConfigDict(
        arbitrary_types_allowed=True
    )

    p_list: Decimal = Field(
        default=Decimal("100.00"),
        gt=Decimal("0"),
    )

    floor_1_9: Decimal = Field(
        default=Decimal("90.00"),
        gt=Decimal("0"),
    )

    floor_10_49: Decimal = Field(
        default=Decimal("88.00"),
        gt=Decimal("0"),
    )

    floor_50_99: Decimal = Field(
        default=Decimal("85.00"),
        gt=Decimal("0"),
    )

    floor_100_plus: Decimal = Field(
        default=Decimal("80.00"),
        gt=Decimal("0"),
    )

    alpha: Decimal = Field(
        default=Decimal("1.5"),
        gt=Decimal("0"),
    )

    max_rounds: int = Field(
        default=5,
        ge=2,
    )

    @model_validator(mode="after")
    def validate_pricing_invariants(
        self,
    ) -> "MerchantConfig":
        floors = (
            self.floor_1_9,
            self.floor_10_49,
            self.floor_50_99,
            self.floor_100_plus,
        )

        for floor in floors:
            if floor > self.p_list:
                raise ValueError(
                    "Every floor price must be less than or equal "
                    "to the list price."
                )

        # Larger quantities should not receive a worse floor.
        if not (
            self.floor_1_9
            >= self.floor_10_49
            >= self.floor_50_99
            >= self.floor_100_plus
        ):
            raise ValueError(
                "Floor prices must not increase as quantity increases."
            )

        return self

    def floor_for_quantity(
        self,
        quantity: int,
    ) -> Decimal:
        """
        Return the configured hard floor for quantity.

        This intentionally has the same interface as
        NegotiationConfig.floor_for_quantity().
        """

        if quantity <= 0:
            raise ValueError(
                "Quantity must be positive."
            )

        if quantity <= 9:
            return self.floor_1_9

        if quantity <= 49:
            return self.floor_10_49

        if quantity <= 99:
            return self.floor_50_99

        return self.floor_100_plus

    def to_negotiation_config(self) -> NegotiationConfig:
        """
        Return a runtime-compatible configuration for the existing engine.

        The subclass preserves the exact fields expected by the engine while
        overriding only floor_for_quantity().
        """

        return RuntimeNegotiationConfig(
            p_list=self.p_list,
            max_rounds=self.max_rounds,
            alpha=self.alpha,
            floor_1_9=self.floor_1_9,
            floor_10_49=self.floor_10_49,
            floor_50_99=self.floor_50_99,
            floor_100_plus=self.floor_100_plus,
        )


class RuntimeNegotiationConfig(NegotiationConfig):
    """
    Compatibility adapter for the existing deterministic engine.

    engine.py is intentionally not modified.
    """

    floor_1_9: Decimal = Decimal("90.00")
    floor_10_49: Decimal = Decimal("88.00")
    floor_50_99: Decimal = Decimal("85.00")
    floor_100_plus: Decimal = Decimal("80.00")

    def floor_for_quantity(
        self,
        quantity: int,
    ) -> Decimal:
        if quantity <= 0:
            raise ValueError(
                "Quantity must be positive."
            )

        if quantity <= 9:
            return self.floor_1_9

        if quantity <= 49:
            return self.floor_10_49

        if quantity <= 99:
            return self.floor_50_99

        return self.floor_100_plus


# ============================================================================
# SQLite persistence
# ============================================================================


def get_merchant_config() -> MerchantConfig:
    """
    Load the active merchant configuration from SQLite.
    """

    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT
                p_list,
                floor_1_9,
                floor_10_49,
                floor_50_99,
                floor_100_plus,
                alpha,
                max_rounds
            FROM merchant_config
            WHERE id = 1
            """
        ).fetchone()

    if row is None:
        return MerchantConfig()

    return MerchantConfig(
        p_list=Decimal(row["p_list"]),
        floor_1_9=Decimal(row["floor_1_9"]),
        floor_10_49=Decimal(row["floor_10_49"]),
        floor_50_99=Decimal(row["floor_50_99"]),
        floor_100_plus=Decimal(row["floor_100_plus"]),
        alpha=Decimal(row["alpha"]),
        max_rounds=int(row["max_rounds"]),
    )


def save_merchant_config(
    config: MerchantConfig,
) -> MerchantConfig:
    """
    Persist merchant configuration to SQLite.
    """

    # Validate before writing.
    validated = MerchantConfig.model_validate(config)

    with get_connection() as connection:
        connection.execute(
            """
            UPDATE merchant_config
            SET
                p_list = ?,
                floor_1_9 = ?,
                floor_10_49 = ?,
                floor_50_99 = ?,
                floor_100_plus = ?,
                alpha = ?,
                max_rounds = ?
            WHERE id = 1
            """,
            (
                str(validated.p_list),
                str(validated.floor_1_9),
                str(validated.floor_10_49),
                str(validated.floor_50_99),
                str(validated.floor_100_plus),
                str(validated.alpha),
                validated.max_rounds,
            ),
        )

        connection.commit()

    return validated


def get_runtime_negotiation_config() -> NegotiationConfig:
    """
    Return the currently active configuration in the shape expected
    by the deterministic negotiation engine.
    """

    merchant_config = get_merchant_config()

    return merchant_config.to_negotiation_config()