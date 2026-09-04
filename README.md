# Razorpay Agentic Negotiator

**An autonomous AI buyer that negotiates within merchant-defined economic rules — with a deterministic backend engine as the final source of truth.**

Built for the Razorpay Buildathon.

> **Core principle:** Let the agent negotiate. Never let the agent own the merchant's price authority.

---

## Table of Contents

- [Overview](#overview)
- [Why This Exists](#why-this-exists)
- [Core Idea](#core-idea)
- [Key Features](#key-features)
- [Negotiation Logic](#negotiation-logic)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [API Overview](#api-overview)
- [Security and Failure Handling](#security-and-failure-handling)
- [Testing the Negotiation](#testing-the-negotiation)
- [Inventory Behavior](#inventory-behavior)
- [Payments](#payments)
- [AI Architecture Decision](#ai-architecture-decision)
- [LLM Failure Behavior](#llm-failure-behavior)
- [Merchant Analytics](#merchant-analytics)
- [Demo Flow](#demo-flow)
- [What Broke and How We Recovered](#what-broke-and-how-we-recovered)
- [Current Validation Status](#current-validation-status)
- [Production Considerations](#production-considerations)
- [Deployment](#deployment)
- [License](#license)

---

## Overview

Razorpay Agentic Negotiator is a full-stack negotiation prototype. The product demonstrates a buyer that can negotiate manually or let an autonomous buyer agent make offers.

The important architectural decision is that **AI does not control merchant pricing**. The AI buyer proposes offers. The backend's deterministic negotiation engine evaluates those offers, enforces merchant floors and round limits, records the negotiation, and decides whether the result is a counter-offer, acceptance, or no-deal.

After an accepted negotiation, the backend can create a Razorpay Test Mode payment link.

## Why This Exists

Traditional checkout flows treat pricing as a fixed number. Negotiation introduces a different problem:

- buyers want flexibility
- merchants need economic guardrails
- autonomous agents need bounded authority
- every decision should be explainable and auditable

This project explores how an agentic buyer can negotiate while keeping merchant economics deterministic and enforceable.

## Core Idea

```
Buyer
  │
  ├── Manual Buyer
  │
  └── Autonomous AI Buyer
          │
          ▼
     FastAPI Backend
          │
          ├── Security validation
          │
          ├── Deterministic negotiation engine
          │
          ├── SQLite audit/history
          │
          └── LLM explanation layer
                    │
                    ▼
              Acceptance
                    │
                    ▼
          Razorpay Test Payment Link
```

The LLM is used for explanation/copy only. **It does not determine the negotiated price.**

## Key Features

### Buyer Experience
- Manual buyer mode
- Autonomous AI buyer mode
- Aggressive / Balanced / Conservative offer strategies
- Quantity-aware negotiation
- Maximum buyer budget
- Live negotiation rounds
- Clear acceptance / counter-offer / no-deal states
- Negotiation journey and decision explanations
- Terminal session protection after acceptance or no-deal

### Merchant Controls
- Runtime-configurable list price
- Quantity-based floor tiers
- Negotiation curve parameter (alpha)
- Maximum negotiation rounds

### Merchant Analytics
- Negotiated revenue and win-rate metrics

### Backend Protections
- Deterministic pricing engine
- Historical highest buyer offer
- ZOPA / no-deal protection
- Maximum round enforcement
- Session velocity limit
- Inventory revalidation
- Request validation and security rejection
- Decimal-based money calculations
- SQLite audit logging
- Deterministic fallback when the LLM fails or times out

### Payments
- Razorpay Test Mode payment links
- Payment link generated only after acceptance
- Short-lived payment-link flow
- Explicit Test Mode messaging
- No claim that opening a payment link verifies payment

## Negotiation Logic

The backend uses a deterministic concession curve.

For a negotiation with maximum round count `K_max`:

```
P_counter(k) = P_list - (P_list - P_floor) * ((k - 1) / (K_max - 1)) ^ alpha
```

The calculated price is quantized to two decimal places and never falls below the applicable merchant floor.

### Default Quantity Tiers

| Quantity | Minimum acceptable unit price |
|----------|-------------------------------|
| 1–9      | ₹90.00                        |
| 10–49    | ₹88.00                        |
| 50–99    | ₹85.00                        |
| 100+     | ₹80.00                        |

### Other Rules

- Default list price: ₹100.00/unit
- Default maximum rounds: 5
- Default alpha: 1.5
- Buyer effective maximum: highest submitted offer
- Offers at or above the list price are accepted immediately
- Offers within 2% of list price are accepted immediately
- Offers below the applicable floor can result in no-deal
- The backend remains authoritative for every commercial decision

These rules are enforced by the deterministic engine rather than by the LLM.

## Tech Stack

**Frontend**
- Next.js 14
- React
- TypeScript
- Tailwind CSS

**Backend**
- Python 3.12
- FastAPI
- Pydantic
- SQLite
- Decimal-based money calculations

**AI**
- Groq-compatible LLM explanation layer
- LLM failure/timeout falls back to deterministic explanations
- AI buyer offer strategy is deterministic frontend policy; the backend remains the pricing authority

**Payments**
- Razorpay Test Mode payment links

## Project Structure

```
.
├── backend/
│   └── app/
│       ├── engine.py
│       ├── main.py
│       ├── db.py
│       └── llm.py
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   └── merchant/
│   │       └── page.tsx
│   │
│   ├── components/
│   │   ├── buyer/
│   │   │   ├── BuyerModeToggle.tsx
│   │   │   ├── ManualBuyer.tsx
│   │   │   └── AIBuyer.tsx
│   │   ├── merchant/
│   │   │   ├── MerchantConfigForm.tsx
│   │   │   └── MerchantAnalytics.tsx
│   │   └── PayLinkCard.tsx
│   │
│   └── lib/
│       └── negotiation.ts
│
└── README.md
```

## Getting Started

### Prerequisites

Install:
- Python 3.12
- Node.js / npm
- Git

Razorpay and Groq credentials are only required for the integrations that use them. The negotiation engine itself is deterministic.

### 1. Clone the Repository

```bash
git clone <YOUR_PUBLIC_GITHUB_REPO_URL>
cd <YOUR_REPOSITORY_NAME>
```

### 2. Start the Backend

From the repository root:

```bash
cd backend
```

Create and activate a virtual environment.

**Windows Git Bash**

```bash
python -m venv .venv
source .venv/Scripts/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start FastAPI:

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at: `http://127.0.0.1:8000`

### 3. Start the Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open: `http://localhost:3000`

- The buyer experience is available at `/`.
- The merchant console is available at `http://localhost:3000/merchant`.

## Environment Configuration

Do not commit secrets to GitHub.

Use the project's backend environment configuration for credentials such as:

- Razorpay Test Mode credentials
- Groq API credentials
- Any other local secrets required by the backend

A local `.env` file should be ignored by Git. For a public submission, use placeholder names in documentation rather than real secret values.

## API Overview

The frontend communicates with the FastAPI backend.

Important endpoints include:

```
GET  /api/product
POST /api/negotiate/step
GET  /api/merchant/config
POST /api/merchant/config
```

The negotiation endpoint is the central path:

```
Buyer offer
    ↓
Request validation
    ↓
Session / velocity checks
    ↓
Inventory revalidation
    ↓
Historical buyer maximum
    ↓
Deterministic negotiation engine
    ↓
Audit/history persistence
    ↓
LLM explanation
    ↓
Optional Razorpay payment link
```

## Security and Failure Handling

Security validation happens before normal negotiation processing.

Invalid requests are rejected with a structured security error instead of being treated as normal negotiation offers.

The project also protects against:

- invalid UUID/session identifiers
- invalid quantities
- insufficient inventory
- excessive requests within a session
- exceeding the maximum negotiation rounds
- offers outside the merchant's viable negotiation space

Security rejections are isolated from merchant negotiation analytics.

### Example Security Rejection Test

Run this against the backend:

```bash
curl -X POST http://127.0.0.1:8000/api/negotiate/step \
-H "Content-Type: application/json" \
-d "{\"session_id\":\"not-a-valid-uuid\",\"quantity\":0,\"offered_price_per_unit\":\"70.00\"}"
```

Expected result: `HTTP 422` with an error code of `SECURITY_REJECTION`.

## Testing the Negotiation

A simple manual scenario:

- Quantity: 10
- List price: ₹100.00
- Floor: ₹88.00
- Maximum rounds: 5

Example buyer offers:

| Round | Offer  |
|-------|--------|
| 1     | ₹90.00 |
| 2     | ₹94.00 |
| 3     | ₹96.00 |

The backend can accept the ₹96.00 offer because it satisfies the configured acceptance threshold. The exact response is always determined by the backend engine.

## Inventory Behavior

Inventory is checked against the requested quantity. The system does not silently reduce a buyer's requested quantity to whatever stock happens to remain.

If the requested quantity exceeds available inventory, the request is rejected with an insufficient-stock response.

## Payments

Razorpay payment links are created only after the negotiation reaches an accepted state. This project uses Razorpay Test Mode for demonstration.

> **Important limitation:** Opening a Test Mode payment link does not mean payment has been verified. A production payment flow would require a verified callback/webhook and corresponding server-side verification before treating an order as paid.

## AI Architecture Decision

The most important design boundary in this project is:

```
AI = offer strategy + explanation
Backend engine = price authority
```

The autonomous buyer can decide what offer to submit according to its configured strategy and budget. It **cannot**:

- lower the merchant floor
- override quantity tiers
- bypass round limits
- decide acceptance independently
- rewrite the backend pricing rules

This keeps the agent useful without giving an LLM uncontrolled authority over merchant economics.

## LLM Failure Behavior

The LLM is not part of the pricing-critical path. If the LLM fails or times out, the system falls back to deterministic explanation behavior.

```
LLM failure
    ↓
Negotiation continues
    ↓
Deterministic engine still decides price
```

This is intentional: an AI explanation failure should never become a pricing failure.

## Merchant Analytics

The merchant console provides aggregate negotiation metrics including:

- accepted negotiations
- no-deal negotiations
- total negotiations
- win rate
- average discount
- average rounds to close
- total negotiated revenue

Security rejections are excluded from commercial negotiation analytics.

## Demo Flow

For a short project demonstration:

**1. Merchant**

Open the Merchant Console and show:
- current pricing configuration
- quantity floor tiers
- maximum rounds
- negotiation analytics

**2. Manual Buyer**

Open the buyer experience. Use:
- Quantity: 10
- Offer: ₹90

Continue the negotiation with progressively higher offers.

**3. Autonomous Buyer**

Switch to:
- Autonomous AI buyer
- Strategy: Balanced
- Quantity: 10
- Maximum budget: ₹96

Start the negotiation and show the agent progressing through rounds.

**4. Acceptance**

Show:
- agreement reached
- agreed unit price
- total value
- negotiation journey
- payment section

**5. Razorpay**

Open the generated Razorpay Test Mode payment link. Explicitly state that this is a test payment flow and is not proof of verified payment.

## What Broke and How We Recovered

A major design goal was to make the system resilient rather than assuming every dependency always works.

**LLM availability** — The external LLM dependency changed availability during development. The system was designed so that the negotiation engine does not depend on the LLM for price decisions. When the LLM is unavailable, deterministic fallback behavior keeps the negotiation functional.

**LLM timeout** — A timeout was tested during development. The system falls back instead of allowing an explanation dependency to block commercial negotiation.

**Validation error handling** — Request validation needed to be handled carefully so structured security errors could be returned without leaking problematic validation context. The validation response was sanitized before being returned to the client.

**Frontend issues** — The frontend also went through TypeScript and React Hook validation issues during development. These were fixed, and the final project passes both `npm run lint` and `npm run build`.

## Current Validation Status

The project has been tested across:

- manual negotiation
- autonomous buyer negotiation
- quantity floor boundaries
- instant acceptance
- ZOPA / no-deal behavior
- maximum rounds
- session velocity protection
- inventory protection
- security rejection
- merchant configuration
- analytics
- Razorpay Test Mode payment-link creation
- LLM timeout fallback
- frontend lint
- frontend production build

## Production Considerations

This repository is a buildathon prototype rather than a production payment system.

Before production use, the system would need additional work around:

- authenticated merchant access
- production database infrastructure
- secret management
- verified Razorpay webhooks
- payment reconciliation
- stronger observability
- rate limiting at the infrastructure layer
- persistent distributed session state
- deployment hardening
- automated backend and frontend test suites
- production-grade error monitoring

The prototype intentionally keeps the architecture small enough to demonstrate the core negotiation concept clearly.

## Deployment

A deployment is not required by the Buildathon instructions shown in the supplied screenshots.

The submission requirements shown there emphasize:

- a public GitHub repository
- a working build
- a roughly 5-minute pitch/demo video
- architecture / proof of work
- an explanation of what broke and how it was fixed

For the strongest judge experience, however, a public demo deployment can be useful if it can be done reliably.

> Do not deploy just for the sake of having a URL. A broken public deployment is worse than a clean local demo video.

Recommended order:

1. Public GitHub repo
2. Clean README
3. Final end-to-end demo
4. 5-minute pitch video
5. Optional public deployment

## License

Add the license required by your submission or repository policy before publishing.

---

**Project:** Razorpay Agentic Negotiator
**Built for:** the Razorpay Buildathon