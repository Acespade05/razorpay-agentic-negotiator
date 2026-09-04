Negotiation Project

This is a Next.js project bootstrapped with create-next-app.

Getting Started

First, run the development server:

npm run dev

Open http://localhost:3000 with your browser to see the result.

You can start editing the page by modifying app/page.tsx. The page auto-updates as you edit the file.

This project uses next/font to automatically optimize and load the Geist font family.

Negotiation Project Notes

The buyer experience supports both manual and autonomous AI negotiation modes.

The backend deterministic negotiation engine remains the source of truth for merchant pricing and decisions.

Razorpay payment links are created only after an accepted negotiation.

Razorpay Test Mode links are for demonstration only; opening a link does not verify payment.

Security Rejection Test

The following command exercises the FastAPI validation path with an invalid UUID and invalid quantity:

curl -X POST http://127.0.0.1:8000/api/negotiate/step -H "Content-Type: application/json" -d "{\"session_id\":\"not-a-valid-uuid\",\"quantity\":0,\"offered_price_per_unit\":\"70.00\"}"

Expected behavior: HTTP 422 with the SECURITY_REJECTION error code.

Learn More

To learn more about Next.js resources, see the official Next.js documentation and Learn Next.js materials.

Deploy on Vercel

The easiest way to deploy a Next.js app is with the Vercel platform.