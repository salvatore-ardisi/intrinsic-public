import 'react-native-gesture-handler';
import { useState, useRef, useCallback, useEffect, createContext, useContext } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback,
  Animated, Dimensions, StyleSheet, Image, Modal,
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import type { PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { colors, fonts } from './src/config/theme';
import type { EconomyTabParamList, StocksTabParamList, BondsTabParamList, EtfsTabParamList, FuturesTabParamList, CommoditiesTabParamList, DrawerParamList, RootStackParamList } from './src/lib/navigation';
import IndicatorsScreen from './src/screens/IndicatorsScreen';
import ChartsScreen from './src/screens/ChartsScreen';
import FedCommsScreen from './src/screens/FedCommsScreen';
import NewsScreen from './src/screens/NewsScreen';
import ResearchScreen from './src/screens/ResearchScreen';
import FilingsScreen from './src/screens/FilingsScreen';
import WatchlistScreen from './src/screens/WatchlistScreen';
import StockDetailScreen from './src/screens/StockDetailScreen';
import StockNewsScreen from './src/screens/StockNewsScreen';
import StockChartsScreen from './src/screens/StockChartsScreen';
import { createStubScreen } from './src/components/StubScreen';
import ValuationScreen from './src/screens/ValuationScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import BondYieldsScreen from './src/screens/bonds/BondYieldsScreen';
import BondCurveScreen from './src/screens/bonds/BondCurveScreen';
import BondSpreadsScreen from './src/screens/bonds/BondSpreadsScreen';
import BondChartsScreen from './src/screens/bonds/BondChartsScreen';
import BondAuctionsScreen from './src/screens/bonds/BondAuctionsScreen';

SplashScreen.preventAutoHideAsync();

const DRAWER_WIDTH = 260;
const TAB_ICON_SIZE = 24;

const DrawerContext = createContext<{ toggle: () => void; openDrawer: () => void }>({
  toggle: () => {},
  openDrawer: () => {},
});

export function useDrawer() {
  return useContext(DrawerContext);
}

export const PendingNavContext = createContext<React.MutableRefObject<{ tab: string; params?: Record<string, string> } | null>>({ current: null });

const EconomyTab = createMaterialTopTabNavigator<EconomyTabParamList>();
const StocksTab = createMaterialTopTabNavigator<StocksTabParamList>();
const BondsTab = createMaterialTopTabNavigator<BondsTabParamList>();
const EtfsTab = createMaterialTopTabNavigator<EtfsTabParamList>();
const FuturesTab = createMaterialTopTabNavigator<FuturesTabParamList>();
const CommoditiesTab = createMaterialTopTabNavigator<CommoditiesTabParamList>();

const RootStack = createNativeStackNavigator<RootStackParamList>();



const EtfScreener = createStubScreen('FUNDS', 'SCREENER');
const EtfHoldings = createStubScreen('FUNDS', 'HOLDINGS');
const EtfFlows = createStubScreen('FUNDS', 'FLOWS');
const EtfCharts = createStubScreen('FUNDS', 'CHARTS');
const EtfNews = createStubScreen('FUNDS', 'NEWS');

const FuturesQuotes = createStubScreen('DERIVATIVES', 'QUOTES');
const FuturesCurve = createStubScreen('DERIVATIVES', 'CURVE');
const FuturesCot = createStubScreen('DERIVATIVES', 'COT');
const FuturesCharts = createStubScreen('DERIVATIVES', 'CHARTS');
const FuturesNews = createStubScreen('DERIVATIVES', 'NEWS');

const CommoditySpot = createStubScreen('PHYSICAL', 'SPOT');
const CommodityCurve = createStubScreen('PHYSICAL', 'CURVE');
const CommodityInventory = createStubScreen('PHYSICAL', 'INVENTORY');
const CommodityCharts = createStubScreen('PHYSICAL', 'CHARTS');
const CommodityNews = createStubScreen('PHYSICAL', 'NEWS');

function DrawerMenuButton() {
  const { toggle } = useDrawer();
  return (
    <TouchableOpacity onPress={toggle} style={{ paddingLeft: 16, paddingRight: 12 }} accessibilityLabel="Open menu">
      <Ionicons name="menu" size={22} color={colors.accent} />
    </TouchableOpacity>
  );
}

/* ---------- Custom bottom tab bar ---------- */

function BottomTabBar({
  state,
  descriptors,
  navigation,
  onIndexChange,
}: MaterialTopTabBarProps & { onIndexChange?: (i: number) => void }) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    onIndexChange?.(state.index);
  }, [state.index, onIndexChange]);

  return (
    <View style={[tb.bar, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const color = focused ? colors.accent : colors.textMuted;

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            activeOpacity={0.7}
            style={tb.tab}
          >
            {options.tabBarIcon?.({ focused, color })}
            <Text style={[tb.label, { color }]}>
              {typeof options.tabBarLabel === 'string'
                ? options.tabBarLabel
                : (options.title ?? route.name)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tb = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  label: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    marginTop: 2,
  },
});

/* ---------- Floor wrapper: header + edge-swipe drawer ---------- */

function useFloor() {
  const [tabIndex, setTabIndex] = useState(0);
  const renderTabBar = useCallback(
    (props: MaterialTopTabBarProps) => <BottomTabBar {...props} onIndexChange={setTabIndex} />,
    [],
  );
  return { tabIndex, renderTabBar };
}

function FloorContainer({
  children,
  titles,
  tabIndex,
}: {
  children: React.ReactNode;
  titles: string[];
  tabIndex: number;
}) {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useDrawer();

  const onEdgeSwipe = useCallback(
    (e: PanGestureHandlerStateChangeEvent) => {
      if (e.nativeEvent.oldState === State.ACTIVE && e.nativeEvent.translationX > 50) {
        openDrawer();
      }
    },
    [openDrawer],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <View style={hdr.row}>
        <DrawerMenuButton />
        <Text style={hdr.title}>{titles[tabIndex] ?? ''}</Text>
      </View>
      <View style={{ flex: 1 }}>
        {children}
        {tabIndex === 0 && (
          <PanGestureHandler
            activeOffsetX={20}
            failOffsetX={-10}
            failOffsetY={[-15, 15]}
            onHandlerStateChange={onEdgeSwipe}
          >
            <View style={edgeZone} />
          </PanGestureHandler>
        )}
      </View>
    </View>
  );
}

const hdr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: fonts.monoBold,
    fontSize: 14,
    color: colors.accent,
  },
});

