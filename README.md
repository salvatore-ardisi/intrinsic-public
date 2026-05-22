![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg) ![Platform: iOS](https://img.shields.io/badge/Platform-iOS-lightgrey.svg) ![Expo SDK 54](https://img.shields.io/badge/Expo_SDK-54-000020.svg) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg) ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

# Intrinsic Mobile

A mobile market intelligence app built with Expo and React Native. Dense, data-focused dark monospace interface for tracking U.S. macroeconomic indicators, equities, SEC filings, and Federal Reserve communications.

## Features

**Economy (live)** - FRED and BLS macro series grouped by Labor, Inflation, Growth, and Interest Rates. Sparklines, historical analysis, multi-series overlay charts, Fed RSS feeds, aggregated financial news, and optional AI commentary via Claude API.

**Stocks (partially live)** - Watchlist with live quotes and company profiles. Stock detail with daily charts. SEC EDGAR filing search and company news via Google News RSS.

**Bonds, ETFs, Futures, Commodities** - Navigation and tab structures are defined and ready for implementation.

## Tech Stack

- Expo SDK 54, React Native, TypeScript
- Custom animated drawer navigation, material-top-tabs, native-stack
- JetBrains Mono font
- react-native-svg for charting
- fast-xml-parser for RSS/XML feeds
- Cloudflare Worker proxy for third-party API key management

## Setup

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go on a physical device or an emulator

### API Keys (all free tier)

- [FRED API](https://fred.stlouisfed.org/docs/api/api_key.html) - macroeconomic data
- [BLS API](https://data.bls.gov/registrationEngine/) - employment data
- [Anthropic API](https://console.anthropic.com/) - AI commentary (optional)
- A deployed Cloudflare Worker holding Finnhub and Alpha Vantage keys

### Install

```bash
git clone https://github.com/salardisi/intrinsic-public.git
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

### Run

```bash
npx expo start --clear
```

Scan the QR code with Expo Go on your device. Use `--tunnel` if your device is on a different network.

## Architecture

The app uses a floor-based navigation model. A custom animated drawer selects an asset class (Economy, Stocks, Bonds, etc.). Each floor is a material-top-tabs navigator with a bottom tab bar supporting swipe between tabs. The stock detail screen is a root-level native-stack modal to avoid gesture conflicts with the drawer and pager.

A Cloudflare Worker proxy holds third-party API keys server-side so the app bundle never ships them. It exposes quote, profile, news, and candle endpoints with built-in response caching.

## Data Sources

| Source | Auth | Data |
|---|---|---|
| FRED API | Free API key | Macro indicators (unemployment, CPI, GDP, fed funds, treasuries, mortgage rates) |
| BLS API v2 | Free API key | Nonfarm payrolls, labor force participation |
| Federal Reserve | None | Press releases, FOMC statements, speeches (RSS) |
| SEC EDGAR | None (User-Agent required) | Company tickers, filings |
| Finnhub (via Worker) | Key in Worker | Stock quotes, company profiles |
| Alpha Vantage (via Worker) | Key in Worker | Daily price candles |
| Google News | None | Company news (RSS) |

## License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.
