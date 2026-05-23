import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Main: { floor?: string; tab?: string; params?: Record<string, string> } | undefined;
  StockDetail: { symbol: string };
  Settings: undefined;
};

export type EconomyTabParamList = {
  Indicators: { expandedSeriesId?: string } | undefined;
  Charts: { scrollTo?: string } | undefined;
  FedComms: undefined;
  News: undefined;
  Research: undefined;
};

export type StocksTabParamList = {
  Watchlist: undefined;
  StockCharts: undefined;
  Filings: { ticker?: string } | undefined;
  StockNews: { ticker?: string } | undefined;
  Valuation: undefined;
};

export type BondsTabParamList = {
  Yields: undefined;
  Curve: undefined;
  Spreads: undefined;
  BondCharts: undefined;
  Auctions: undefined;
};

export type EtfsTabParamList = {
  EtfScreener: undefined;
  EtfHoldings: undefined;
  EtfFlows: undefined;
  EtfCharts: undefined;
  EtfNews: undefined;
};

export type FuturesTabParamList = {
  FuturesQuotes: undefined;
  FuturesCurve: undefined;
  FuturesCot: undefined;
  FuturesCharts: undefined;
  FuturesNews: undefined;
};

export type CommoditiesTabParamList = {
  CommoditySpot: undefined;
  CommodityCurve: undefined;
  CommodityInventory: undefined;
  CommodityCharts: undefined;
  CommodityNews: undefined;
};

export type DrawerParamList = {
  Economy: NavigatorScreenParams<EconomyTabParamList> | undefined;
  Stocks: NavigatorScreenParams<StocksTabParamList> | undefined;
  Bonds: NavigatorScreenParams<BondsTabParamList> | undefined;
  ETFs: NavigatorScreenParams<EtfsTabParamList> | undefined;
  Futures: NavigatorScreenParams<FuturesTabParamList> | undefined;
  Commodities: NavigatorScreenParams<CommoditiesTabParamList> | undefined;
};

export type RootTabParamList = EconomyTabParamList;
