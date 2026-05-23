import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { colors, fonts } from '../../config/theme';
import { fetchUpcomingAuctions, fetchAuctionResults } from '../../lib/treasury';
import type { AuctionResult } from '../../lib/treasury';

const FILTERS = ['ALL', 'BILLS', 'NOTES', 'BONDS', 'TIPS', 'FRN'] as const;
type FilterType = typeof FILTERS[number];

function formatDate(dateStr: string): string {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.slice(0, 10);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr.slice(0, 10);
  }
}

function formatAmount(val: number | null): string {
  if (val === null || isNaN(val)) return '--';
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
}

function formatTerm(type: string, term: string): string {
  const t = type.toUpperCase();
  const termClean = term.replace(/\s+/g, ' ').trim();
  return `${t} ${termClean}`.toUpperCase();
}

export default function BondAuctionsScreen() {
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [upcoming, setUpcoming] = useState<AuctionResult[]>([]);
  const [recent, setRecent] = useState<AuctionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (type: FilterType, force = false) => {
    try {
      const [u, r] = await Promise.all([
        fetchUpcomingAuctions(type, force),
        fetchAuctionResults(type, force),
      ]);
      setUpcoming(u);
      setRecent(r);
    } catch {}
  }, []);

  useEffect(() => {
    setLoading(true);
    load(filter).finally(() => setLoading(false));
  }, [filter, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(filter, true);
    setRefreshing(false);
  }, [filter, load]);

  type SectionData = { title: string; data: AuctionResult[]; kind: 'upcoming' | 'recent' };
  const sections: SectionData[] = [];
  if (upcoming.length > 0) sections.push({ title: 'UPCOMING', data: upcoming.slice(0, 20), kind: 'upcoming' });
  if (recent.length > 0) sections.push({ title: 'RECENT RESULTS', data: recent.slice(0, 30), kind: 'recent' });

  return (
    <View style={s.container}>
      <View style={s.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[s.filterChip, filter === f && s.filterChipActive]}
            activeOpacity={0.7}
          >
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.amber} /></View>
      ) : sections.length === 0 ? (
        <View style={s.center}><Text style={s.emptyText}>No auction data available</Text></View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item.cusip}-${index}`}
          style={s.list}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              tintColor={colors.amber} colors={[colors.amber]} progressBackgroundColor={colors.surface} />
          }
          renderSectionHeader={({ section }) => (
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item, section }) => (
            section.kind === 'upcoming'
              ? <UpcomingRow auction={item} />
              : <RecentRow auction={item} />
          )}
        />
      )}
    </View>
  );
}

function UpcomingRow({ auction }: { auction: AuctionResult }) {
  return (
    <View style={s.row}>
      <View style={s.rowTop}>
        <Text style={s.securityType}>{formatTerm(auction.securityType, auction.securityTerm)}</Text>
      </View>
      <View style={s.rowMeta}>
        <Text style={s.metaLabel}>AUCTION</Text>
        <Text style={s.metaValue}>{formatDate(auction.auctionDate)}</Text>
        {auction.announcementDate && (
          <>
            <Text style={s.metaSep}>|</Text>
            <Text style={s.metaLabel}>ANNOUNCED</Text>
            <Text style={s.metaValue}>{formatDate(auction.announcementDate)}</Text>
          </>
        )}
      </View>
    </View>
  );
}

function RecentRow({ auction }: { auction: AuctionResult }) {
  return (
    <View style={s.row}>
      <View style={s.rowTop}>
        <Text style={s.securityType}>{formatTerm(auction.securityType, auction.securityTerm)}</Text>
        <Text style={s.auctionDate}>{formatDate(auction.auctionDate)}</Text>
      </View>
      <View style={s.resultRow}>
        {auction.highYield && (
          <View style={s.resultItem}>
            <Text style={s.resultLabel}>YIELD</Text>
            <Text style={s.resultValue}>{auction.highYield}%</Text>
          </View>
        )}
        {auction.bidToCoverRatio && (
          <View style={s.resultItem}>
            <Text style={s.resultLabel}>BID/COVER</Text>
            <Text style={s.resultValue}>{auction.bidToCoverRatio}x</Text>
          </View>
        )}
        {auction.totalAccepted !== null && (
          <View style={s.resultItem}>
            <Text style={s.resultLabel}>ACCEPTED</Text>
            <Text style={s.resultValue}>{formatAmount(auction.totalAccepted)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { flex: 1 },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 6,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  filterChip: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  filterText: { fontFamily: fonts.monoBold, fontSize: 9, color: colors.textMuted },
  filterTextActive: { color: colors.surface },
  emptyText: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted },
  sectionHeader: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: colors.surfaceAlt, borderTopWidth: 1, borderTopColor: colors.border,
  },
  sectionTitle: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.accent },
  row: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  rowTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  securityType: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.textPrimary },
  auctionDate: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  rowMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  metaLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.textMuted },
  metaValue: { fontFamily: fonts.mono, fontSize: 10, color: colors.textSecondary, marginLeft: 4 },
  metaSep: { fontFamily: fonts.mono, fontSize: 9, color: colors.border, marginHorizontal: 6 },
  resultRow: { flexDirection: 'row', marginTop: 6, gap: 16 },
  resultItem: {},
  resultLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.textMuted },
  resultValue: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.textPrimary, marginTop: 1 },
});