const edgeZone: import('react-native').ViewStyle = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: 30,
};

/* ---------- Floor navigators ---------- */

const ECONOMY_TITLES = ['INDICATORS', 'CHARTS', 'FED COMMS', 'NEWS', 'RESEARCH'];

function EconomyTabs() {
  const { tabIndex, renderTabBar } = useFloor();
  return (
    <FloorContainer titles={ECONOMY_TITLES} tabIndex={tabIndex}>
      <EconomyTab.Navigator tabBarPosition="bottom" tabBar={renderTabBar}>
        <EconomyTab.Screen
          name="Indicators"
          component={IndicatorsScreen}
          options={{ title: 'INDICATORS', tabBarIcon: ({ color }) => <Ionicons name="trending-up" size={TAB_ICON_SIZE} color={color} /> }}
        />
        <EconomyTab.Screen
          name="Charts"
          component={ChartsScreen}
          options={{ title: 'CHARTS', tabBarIcon: ({ color }) => <Ionicons name="analytics" size={TAB_ICON_SIZE} color={color} /> }}
        />
        <EconomyTab.Screen
          name="FedComms"
          component={FedCommsScreen}
          options={{ title: 'FED COMMS', tabBarIcon: ({ color }) => <Ionicons name="megaphone-outline" size={TAB_ICON_SIZE} color={color} /> }}
        />
        <EconomyTab.Screen
          name="News"
          component={NewsScreen}
          options={{ title: 'NEWS', tabBarIcon: ({ color }) => <Ionicons name="newspaper-outline" size={TAB_ICON_SIZE} color={color} /> }}
        />
        <EconomyTab.Screen
          name="Research"
          component={ResearchScreen}
          options={{ title: 'RESEARCH', tabBarIcon: ({ color }) => <Ionicons name="book" size={TAB_ICON_SIZE} color={color} /> }}
        />
      </EconomyTab.Navigator>
    </FloorContainer>
  );
}

