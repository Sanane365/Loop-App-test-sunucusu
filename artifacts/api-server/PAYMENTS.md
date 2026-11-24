# Live coin payments

Web coin packages use iyzico Checkout Form. Card details are entered on iyzico's hosted page and are not stored by Loop.

Android builds use Google Play Billing for coin packs. Web builds continue to use iyzico. The Android app sends the Google Play purchase token to the API; the API verifies it with the Google Play Developer API before crediting coins. Never trust a client-side purchase-success result on its own.

## Google Play Billing (Android)

Create these one-time in-app products in Play Console for package `com.loopsocial.app`:

| Product ID | Coin package |
| --- | --- |
| `loop_coins_starter` | Kıvılcım |
| `loop_coins_spark` | Işık |
| `loop_coins_orbit` | Yörünge |
| `loop_coins_galaxy` | Galaksi |

Create the following subscription products for package `com.loopsocial.app`. Each product needs two auto-renewing base plans named exactly `monthly` and `annual`. Set prices in Play Console; the Android app displays localized prices returned by Google Play.

| Product ID | Package | Monthly price (TRY) | Annual prepaid price (TRY) |
| --- | --- | ---: | ---: |
| `loop_premium_writer` | Premium Yazar | 249.90 | 2,498.00 |
| `loop_blue_verified` | Mavi Tik | 350.00 | 3,498.60 |
| `loop_gold_basic` | Altın Tik Basic | 7,499.90 | 74,969.00 |
| `loop_gold_full` | Altın Tik Full | 35,999.90 | 359,855.00 |

Annual prices are 12 monthly periods with a 16.7% discount (monthly price × 12 × 0.833), rounded to two decimals. Localized prices shown in the Android app always come from Play Billing, so configure the same intended prices and supported regions in Play Console.

The app's **Ayarlar → Üyelik paketleri** screen loads both base plans using `PURCHASE_TYPE.SUBS`, sends the base-plan ID and purchase token to the API, and displays a membership only after server-side verification with Google Play. The API checks the product, base plan, expiry/state, and obfuscated Loop account ID, then acknowledges the purchase. `GET /api/live/subscriptions` refreshes recorded subscriptions from Google Play on access.

The previous `loop_premium_monthly` verification endpoint remains for compatibility with any older test purchases. The new membership products and base plans are separate.

Package benefits currently represented in the app catalog:

- Premium Yazar: Premium Yazar badge and placement in the Premium Yazarlardan book section.
- Mavi Tik: verified blue badge.
- Altın Tik Basic: gold badge. Brand-account features that are not implemented yet are marked as coming soon in the app.
- Altın Tik Full: gold badge and profile intro video access. Other unimplemented corporate features are marked as coming soon in the app.

Administrators can upload and publish badge assets in the existing Rozetler area, then assign the published assets to Premium Yazar, Mavi Tik, and Altın Tik in Admin → Canlı yayın → Üyelik rozet görselleri. Altın Tik assets apply to both Basic and Full memberships. A user's own assigned badge asset takes precedence over the membership badge.

Google Play Console product creation, pricing, and publishing must be completed by an account with Play Console access. Billing verification on the server remains disabled until the credentials below are securely configured. Renewal/refund real-time developer notifications are not configured yet; the app refreshes subscription state from Google Play when a member opens the membership screen.

Configure the Google Play Developer API and grant the service account access to the app in Play Console. Set these server-only environment variables:

```dotenv
GOOGLE_PLAY_PACKAGE_NAME=com.loopsocial.app
GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY=
```

Use the service account private key as a secret; convert escaped `\n` sequences to newlines when setting it. Do not expose it to the frontend or commit it. The Google Play API integration remains disabled until all three values are configured. Test purchases using a Play Console internal testing track and licensed tester accounts. Prices and localized product details must come from Google Play, not be hardcoded in the Android UI.

## Web (iyzico)

## Required server environment

Set these as deployment secrets/environment variables. Do not put secret keys in frontend variables or commit them.

```dotenv
IYZIPAY_API_KEY=
IYZIPAY_SECRET_KEY=
IYZIPAY_URI=https://sandbox-api.iyzipay.com
PUBLIC_APP_URL=https://your-public-app.example
```

Use the sandbox URI and sandbox credentials for test cards. Switch `IYZIPAY_URI` to `https://api.iyzipay.com` only after the merchant account is approved for live transactions and production credentials are installed. `PUBLIC_APP_URL` must be the public HTTPS origin. If the API is hosted on a different public origin, set `IYZIPAY_CALLBACK_URL` to:

```text
https://your-public-api.example/api/live/coin-wallet/iyzico-callback
```

The callback must be reachable from iyzico. The server retrieves the payment result itself and credits coins only when the verified order ID, amount, TRY currency, payment status, and fraud status match. The order status endpoint is authenticated and restricted to its owner.

## Packages and exemptions

Initial prices are provisional and defined in `src/routes/live.ts` in `LIVE_COIN_PACKAGES`. They are charged in TRY; a customer's bank may apply its own conversion for an international card. International card acceptance depends on the merchant's iyzico account and agreement.

Admin and other privileged accounts cannot buy coins. Gift sends from those accounts are complimentary and do not consume a wallet balance. Previous test-wallet balances are not migrated as paid coin balances when the real wallet is initialized.
