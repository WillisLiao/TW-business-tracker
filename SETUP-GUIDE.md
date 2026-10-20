# Setup guide

This guide covers the one-time steps only you can do: creating accounts, the
domain and payments. Do them in order. Most steps need only copying and pasting.
Plan for 2–3 hours in total, spread over a few days, because payment-account
approval can take a day or two.

**What you are setting up**

```
Taiwan exchanges' open data ──► GitHub (runs the update every 2 hours, free)
                                   │  checks the numbers, builds the site
                                   ▼
                          Cloudflare (hosts the site, sign-in, alerts; free tier)
                                   │
          Lemon Squeezy (takes payments) ──► PayPal / bank ──► your Taiwan account
          Resend (sends the alert emails)
```

**Running costs:** a domain is about US$10 a year. Everything else starts on
free plans. Lemon Squeezy takes about 5% + US$0.50 per sale. Resend's free plan
sends 100 emails a day. Upgrade it (about US$20/month) once you pass roughly 80
subscribers.

---

## 1. GitHub: where the code lives and the automation runs

Done: the code lives in `WillisLiao/TW-business-tracker`. Keep the repository
**private** (*Settings → General → Danger zone → Change visibility*), because the
`data/` folder holds the full history that Pro subscribers pay for.

## Quick preview on Vercel (free, no domain needed)

To see the site online before doing the full setup:

1. Go to <https://vercel.com> and choose **Sign up → Continue with GitHub**.
2. Click **Add New… → Project**, find `TW-business-tracker` and click **Import**.
   If it is not listed, click **Adjust GitHub App Permissions** and allow this repository.