const STOCKS_TITLES = ['WATCHLIST', 'CHARTS', 'FILINGS', 'NEWS', 'VALUATION'];

function StocksTabs() {
  const { tabIndex, renderTabBar } = useFloor();
  const pendingRef = useContext(PendingNavContext);
  const navRef = useRef<any>(null);

  useEffect(() => {
    const pending = pendingRef.current;
    if (pending && navRef.current) {
      pendingRef.current = null;
      navRef.current.navigate(pending.tab, pending.params ?? {});
    }
  });

  const handleTabBarRef = useCallback((props: MaterialTopTabBarProps) => {
    navRef.current = props.navigation;
    return renderTabBar(props);
  }, [renderTabBar]);

  return (
    <FloorContainer titles={STOCKS_TITLES} tabIndex={tabIndex}>
      <StocksTab.Navigator tabBarPosition="bottom" tabBar={handleTabBarRef}>
        <StocksTab.Screen name="Watchlist" component={WatchlistScreen} options={{ title: 'WATCHLIST', tabBarIcon: ({ color }) => <Ionicons name="eye-outline" size={TAB_ICON_SIZE} color={color} /> }} />
        <StocksTab.Screen name="StockCharts" component={StockChartsScreen} options={{ title: 'CHARTS', tabBarIcon: ({ color }) => <Ionicons name="stats-chart" size={TAB_ICON_SIZE} color={color} /> }} />
        <StocksTab.Screen name="Filings" component={FilingsScreen} options={{ title: 'FILINGS', tabBarIcon: ({ color }) => <Ionicons name="document-text-outline" size={TAB_ICON_SIZE} color={color} /> }} />
        <StocksTab.Screen name="StockNews" component={StockNewsScreen} options={{ title: 'NEWS', tabBarIcon: ({ color }) => <Ionicons name="newspaper-outline" size={TAB_ICON_SIZE} color={color} /> }} />
        <StocksTab.Screen name="Valuation" component={ValuationScreen} options={{ title: 'VALUATION', tabBarIcon: ({ color }) => <Ionicons name="calculator-outline" size={TAB_ICON_SIZE} color={color} /> }} />
      </StocksTab.Navigator>
    </FloorContainer>
  );
}

const BONDS_TITLES = ['YIELDS', 'CURVE', 'SPREADS', 'CHARTS', 'AUCTIONS'];

function BondsTabs() {
  const { tabIndex, renderTabBar } = useFloor();
  return (
    <FloorContainer titles={BONDS_TITLES} tabIndex={tabIndex}>
      <BondsTab.Navigator tabBarPosition="bottom" tabBar={renderTabBar}>
        <BondsTab.Screen name="Yields" component={BondYieldsScreen} options={{ title: 'YIELDS', tabBarIcon: ({ color }) => <Ionicons name="trending-up" size={TAB_ICON_SIZE} color={color} /> }} />
        <BondsTab.Screen name="Curve" component={BondCurveScreen} options={{ title: 'CURVE', tabBarIcon: ({ color }) => <Ionicons name="pulse-outline" size={TAB_ICON_SIZE} color={color} /> }} />
        <BondsTab.Screen name="Spreads" component={BondSpreadsScreen} options={{ title: 'SPREADS', tabBarIcon: ({ color }) => <Ionicons name="git-compare-outline" size={TAB_ICON_SIZE} color={color} /> }} />
        <BondsTab.Screen name="BondCharts" component={BondChartsScreen} options={{ title: 'CHARTS', tabBarIcon: ({ color }) => <Ionicons name="analytics" size={TAB_ICON_SIZE} color={color} /> }} />
        <BondsTab.Screen name="Auctions" component={BondAuctionsScreen} options={{ title: 'AUCTIONS', tabBarIcon: ({ color }) => <Ionicons name="hammer-outline" size={TAB_ICON_SIZE} color={color} /> }} />
      </BondsTab.Navigator>
    </FloorContainer>
  );
}

