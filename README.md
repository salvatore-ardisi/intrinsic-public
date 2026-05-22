# Intrinsic Mobile

A mobile market intelligence terminal built with Expo and React Native. Bloomberg-style dark monospace interface for tracking U.S. macroeconomic indicators, equities, SEC filings, and Federal Reserve communications.

## Features

### Economy
- **Indicators** - FRED + BLS macro series grouped by Labor, Inflation, Growth, Interest Rates. Sparklines, historical analysis, trend detection, and cross-referencing to related news/research.
- **Charts** - Multi-series overlay charts (unemployment vs fed funds, inflation vs policy, yield curve spread) via react-native-svg.
- **Fed Communications** - Federal Reserve RSS feeds classified by type (FOMC statements, minutes, speeches).
- **News** - Aggregated RSS from major financial outlets, merged/deduped/sorted.
- **Research** - FRED Blog + BLS research feeds with filter chips.
- **AI Commentary** - On-demand macro summary and interpretation via Claude API (optional, requires Anthropic key).

### Stocks
- **Watchlist** - Live quotes and company profiles. Add/remove tickers with autocomplete from the EDGAR ticker map. Persisted via AsyncStorage.
- **Stock Detail** - Price, daily chart, company profile, and related links. Presented as a full-screen modal with swipe-down dismiss.
- **Filings** - SEC EDGAR integration. Search by ticker or browse recent filings from watchlist companies. Includes a filing type reference card.
- **News** - Watchlist-driven company news via Google News RSS.

### Additional Asset Classes (Planned)
Bonds, ETFs, Futures, and Commodities floors are defined with tab structures ready for implementation.

## Tech Stack

- Expo SDK 54, React Native, TypeScript
- Custom animated drawer navigation + material-top-tabs + native-stack
- JetBrains Mono font throughout
- react-native-svg for charting
- fast-xml-parser for RSS/XML feeds
- Cloudflare Worker proxy for third-party API key management

## Setup

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on a physical device (or an emulator)

### API Keys (all free tier)
- [FRED API](https://fred.stlouisfed.org/docs/api/api_key.html) - macroeconomic data
- [BLS API](https://data.bls.gov/registrationEngine/) - employment data
- [Anthropic API](https://console.anthropic.com/) - AI commentary (optional)
- A deployed Cloudflare Worker holding Finnhub and Alpha Vantage keys (see `wrangler.toml` in the proxy repo)

### Install

```bash
git clone https://github.com/YOUR_USERNAME/intrinsic-mobile-public.git
cd intrinsic-mobile-public
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
ANTHROPIC_API_KEY=your_key        # optional
ENABLE_AI=false                    # set true to enable AI features
EDGAR_USER_AGENT=YourApp your@email.com
PRICE_PROXY_URL=https://your-worker.workers.dev
```

### Run

```bash
npx expo start --clear
```

Scan the QR code with Expo Go on your device. Use `--tunnel` if your device is on a different network.

## Architecture

The app uses a floor-based navigation model. A custom animated drawer selects an asset class (Economy, Stocks, Bonds, etc.). Each floor is its own material-top-tabs navigator with a bottom tab bar that supports swipe between tabs. The stock detail screen is a root-level native-stack modal to avoid gesture conflicts with the drawer and pager.

The Cloudflare Worker proxy holds third-party API keys server-side so the app bundle never ships them. It exposes `/quote`, `/profile`, `/news`, and `/candle` endpoints with built-in response caching.

## Data Sources

| Source | Auth | Data |
|---|---|---|
| FRED API | Free API key | Macro indicators (unemployment, CPI, GDP, fed funds, treasuries, mortgage rates) |
| BLS API v2 | Free API key | Nonfarm payrolls, labor force participation |
| Federal Reserve | None | Press releases, FOMC statements, speeches (RSS) |
| SEC EDGAR | None (User-Agent required) | Company tickers, filings |
| Finnhub (via Worker) | Key in Worker | Stock quotes, company profiles |
| Alpha Vantage (via Worker) | Key in Worker | Daily price candles (~25/day free limit) |
| Google News | None | Company news (RSS) |
| Financial news outlets | None | Market news (RSS) |

## License

MIT
