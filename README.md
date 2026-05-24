<p align="center">
  <img src="assets/icon.png" alt="Intrinsic Mobile" width="80" />
</p>

<h1 align="center">Intrinsic Mobile</h1>

<p align="center">
  <img src="https://img.shields.io/badge/License-GPL%203.0-blue?style=flat" alt="License: GPL-3.0" />
  <img src="https://img.shields.io/badge/Platform-iOS-lightgrey?style=flat" alt="Platform: iOS" />
  <img src="https://img.shields.io/badge/Expo_SDK-56-000020?style=flat" alt="Expo SDK 56" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Firebase-Auth_+_Firestore-FFCA28?style=flat" alt="Firebase" />
  <img src="https://img.shields.io/badge/Data-FRED_|_BLS_|_EDGAR_|_Massive-4CAF50?style=flat" alt="Data Sources" />
</p>

A mobile market intelligence terminal built with Expo and React Native. Dense, data-focused dark monospace interface for tracking U.S. macroeconomic indicators, equities, fixed income, SEC filings, and Federal Reserve communications.

## Screenshots

| | | |
|---|---|---|
| ![Indicators](assets/screenshots/indicators.png) | ![Charts](assets/screenshots/charts.png) | ![News](assets/screenshots/news.png) |
| ![Watchlist](assets/screenshots/watchlist.png) | ![Stock Detail](assets/screenshots/stock-detail.png) | ![Stock Charts](assets/screenshots/stock-charts.png) |
| ![Bond Yields](assets/screenshots/bond-yields.png) | ![Filings](assets/screenshots/filings.png) | ![Valuation](assets/screenshots/valuation.png) |

## Features

### Economy Floor

| Tab | Description |
|---|---|
| Indicators | FRED and BLS macro series grouped by Labor, Inflation, Growth, and Interest Rates. Inline sparklines and historical analysis. AI-powered Macro Summary via Claude API with date-based caching. |
| Charts | Multi-series overlay charts - Macro Pulse, Inflation vs Fed Policy, Rates Transmission, Yield Curve. |
| Fed Comms | Federal Reserve press releases, FOMC statements, meeting minutes, and speeches via RSS. Filter chips for FOMC, Minutes, Speeches, and Other. |
| News | Aggregated financial news with keyword filter chips (Labor, Inflation, Fed, Growth, Rates). Daily Spark briefing with AI interpretation. |
| Research | FRED Blog posts and BLS reports with series tag badges. Filter by source type. |

### Stocks Floor

| Tab | Description |
|---|---|
| Watchlist | Live quotes with change indicators. Autocomplete ticker search and add. |
| Charts | 1Y daily price charts for all watchlist tickers via Massive API. |
| Filings | SEC EDGAR search by ticker, year, and form type. All filing years back to 1993 with automatic pagination. Collapsible filing type reference card. |
| News | Google News RSS feed driven by the watchlist. Filter by individual ticker or view all. |
| Valuation | XBRL fundamentals from SEC EDGAR - 5Y revenue/net income trends, balance sheet breakdown, key ratios. |

### Stock Detail

Full-screen modal for individual stocks:

- Daily price chart with range selector (1M / 6M / 1Y / 2Y)
- Today stats - open, close, high, low, market cap
- Enriched company profile with industry, IPO date, website, and expandable description
- Fundamentals - P/E, EPS, 52-week range, dividend, beta (calculated against SPY)
- Peer companies with tap-to-navigate
- Deep links to Filings and Company News

### Bonds Floor

| Tab | Description |
|---|---|
| Yields | All Treasury maturities (1M through 30Y) with sparklines and daily change. |
| Curve | Interactive yield curve visualization. |
| Spreads | Term spreads, credit spreads, and real yields. |
| Charts | Historical overlay charts for rates and spreads. |
| Auctions | Upcoming and recent Treasury auctions via TreasuryDirect API. |

### Settings

- Firebase authentication - sign in and create account with email/password
- Subscription tiers (free / pro structure, pro not yet active)
- Cache management, API status indicators, app version and license info

### Planned

ETFs, Futures, and Commodities floors have navigation and tab structures defined. Screens are stubbed and ready for implementation.

## Tech Stack

- Expo SDK 56, React Native 0.85, React 19, TypeScript 5.9
- Firebase 12 - Authentication with AsyncStorage persistence, Firestore for user data
- Custom animated drawer navigation, material-top-tabs, native-stack
- react-native-svg for all charting
- fast-xml-parser for RSS/XML feed parsing
- JetBrains Mono font throughout
- Cloudflare Worker proxy for third-party API key management

## Data Sources

| Source | Auth | Data |
|---|---|---|
| FRED API | Free API key | Macro indicators - unemployment, CPI, GDP, fed funds, treasuries, mortgage rates |
| BLS API v2 | Free API key | Nonfarm payrolls, labor force participation |
| Federal Reserve RSS | None | Press releases, FOMC statements, meeting minutes, speeches |
| SEC EDGAR | User-Agent header | Company filings, XBRL fundamentals (revenue, net income, EPS, balance sheet) |
| Massive / Polygon (via Worker) | Key in Worker | Stock candles, ticker details, peer companies, dividends |
| Finnhub (via Worker) | Key in Worker | Real-time stock quotes, company profiles |
| TreasuryDirect | None | Treasury auction schedules and results |
| Google News RSS | None | Company news by ticker |
| Claude API | API key | AI macro commentary and interpretation |
| Firebase | Project config | User authentication, Firestore document storage |

## Setup

### Prerequisites

- Node.js 18+
- Expo CLI
- Expo Go on a physical device or iOS Simulator

### API Keys (all free tier)

- [FRED API](https://fred.stlouisfed.org/docs/api/api_key.html) - macroeconomic data
- [BLS API](https://data.bls.gov/registrationEngine/) - employment data
- [Anthropic API](https://console.anthropic.com/) - AI commentary (optional)
- A deployed Cloudflare Worker holding Finnhub and Massive API keys
- A Firebase project with Authentication and Firestore enabled

### Install

```bash
git clone https://github.com/salvatore-ardisi/intrinsic-public.git
cd intrinsic-public
npm install
```

### Configure

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

```
FRED_API_KEY=your_key
BLS_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
ENABLE_AI=false
EDGAR_USER_AGENT=YourApp you@example.com
PRICE_PROXY_URL=https://your-worker.workers.dev
```

Firebase configuration is set in `app.config.ts` via Expo extra fields.

### Run

```bash
npx expo start --clear
```

Scan the QR code with Expo Go on your device, or press `i` to launch in iOS Simulator.

## Architecture

The app uses a floor-based navigation model. A custom animated drawer selects an asset class (Economy, Stocks, Bonds, ETFs, Futures, Commodities). Each floor is a material-top-tabs navigator with a bottom tab bar supporting swipe between tabs. The stock detail screen is a root-level native-stack modal to avoid gesture conflicts with the drawer and pager.

A Cloudflare Worker proxy holds third-party API keys server-side so the app bundle never ships them. It exposes quote, profile, candle, news, and spark endpoints with built-in response caching and rate-limit handling.

AI commentary (Macro Summary, Daily Spark interpretation) is generated via the Claude API and cached in AsyncStorage by calendar date to avoid redundant calls.

Beta values on the stock detail screen are computed client-side from daily returns against SPY as the market benchmark.

## License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.