const ETFS_TITLES = ['SCREENER', 'HOLDINGS', 'FLOWS', 'CHARTS', 'NEWS'];

function EtfsTabs() {
  const { tabIndex, renderTabBar } = useFloor();
  return (
    <FloorContainer titles={ETFS_TITLES} tabIndex={tabIndex}>
      <EtfsTab.Navigator tabBarPosition="bottom" tabBar={renderTabBar}>
        <EtfsTab.Screen name="EtfScreener" component={EtfScreener} options={{ title: 'SCREENER', tabBarIcon: ({ color }) => <Ionicons name="list-outline" size={TAB_ICON_SIZE} color={color} /> }} />
        <EtfsTab.Screen name="EtfHoldings" component={EtfHoldings} options={{ title: 'HOLDINGS', tabBarIcon: ({ color }) => <Ionicons name="pie-chart-outline" size={TAB_ICON_SIZE} color={color} /> }} />
        <EtfsTab.Screen name="EtfFlows" component={EtfFlows} options={{ title: 'FLOWS', tabBarIcon: ({ color }) => <Ionicons name="swap-horizontal-outline" size={TAB_ICON_SIZE} color={color} /> }} />
        <EtfsTab.Screen name="EtfCharts" component={EtfCharts} options={{ title: 'CHARTS', tabBarIcon: ({ color }) => <Ionicons name="analytics" size={TAB_ICON_SIZE} color={color} /> }} />
        <EtfsTab.Screen name="EtfNews" component={EtfNews} options={{ title: 'NEWS', tabBarIcon: ({ color }) => <Ionicons name="newspaper-outline" size={TAB_ICON_SIZE} color={color} /> }} />
      </EtfsTab.Navigator>
    </FloorContainer>
  );
}

const FUTURES_TITLES = ['QUOTES', 'CURVE', 'COT', 'CHARTS', 'NEWS'];

function FuturesTabs() {
  const { tabIndex, renderTabBar } = useFloor();
  return (
    <FloorContainer titles={FUTURES_TITLES} tabIndex={tabIndex}>
      <FuturesTab.Navigator tabBarPosition="bottom" tabBar={renderTabBar}>
        <FuturesTab.Screen name="FuturesQuotes" component={FuturesQuotes} options={{ title: 'QUOTES', tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={TAB_ICON_SIZE} color={color} /> }} />
        <FuturesTab.Screen name="FuturesCurve" component={FuturesCurve} options={{ title: 'CURVE', tabBarIcon: ({ color }) => <Ionicons name="pulse-outline" size={TAB_ICON_SIZE} color={color} /> }} />
        <FuturesTab.Screen name="FuturesCot" component={FuturesCot} options={{ title: 'COT', tabBarIcon: ({ color }) => <Ionicons name="document-text-outline" size={TAB_ICON_SIZE} color={color} /> }} />
        <FuturesTab.Screen name="FuturesCharts" component={FuturesCharts} options={{ title: 'CHARTS', tabBarIcon: ({ color }) => <Ionicons name="analytics" size={TAB_ICON_SIZE} color={color} /> }} />
        <FuturesTab.Screen name="FuturesNews" component={FuturesNews} options={{ title: 'NEWS', tabBarIcon: ({ color }) => <Ionicons name="newspaper-outline" size={TAB_ICON_SIZE} color={color} /> }} />
      </FuturesTab.Navigator>
    </FloorContainer>
  );
}

const COMMODITIES_TITLES = ['SPOT', 'CURVE', 'INVENTORY', 'CHARTS', 'NEWS'];

