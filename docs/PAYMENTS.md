# Payments

ORYNVE v2 supports five payment methods. Each has an on/off toggle in the studio (Settings → Checkout). A method is only shown to customers if it is both enabled in the studio and correctly configured (credentials present).

---

## Cash on Delivery (COD)

No configuration required. COD orders are created with `paymentStatus: unpaid`. When the courier collects payment on delivery, the staff marks the order as paid in the studio.

To enable auto-confirmation of COD orders (skip the manual "confirmed" step), set **Auto-confirm COD** in Settings → Checkout. This is useful if you process a high volume of standard COD orders.

---

## bKash (manual Send-Money)

### How it works

1. The customer selects bKash at checkout, sees the ORYNVE bKash wallet number and instructions (set in Settings → Checkout → bKash number).
2. The customer sends money from their bKash app to the ORYNVE number.
3. The customer enters the Transaction ID (TrxID) in the checkout form.
4. The order is created with `paymentStatus: pending_verification`.
5. Staff verifies the TrxID in the studio (Orders → open order → Payments → Verify).
6. On verification, `paymentStatus` is set to `paid`, a payment event is added to the public timeline, and the audit log records the verifier.

### Setup

1. Studio → Settings → Checkout → bKash number: enter your bKash merchant or personal wallet number.
2. Studio → Settings → Checkout → MFS instructions: customise the bilingual instructions shown to the customer.
3. Studio → Settings → Checkout → bKash: toggle on.

No environment variables are required for manual bKash.

### Verification workflow

To verify a TrxID:
1. Open the order in the studio.
2. Click **Verify payment** on the pending bKash payment.
3. Cross-check the TrxID and amount in your bKash Business app or SMS.
4. Enter the TrxID and optionally the sender number.
5. Click **Mark as paid**.

---

## Nagad (manual Send-Money)

The setup and workflow are identical to bKash. Set the Nagad wallet number in Settings → Checkout → Nagad number and enable the Nagad toggle.

---

## SSLCommerz

SSLCommerz is a Bangladesh payment gateway supporting cards, bKash, Nagad, Rocket, mobile banking, and net banking — all via a single hosted checkout page. It is suitable for customers who prefer paying by card or who want the SSLCommerz-hosted interface.

### Sandbox vs. live

- Set `SSLCOMMERZ_SANDBOX=true` (default) for the sandbox at `sandbox.sslcommerz.com`.
- Set `SSLCOMMERZ_SANDBOX=false` for the live gateway at `securepay.sslcommerz.com`.
- The string must be exactly `"false"` to switch to live mode; any other value (including unset) uses sandbox.

### Setup

1. Register a merchant account at [sslcommerz.com](https://sslcommerz.com).
2. From the sandbox panel, obtain your sandbox `Store ID` and `Store Password`.
3. Add to your environment or `.env`:
   ```bash
   SSLCOMMERZ_STORE_ID=your_store_id
   SSLCOMMERZ_STORE_PASSWORD=your_store_password
   SSLCOMMERZ_SANDBOX=true
   ```
4. Studio → Settings → Checkout → SSLCommerz: toggle on.

### Callback and IPN URLs

These are handled automatically. Ensure your `APP_URL` is correct so the callback URLs resolve:

| URL | Purpose |
|---|---|
| `https://yoursite.com/api/payments/sslcommerz/callback` | POST callback (success/fail/cancel) |
| `https://yoursite.com/api/payments/sslcommerz/ipn` | Instant payment notification (server-to-server) |

SSLCommerz calls the callback URL after the customer completes or abandons the payment. The server validates the response using the SSLCommerz validation API before marking the order paid — the validation check uses `val_id` against the SSLCommerz validator endpoint to prevent spoofed callbacks.

### Switching to live

1. Complete SSLCommerz's live account verification and KYC process.
2. Obtain live Store ID and Store Password from the SSLCommerz merchant dashboard.
3. Update the env vars and set `SSLCOMMERZ_SANDBOX=false`.
4. Test with a real small-value transaction before enabling for all customers.

---

## Stripe

Stripe Checkout redirects the customer to a Stripe-hosted payment page. Charges are made in the customer's selected display currency (converted from BDT using the exchange rate set in Settings → Currency).

### Bangladesh / Stripe caveat

**Stripe does not currently onboard businesses registered in Bangladesh.** To accept Stripe payments, the store owner needs a Stripe account in a supported country (for example via a US, UK, or Singapore entity). See [docs/MARKET_ANALYSIS.md](MARKET_ANALYSIS.md) for context on the Bangladesh payment landscape and alternatives.

If you operate via an overseas entity, Stripe works normally. Charges appear in the entity's country currency on the Stripe dashboard, with BDT conversion at the rate configured in Settings → Currency.

### Setup

1. Create a Stripe account at [dashboard.stripe.com](https://dashboard.stripe.com).
2. Add to your environment:
   ```bash
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```
3. Configure a webhook (see below) to obtain `STRIPE_WEBHOOK_SECRET`.
4. Studio → Settings → Checkout → Stripe: toggle on.

### Webhook setup

Stripe delivers events to your server when a payment completes. Without the webhook, successful payments are not automatically marked paid.

**Production webhook:**

1. In the Stripe dashboard, go to Developers → Webhooks → Add endpoint.
2. Endpoint URL: `https://yoursite.com/api/payments/stripe/webhook`
3. Select events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
4. Copy the signing secret (`whsec_…`) and set it as `STRIPE_WEBHOOK_SECRET`.

**Local development webhook:**

Use the Stripe CLI to forward events to your local server:

```bash
# Install the Stripe CLI (https://stripe.com/docs/stripe-cli)
stripe login
stripe listen --forward-to localhost:3000/api/payments/stripe/webhook
# Copy the printed webhook signing secret to .env as STRIPE_WEBHOOK_SECRET
```

### Event handling

The webhook handler in `src/app/api/payments/stripe/webhook/route.ts` handles:

| Event | Action |
|---|---|
| `checkout.session.completed` | Mark order paid, record transaction ID |
| `checkout.session.async_payment_succeeded` | Same as above (for delayed payment methods) |
| `checkout.session.async_payment_failed` | Mark payment failed |
| `checkout.session.expired` | Mark payment failed |

The handler validates the Stripe signature before processing any event.

### Test mode

Use `sk_test_…` and `pk_test_…` keys for testing. Stripe test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (decline). See [stripe.com/docs/testing](https://stripe.com/docs/testing) for more.

---

## Refunds

ORYNVE does not process refunds automatically. All refunds are manual.

**COD:** No payment to refund. Record the return receipt and update the order status to `refunded`.

**bKash / Nagad:** Send money back to the customer from your wallet. Record the reverse transaction in the order payments tab and add a note to the timeline.

**SSLCommerz:** Use the SSLCommerz merchant dashboard to issue a refund via their refund API. Update the order in ORYNVE manually.

**Stripe:** Issue a refund in the Stripe dashboard (Payments → find the charge → Refund). ORYNVE does not receive a refund webhook by default — update the order status manually after issuing the Stripe refund.

After processing a refund, update the order status to `refunded` in the studio and add a public timeline event explaining the refund.

---

## Payment flow summary

| Method | Flow |
|---|---|
| COD | Checkout → order created `paymentStatus: unpaid` → delivered → staff marks paid |
| bKash / Nagad | Checkout → customer sends money + enters TrxID → `pending_verification` → staff verifies → `paid` |
| SSLCommerz | Checkout → redirect to SSLCommerz → customer pays → callback → server validates → `paid` |
| Stripe | Checkout → redirect to Stripe Checkout → customer pays → webhook → server validates → `paid` |