3. Change nothing (the project's `vercel.json` already holds the settings) and click **Deploy**.
4. When it finishes, Vercel shows your address, normally `https://tw-business-tracker.vercel.app`.
   It updates by itself whenever new data arrives.

On the preview, the email forms say "coming soon", because sign-in and alerts need the
Cloudflare setup below. The preview is also hidden from Google, so it won't compete with
your real domain later. Vercel's free plan is for non-commercial use, so move to Cloudflare
(steps 3–9 below) before you start charging.

## 2. Pick a name and domain

1. Choose a name. "Taiwan Monthly" is only a working title. Check that a matching `.com` is free.
2. On GitHub, open `site.config.json` and click the pencil icon. Fill in:
   - `siteName`: your site's name
   - `siteUrl`: for example `https://taiwanmonthly.com` (no slash at the end)
   - `ownerName`: your name or a pen name (shown on the About page, which builds trust)
   - `contactEmail`: an address people can write to
3. Click **Commit changes**.

## 3. Cloudflare: hosting

1. Create a free account at <https://dash.cloudflare.com>.
2. **Buy the domain** at *Domain Registration → Register Domains* (sold at cost, about US$10/year).
3. **Find your Account ID.** It is on the right-hand side of *Workers & Pages → Overview*. Copy it.
4. **Create an API token** at *My Profile → API Tokens → Create Token → Create Custom Token*, with these
   permissions (all set to *Account* and *Edit*):
   - Cloudflare Pages
   - D1
   - Workers KV Storage

   Copy the token. You will only see it once.

## 4. Give GitHub the keys

In your repository, open *Settings → Secrets and variables → Actions → New repository secret* and add:

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token from step 3.4 |
| `CLOUDFLARE_ACCOUNT_ID` | the Account ID from step 3.3 |
| `NOTIFY_SECRET` | any long random string (for example, 40 characters from a password generator) |

## 5. Start everything

On GitHub, open the **Actions** tab and run these three workflows, one at a time. For each one, click the workflow, then **Run workflow**, and wait for the green tick:

1. **Set up Cloudflare (run once)** creates the database and the site project.
2. **Backfill history (run once)** loads about five years of past months. It takes around 20 minutes.
3. **Update data and deploy** fetches the latest month and publishes the site.

From now on, *Update data and deploy* runs by itself: every 2 hours from the 1st to the 15th of each month, and daily otherwise.

**Connect your domain:** in Cloudflare, open *Workers & Pages → taiwan-monthly → Custom domains → Set up a domain* and enter your domain.

## 6. Check the numbers yourself (important)

Before telling anyone about the site, compare 3–5 companies with the official source:

1. Open your site's page for TSMC (`/company/2330/`), Quanta (`/company/2382/`) and Foxconn (`/company/2317/`).
2. Click the "MOPS monthly summary" link on each page and find the company in the official table.
3. The revenue figures must match exactly. They are in thousand NT$ on MOPS, and the site shows NT$B.

If anything does not match, do not launch. Tell Claude what you saw.

## 7. Get found on Google

1. Open <https://search.google.com/search-console>, add your domain and follow the instructions to verify it
   (with Cloudflare DNS this is a couple of clicks).
2. Under *Sitemaps*, submit `https://yourdomain.com/sitemap.xml`.

Google usually takes a few weeks to start sending visitors.

## 8. Emails (Resend)

1. Create an account at <https://resend.com> and add your domain under *Domains*. Copy the DNS
   records it shows into Cloudflare (*your domain → DNS → Add record*).
2. Create an API key.
3. Add two more GitHub secrets:
   - `RESEND_API_KEY`: the key
   - `EMAIL_FROM`: for example `Taiwan Monthly <alerts@yourdomain.com>`
4. Run **Set up Cloudflare** again, so the new secrets reach Cloudflare.

Until Pro is switched on, the site shows a "Notify me" form instead of a buy button, which collects a
waitlist. To see the waitlist, open *Cloudflare → D1 → taiwan-monthly → Console* and run
`SELECT email, interest, created_at FROM waitlist;`

## 9. Payments (Lemon Squeezy), paid out to Taiwan

Lemon Squeezy is the "merchant of record". It charges customers worldwide, handles their sales tax
and VAT, and pays you.

1. Sign up at <https://www.lemonsqueezy.com> and complete identity verification.
2. **Payout method** (*Settings → Payouts*):
   - **PayPal** is the simplest from Taiwan. From PayPal, withdraw to an **E.SUN Bank (玉山銀行)** TWD
     account, which has no withdrawal fee (PayPal charges about 2.5% to convert USD to TWD).
   - Or a **bank transfer** in USD to a Taiwanese foreign-currency account. Your bank may charge a fee to receive it.
3. Create a product called **"<your site name> Pro"**, priced as a subscription, with two variants:
   - Monthly: US$12, 7-day free trial
   - Yearly: US$99, 7-day free trial

   In the product settings, set the **confirmation / redirect URL** to `https://yourdomain.com/account/`.
4. Copy each variant's **checkout link** (Share → checkout URL).
5. Create a webhook (*Settings → Webhooks → +*):
   - URL: `https://yourdomain.com/api/webhooks/lemonsqueezy`
   - Signing secret: any long random string
   - Events: tick every event that starts with `subscription_`
6. Add a GitHub secret named `LEMON_SQUEEZY_WEBHOOK_SECRET` with that signing secret, then run **Set up Cloudflare** again.
7. Edit `site.config.json`:
   - set `"enabled": true` under `pro`
   - paste the two links into `checkoutUrlMonthly` and `checkoutUrlYearly`
   - commit the change; the site redeploys automatically
8. **Test it** with Lemon Squeezy's test mode. Buy a subscription with a test card, then sign in at
   `/account/` with the same email. You should see "Pro (free trial)" and be able to build a watchlist.
9. Email your waitlist once to say Pro is live.

## 10. Your monthly routine (about 5 minutes)

Around the 11th of each month, after most companies have reported:

1. Open `https://yourdomain.com/share/latest-groups.png` (and `latest-movers.png`), and save the images.
2. Open `https://yourdomain.com/share/latest-caption.txt` for a ready-made caption.
3. Post them where investors gather: X/Twitter, Threads, LinkedIn, and relevant Reddit communities. Read
   each community's self-promotion rules first. Useful charts posted regularly are how people come to know and trust the site.

## 11. If something goes wrong

- GitHub emails you when a run fails. Open the run and read the **summary**; it says what failed.
- *"Could not find the … field"* means the exchange changed its data format. Nothing wrong was published.
  Tell Claude the message; the fix is usually one line.
- *"fetch failed (6 in a row)"* means an exchange website has been down or blocked for about 12 hours.
  It usually fixes itself.
- *"our YoY differs from the published YoY"* means a safety check stopped a possibly wrong update.
  Nothing wrong was published.

## 12. Tax and legal notes

- Lemon Squeezy handles buyers' VAT and sales tax. Your own income should be declared under Taiwan's
  rules for income from abroad. Ask an accountant (會計師) once, before your first payout.
- The site already shows "not investment advice", source and licence credits, a privacy page and terms.
  Read them and adjust them to your situation.