function CommoditiesTabs() {
  const { tabIndex, renderTabBar } = useFloor();
  return (
    <FloorContainer titles={COMMODITIES_TITLES} tabIndex={tabIndex}>
      <CommoditiesTab.Navigator tabBarPosition="bottom" tabBar={renderTabBar}>
        <CommoditiesTab.Screen name="CommoditySpot" component={CommoditySpot} options={{ title: 'SPOT', tabBarIcon: ({ color }) => <Ionicons name="water-outline" size={TAB_ICON_SIZE} color={color} /> }} />
        <CommoditiesTab.Screen name="CommodityCurve" component={CommodityCurve} options={{ title: 'CURVE', tabBarIcon: ({ color }) => <Ionicons name="pulse-outline" size={TAB_ICON_SIZE} color={color} /> }} />
        <CommoditiesTab.Screen name="CommodityInventory" component={CommodityInventory} options={{ title: 'INVENTORY', tabBarIcon: ({ color }) => <Ionicons name="cube-outline" size={TAB_ICON_SIZE} color={color} /> }} />
        <CommoditiesTab.Screen name="CommodityCharts" component={CommodityCharts} options={{ title: 'CHARTS', tabBarIcon: ({ color }) => <Ionicons name="analytics" size={TAB_ICON_SIZE} color={color} /> }} />
        <CommoditiesTab.Screen name="CommodityNews" component={CommodityNews} options={{ title: 'NEWS', tabBarIcon: ({ color }) => <Ionicons name="newspaper-outline" size={TAB_ICON_SIZE} color={color} /> }} />
      </CommoditiesTab.Navigator>
    </FloorContainer>
  );
}

/* ---------- Drawer + root ---------- */

type Section = keyof DrawerParamList;

const DRAWER_ITEMS: { key: Section; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'Economy', label: 'ECONOMY', icon: 'earth' },
  { key: 'Stocks', label: 'STOCKS', icon: 'stats-chart' },
  { key: 'Bonds', label: 'BONDS', icon: 'business-outline' },
  { key: 'ETFs', label: 'ETFS', icon: 'file-tray-stacked-outline' },
  { key: 'Futures', label: 'FUTURES', icon: 'time-outline' },
  { key: 'Commodities', label: 'COMMODITIES', icon: 'diamond-outline' },
];

const SECTION_COMPONENTS: Record<Section, React.ComponentType> = {
  Economy: EconomyTabs,
  Stocks: StocksTabs,
  Bonds: BondsTabs,
  ETFs: EtfsTabs,
  Futures: FuturesTabs,
  Commodities: CommoditiesTabs,
};

type MainProps = NativeStackScreenProps<RootStackParamList, 'Main'>;

function MainScreen({ route, navigation: stackNav }: MainProps) {
  const initFloor = route.params?.floor as Section | undefined;
  const [activeSection, setActiveSection] = useState<Section>(
    initFloor && SECTION_COMPONENTS[initFloor] ? initFloor : 'Economy',
  );
  const initTab = route.params?.tab;
  const pendingNav = useRef<{ tab: string; params?: Record<string, string> } | null>(
    initTab ? { tab: initTab, params: route.params?.params } : null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [slideAnim, overlayAnim]);

  const closeDrawer = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -DRAWER_WIDTH, duration: 200, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setDrawerOpen(false));
  }, [slideAnim, overlayAnim]);

  const toggle = useCallback(() => {
    if (drawerOpen) closeDrawer();
    else openDrawer();
  }, [drawerOpen, openDrawer, closeDrawer]);

  const selectSection = useCallback((section: Section) => {
    setActiveSection(section);
    closeDrawer();
  }, [closeDrawer]);

  useEffect(() => {
    const floor = route.params?.floor as Section | undefined;
    const tab = route.params?.tab;
    if (floor && SECTION_COMPONENTS[floor]) {
      setActiveSection(floor);
      if (tab) pendingNav.current = { tab, params: route.params?.params };
    }
  }, [route.params]);

  const ActiveComponent = SECTION_COMPONENTS[activeSection];

  return (
    <DrawerContext.Provider value={{ toggle, openDrawer }}>
      <PendingNavContext.Provider value={pendingNav}>
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <ActiveComponent />

        {drawerOpen && (
          <TouchableWithoutFeedback onPress={closeDrawer}>
            <Animated.View style={[d.overlay, { opacity: overlayAnim }]} />
          </TouchableWithoutFeedback>
        )}

        <Animated.View style={[d.drawer, { transform: [{ translateX: slideAnim }] }]}>
          <View style={d.header}>
            <Text style={d.brand}>INTRINSIC</Text>
            <Text style={d.tagline}>MARKET INTELLIGENCE TERMINAL</Text>
          </View>

          <View style={d.items}>
            <Text style={d.sectionLabel}>ASSET CLASSES</Text>
            {DRAWER_ITEMS.map(item => {
              const active = activeSection === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => selectSection(item.key)}
                  activeOpacity={0.7}
                  style={[d.item, active && d.itemActive]}
                >
                  <Ionicons name={item.icon} size={16} color={active ? colors.accent : colors.textMuted} />
                  <Text style={[d.itemLabel, active && d.itemLabelActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={d.footer}>
            <TouchableOpacity activeOpacity={0.7} style={d.footerItem} onPress={() => { closeDrawer(); stackNav.navigate('Settings'); }}>
              <Ionicons name="settings-outline" size={14} color={colors.textMuted} />
              <Text style={d.footerText}>SETTINGS</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} style={d.footerItem} onPress={() => setAboutVisible(true)}>
              <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
              <Text style={d.footerText}>ABOUT</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Modal
          visible={aboutVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAboutVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setAboutVisible(false)}>
            <View style={about.overlay}>
              <TouchableWithoutFeedback>
                <View style={about.card}>
                  <TouchableOpacity style={about.close} onPress={() => setAboutVisible(false)}>
                    <Ionicons name="close" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                  <Image source={require('./assets/icon.png')} style={about.icon} />
                  <Text style={about.title}>INTRINSIC MOBILE</Text>
                  <Text style={about.version}>v1.0.0</Text>
                  <Text style={about.subtitle}>Market Intelligence Terminal</Text>
                  <View style={about.divider} />
                  <Text style={about.detail}>Built with Expo + React Native</Text>
                  <Text style={about.detail}>Data: FRED, BLS, SEC EDGAR, Federal Reserve</Text>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    </PendingNavContext.Provider>
    </DrawerContext.Provider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <View style={{ flex: 1, backgroundColor: colors.surface }} onLayout={onLayoutRootView}>
            <RootStack.Navigator screenOptions={{ headerShown: false }}>
              <RootStack.Screen name="Main" component={MainScreen} />
              <RootStack.Screen
                name="StockDetail"
                component={StockDetailScreen}
                options={{
                  presentation: 'fullScreenModal',
                  gestureEnabled: true,
                  contentStyle: { backgroundColor: colors.surface },
                }}
              />
              <RootStack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{
                  gestureEnabled: true,
                  contentStyle: { backgroundColor: colors.surface },
                }}
              />
            </RootStack.Navigator>
          </View>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const { height } = Dimensions.get('window');

const d = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DRAWER_WIDTH,
    height,
    backgroundColor: colors.surfaceAlt,
    borderRightWidth: 1,
    borderRightColor: colors.accent,
    paddingTop: 60,
    zIndex: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  brand: {
    fontFamily: fonts.monoBold,
    fontSize: 18,
    color: colors.accent,
    letterSpacing: 6,
  },
  tagline: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 4,
    letterSpacing: 1.5,
  },
  sectionLabel: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 2,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  items: { flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  itemActive: {
    backgroundColor: '#141414',
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  itemLabel: {
    fontFamily: fonts.monoBold,
    fontSize: 12,
    color: colors.textMuted,
  },
  itemLabelActive: { color: colors.accent },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    gap: 4,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  footerText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
  },
});

const about = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: 'center',
    width: 260,
  },
  close: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 4,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 10,
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.monoBold,
    fontSize: 14,
    color: '#CC6600',
    letterSpacing: 3,
  },
  version: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: '#666666',
    marginTop: 4,
  },
  subtitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: '#666666',
    marginTop: 2,
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  detail: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 14,
  },
});
