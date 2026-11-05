import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Invoice, StoreSettings, ThemeMode } from '../types';
import { getEffectiveUpiAccounts } from '../utils/upi';

interface SalesReportsProps {
  invoices: Invoice[];
  settings: StoreSettings;
  onViewInvoice: (invoice: Invoice) => void;
  theme?: ThemeMode;
}

type DatePreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST7' | 'THIS_MONTH' | 'CUSTOM';

const formatDateForInput = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const SalesReportsNative: React.FC<SalesReportsProps> = ({
  invoices,
  settings,
  onViewInvoice,
  theme = 'dark',
}) => {
  const isDark = theme !== 'light';
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activePreset, setActivePreset] = useState<DatePreset>('ALL');

  // Top Sold Items Report State
  const [topItemsScope, setTopItemsScope] = useState<'PERIOD' | 'ALL'>('PERIOD');
  const [topItemsSortBy, setTopItemsSortBy] = useState<'QTY' | 'REVENUE'>('QTY');
  const [topItemSearch, setTopItemSearch] = useState<string>('');

  // Overall Lifetime KPIs
  const overallSales = useMemo(() => invoices.reduce((sum, inv) => sum + inv.grandTotal, 0), [invoices]);
  const overallTax = useMemo(() => invoices.reduce((sum, inv) => sum + inv.taxTotal, 0), [invoices]);
  const overallCount = invoices.length;

  // Preset Button Handlers
  const handlePresetChange = (preset: DatePreset) => {
    setActivePreset(preset);
    const today = new Date();

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (preset === 'TODAY') {
      const todayStr = formatDateForInput(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
      return;
    }

    if (preset === 'YESTERDAY') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      const yestStr = formatDateForInput(yest);
      setStartDate(yestStr);
      setEndDate(yestStr);
      return;
    }

    if (preset === 'LAST7') {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      setStartDate(formatDateForInput(start));
      setEndDate(formatDateForInput(today));
      return;
    }

    if (preset === 'THIS_MONTH') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatDateForInput(start));
      setEndDate(formatDateForInput(today));
      return;
    }
  };

  const handleCustomDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setActivePreset('CUSTOM');
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
    setActivePreset('ALL');
  };

  // Date Filtered Invoices
  const dateFilteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (!inv.timestamp) return true;
      const invDate = new Date(inv.timestamp);
      if (isNaN(invDate.getTime())) return true;

      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`);
        if (invDate < start) return false;
      }

      if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999`);
        if (invDate > end) return false;
      }

      return true;
    });
  }, [invoices, startDate, endDate]);

  // Period Analytics Summary Metrics
  const periodStats = useMemo(() => {
    const totalSales = dateFilteredInvoices.reduce((sum, i) => sum + i.grandTotal, 0);
    const totalTax = dateFilteredInvoices.reduce((sum, i) => sum + i.taxTotal, 0);
    const totalDiscount = dateFilteredInvoices.reduce((sum, i) => sum + i.discountTotal, 0);
    const count = dateFilteredInvoices.length;
    const avgOrderValue = count > 0 ? totalSales / count : 0;

    const cash = dateFilteredInvoices.filter(i => i.paymentMethod === 'CASH').reduce((sum, i) => sum + i.grandTotal, 0);
    const upi = dateFilteredInvoices.filter(i => i.paymentMethod === 'UPI').reduce((sum, i) => sum + i.grandTotal, 0);
    const card = dateFilteredInvoices.filter(i => i.paymentMethod === 'CARD').reduce((sum, i) => sum + i.grandTotal, 0);

    return {
      totalSales,
      totalTax,
      totalDiscount,
      count,
      avgOrderValue,
      cash,
      upi,
      card,
      digital: upi + card,
    };
  }, [dateFilteredInvoices]);

  // Top Sold Items Aggregation
  const topSoldProducts = useMemo(() => {
    const targetInvoices = topItemsScope === 'PERIOD' ? dateFilteredInvoices : invoices;
    const map = new Map<string, {
      id: string;
      barcode: string;
      name: string;
      totalQty: number;
      totalRevenue: number;
      orderCount: number;
      avgPrice: number;
    }>();

    targetInvoices.forEach((inv) => {
      inv.items.forEach((item) => {
        const key = item.productId || item.barcode || item.name;
        const existing = map.get(key);
        if (existing) {
          existing.totalQty += item.quantity;
          existing.totalRevenue += item.lineTotal;
          existing.orderCount += 1;
        } else {
          map.set(key, {
            id: item.productId,
            barcode: item.barcode,
            name: item.name,
            totalQty: item.quantity,
            totalRevenue: item.lineTotal,
            orderCount: 1,
            avgPrice: item.unitPrice,
          });
        }
      });
    });

    let list = Array.from(map.values());

    if (topItemsSortBy === 'QTY') {
      list.sort((a, b) => b.totalQty - a.totalQty);
    } else {
      list.sort((a, b) => b.totalRevenue - a.totalRevenue);
    }

    if (topItemSearch.trim()) {
      const q = topItemSearch.toLowerCase();
      list = list.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.barcode.includes(q)
      );
    }

    return list;
  }, [invoices, dateFilteredInvoices, topItemsScope, topItemsSortBy, topItemSearch]);

  const maxSoldQty = useMemo(() => {
    if (topSoldProducts.length === 0) return 1;
    return Math.max(...topSoldProducts.map(p => p.totalQty), 1);
  }, [topSoldProducts]);

  // Search Filtered Invoices List
  const searchFilteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return dateFilteredInvoices;
    const q = searchQuery.toLowerCase();
    return dateFilteredInvoices.filter(
      (inv) =>
        inv.id.toLowerCase().includes(q) ||
        (inv.customerName && inv.customerName.toLowerCase().includes(q))
    );
  }, [dateFilteredInvoices, searchQuery]);

  // Account / Cashier breakdown for the filtered period
  const accountStats = useMemo(() => {
    const map = new Map<string, {
      cashierName: string;
      orderCount: number;
      totalRevenue: number;
      cashRevenue: number;
      upiRevenue: number;
      cardRevenue: number;
    }>();

    dateFilteredInvoices.forEach((inv) => {
      const name = inv.cashierName?.trim() || 'Store Cashier';
      const existing = map.get(name) || {
        cashierName: name,
        orderCount: 0,
        totalRevenue: 0,
        cashRevenue: 0,
        upiRevenue: 0,
        cardRevenue: 0,
      };

      existing.orderCount += 1;
      existing.totalRevenue += inv.grandTotal;
      if (inv.paymentMethod === 'CASH') existing.cashRevenue += inv.grandTotal;
      else if (inv.paymentMethod === 'UPI') existing.upiRevenue += inv.grandTotal;
      else if (inv.paymentMethod === 'CARD') existing.cardRevenue += inv.grandTotal;

      map.set(name, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [dateFilteredInvoices]);

  // Payment method breakdown including individual UPI ID analytics
  const paymentBreakdown = useMemo(() => {
    let cashCount = 0;
    let cashRevenue = 0;
    let cardCount = 0;
    let cardRevenue = 0;

    const upiMap = new Map<string, {
      upiId: string;
      label: string;
      orderCount: number;
      totalRevenue: number;
    }>();

    const fallbackUpi = (settings.upiId || '').trim();
    const effectiveAccounts = getEffectiveUpiAccounts(settings);

    // Initialize all saved accounts so they appear in reconciliation even with 0 sales
    effectiveAccounts.forEach((acc) => {
      upiMap.set(acc.upiId.toLowerCase(), {
        upiId: acc.upiId,
        label: acc.label || (acc.isDefault ? 'Primary UPI' : acc.upiId.split('@')[0]),
        orderCount: 0,
        totalRevenue: 0,
      });
    });

    dateFilteredInvoices.forEach((inv) => {
      if (inv.paymentMethod === 'CASH') {
        cashCount += 1;
        cashRevenue += inv.grandTotal;
      } else if (inv.paymentMethod === 'CARD') {
        cardCount += 1;
        cardRevenue += inv.grandTotal;
      } else if (inv.paymentMethod === 'UPI') {
        const rawUpiId = (inv.selectedUpiId || fallbackUpi || 'Default UPI').trim();
        const key = rawUpiId.toLowerCase();
        const matchedAccount = effectiveAccounts.find(
          (a) => a.upiId.toLowerCase() === key
        );
        const label = matchedAccount?.label || (rawUpiId.toLowerCase() === fallbackUpi.toLowerCase() ? 'Primary UPI' : 'UPI Account');

        const existing = upiMap.get(key) || {
          upiId: rawUpiId,
          label: label,
          orderCount: 0,
          totalRevenue: 0,
        };

        existing.orderCount += 1;
        existing.totalRevenue += inv.grandTotal;
        upiMap.set(key, existing);
      }
    });

    const upiList = Array.from(upiMap.values()).sort((a, b) => {
      if (b.totalRevenue !== a.totalRevenue) return b.totalRevenue - a.totalRevenue;
      return b.orderCount - a.orderCount;
    });
    const totalUpiCount = upiList.reduce((acc, u) => acc + u.orderCount, 0);
    const totalUpiRevenue = upiList.reduce((acc, u) => acc + u.totalRevenue, 0);

    return {
      cash: { count: cashCount, revenue: cashRevenue },
      card: { count: cardCount, revenue: cardRevenue },
      upiTotal: { count: totalUpiCount, revenue: totalUpiRevenue },
      upiAccounts: upiList,
    };
  }, [dateFilteredInvoices, settings.upiId, settings.upiAccounts]);

  return (
    <ScrollView style={[styles.container, !isDark && styles.containerLight]} showsVerticalScrollIndicator={false}>
      {/* Title Header */}
      <Text style={[styles.sectionTitle, !isDark && { color: '#0f172a' }]}>📊 Sales & Revenue Analytics</Text>

      {/* Overall Lifetime KPIs */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, !isDark && styles.kpiCardLight]}>
          <Text style={[styles.kpiLabel, !isDark && { color: '#64748b' }]}>ALL-TIME REVENUE</Text>
          <Text style={styles.kpiRevenue}>{settings.currencySymbol}{overallSales.toFixed(2)}</Text>
          <Text style={[styles.kpiSub, !isDark && { color: '#64748b' }]}>{overallCount} Invoices Total</Text>
        </View>

        <View style={[styles.kpiCard, !isDark && styles.kpiCardLight]}>
          <Text style={[styles.kpiLabel, !isDark && { color: '#64748b' }]}>ALL-TIME TAX</Text>
          <Text style={styles.kpiTax}>{settings.currencySymbol}{overallTax.toFixed(2)}</Text>
          <Text style={[styles.kpiSub, !isDark && { color: '#64748b' }]}>GST / VAT Total</Text>
        </View>
      </View>

      {/* SECTION: Custom Date Selection & Period Sales Report */}
      <View style={[styles.dateFilterContainer, !isDark && styles.dateFilterContainerLight]}>
        <Text style={[styles.dateFilterTitle, !isDark && { color: '#4f46e5' }]}>📅 Custom Date Range Sales Report</Text>

        {/* Preset Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
          <TouchableOpacity
            style={[styles.presetPill, !isDark && styles.presetPillLight, activePreset === 'TODAY' && styles.presetPillActive]}
            onPress={() => handlePresetChange('TODAY')}
          >
            <Text style={[styles.presetText, !isDark && { color: '#475569' }, activePreset === 'TODAY' && styles.presetTextActive]}>Today</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetPill, !isDark && styles.presetPillLight, activePreset === 'YESTERDAY' && styles.presetPillActive]}
            onPress={() => handlePresetChange('YESTERDAY')}
          >
            <Text style={[styles.presetText, !isDark && { color: '#475569' }, activePreset === 'YESTERDAY' && styles.presetTextActive]}>Yesterday</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetPill, !isDark && styles.presetPillLight, activePreset === 'LAST7' && styles.presetPillActive]}
            onPress={() => handlePresetChange('LAST7')}
          >
            <Text style={[styles.presetText, !isDark && { color: '#475569' }, activePreset === 'LAST7' && styles.presetTextActive]}>Last 7 Days</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetPill, !isDark && styles.presetPillLight, activePreset === 'THIS_MONTH' && styles.presetPillActive]}
            onPress={() => handlePresetChange('THIS_MONTH')}
          >
            <Text style={[styles.presetText, !isDark && { color: '#475569' }, activePreset === 'THIS_MONTH' && styles.presetTextActive]}>This Month</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetPill, !isDark && styles.presetPillLight, activePreset === 'ALL' && styles.presetPillActive]}
            onPress={() => handlePresetChange('ALL')}
          >
            <Text style={[styles.presetText, !isDark && { color: '#475569' }, activePreset === 'ALL' && styles.presetTextActive]}>All Time</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Date Inputs Form */}
        <View style={[styles.dateInputsRow, !isDark && styles.dateInputsRowLight]}>
          <View style={styles.dateInputBox}>
            <Text style={[styles.dateInputLabel, !isDark && { color: '#334155' }]}>START DATE</Text>
            <TextInput
              style={[styles.dateInput, !isDark && styles.dateInputLight]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              value={startDate}
              onChangeText={(text) => handleCustomDateChange(text, endDate)}
            />
          </View>

          <View style={styles.dateInputBox}>
            <Text style={[styles.dateInputLabel, !isDark && { color: '#334155' }]}>END DATE</Text>
            <TextInput
              style={[styles.dateInput, !isDark && styles.dateInputLight]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              value={endDate}
              onChangeText={(text) => handleCustomDateChange(startDate, text)}
            />
          </View>

          <TouchableOpacity style={[styles.resetBtn, !isDark && styles.resetBtnLight]} onPress={clearDateFilter}>
            <Text style={[styles.resetBtnText, !isDark && { color: '#334155' }]}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Selected Period Sales Summary Cards */}
        <View style={[styles.periodSummaryCard, !isDark && styles.periodSummaryCardLight]}>
          <View style={[styles.periodHeaderRow, !isDark && { borderBottomColor: '#e2e8f0' }]}>
            <Text style={[styles.periodTitle, !isDark && { color: '#0f172a' }]}>
              Period Report ({startDate || 'Start'} to {endDate || 'End'})
            </Text>
            <Text style={styles.periodBadge}>{periodStats.count} Bills</Text>
          </View>

          <View style={styles.periodKpiGrid}>
            <View style={[styles.periodKpiBox, !isDark && styles.periodKpiBoxLight]}>
              <Text style={[styles.periodKpiLabel, !isDark && { color: '#64748b' }]}>PERIOD REVENUE</Text>
              <Text style={styles.periodRevenue}>{settings.currencySymbol}{periodStats.totalSales.toFixed(2)}</Text>
            </View>

            <View style={[styles.periodKpiBox, !isDark && styles.periodKpiBoxLight]}>
              <Text style={[styles.periodKpiLabel, !isDark && { color: '#64748b' }]}>AVG ORDER VALUE</Text>
              <Text style={styles.periodAov}>{settings.currencySymbol}{periodStats.avgOrderValue.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.periodKpiGrid}>
            <View style={[styles.periodKpiBox, !isDark && styles.periodKpiBoxLight]}>
              <Text style={[styles.periodKpiLabel, !isDark && { color: '#64748b' }]}>TAX & DISCOUNTS</Text>
              <Text style={styles.periodTaxText}>
                Tax: {settings.currencySymbol}{periodStats.totalTax.toFixed(2)}
              </Text>
              <Text style={styles.periodDiscText}>
                Disc: -{settings.currencySymbol}{periodStats.totalDiscount.toFixed(2)}
              </Text>
            </View>

            <View style={[styles.periodKpiBox, !isDark && styles.periodKpiBoxLight]}>
              <Text style={[styles.periodKpiLabel, !isDark && { color: '#64748b' }]}>CASH VS DIGITAL</Text>
              <Text style={styles.periodCashText}>
                Cash: {settings.currencySymbol}{periodStats.cash.toFixed(2)}
              </Text>
              <Text style={styles.periodDigitalText}>
                Digital: {settings.currencySymbol}{periodStats.digital.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* SECTION: Accounts & Payment Channels Analytics (User Request 4) */}
      <View style={[styles.accountsCard, !isDark && styles.accountsCardLight]}>
        <View style={styles.accountsHeader}>
          <Text style={[styles.accountsTitle, !isDark && { color: '#0f172a' }]}>👥 Accounts & Payment Breakdown</Text>
          <Text style={[styles.accountsSub, !isDark && { color: '#64748b' }]}>
            Staff cashier sales, cash in hand, and individual UPI receiver breakdown
          </Text>
        </View>

        {/* 1. Cashier Accounts Performance */}
        <View style={[styles.subCard, !isDark && styles.subCardLight]}>
          <View style={styles.subCardHeaderRow}>
            <Text style={[styles.subCardTitle, !isDark && { color: '#4f46e5' }]}>
              👤 SALES BY CASHIER ACCOUNT
            </Text>
            <Text style={[styles.subCardCountBadge, !isDark && { color: '#64748b' }]}>
              {accountStats.length} Account{accountStats.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {accountStats.length === 0 ? (
            <Text style={[styles.emptySectionText, !isDark && { color: '#64748b' }]}>
              No account sales recorded in this period.
            </Text>
          ) : (
            accountStats.map((acc, idx) => {
              const pct = periodStats.totalSales > 0 ? (acc.totalRevenue / periodStats.totalSales) * 100 : 0;
              return (
                <View key={acc.cashierName + idx} style={[styles.accountRowItem, !isDark && styles.accountRowItemLight]}>
                  <View style={styles.accountTopLine}>
                    <View style={styles.accountNameBox}>
                      <View style={styles.accountAvatar}>
                        <Text style={styles.accountAvatarText}>{acc.cashierName.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View>
                        <Text style={[styles.accountNameText, !isDark && { color: '#0f172a' }]}>{acc.cashierName}</Text>
                        <Text style={[styles.accountSalesCount, !isDark && { color: '#64748b' }]}>
                          {acc.orderCount} sales ({pct.toFixed(1)}% of total)
                        </Text>
                      </View>
                    </View>
                    <View style={styles.accountRevenueBox}>
                      <Text style={styles.accountRevenueVal}>{settings.currencySymbol}{acc.totalRevenue.toFixed(2)}</Text>
                      <Text style={[styles.accountAvgText, !isDark && { color: '#64748b' }]}>
                        Avg: {settings.currencySymbol}{(acc.orderCount > 0 ? acc.totalRevenue / acc.orderCount : 0).toFixed(0)}
                      </Text>
                    </View>
                  </View>

                  {/* Cash & UPI sub-totals */}
                  <View style={[styles.accountChannelsRow, !isDark && { borderTopColor: '#e2e8f0' }]}>
                    <Text style={styles.accountCashSub}>💵 Cash: {settings.currencySymbol}{acc.cashRevenue.toFixed(0)}</Text>
                    <Text style={styles.accountUpiSub}>📱 UPI: {settings.currencySymbol}{acc.upiRevenue.toFixed(0)}</Text>
                    {acc.cardRevenue > 0 && (
                      <Text style={styles.accountCardSub}>💳 Card: {settings.currencySymbol}{acc.cardRevenue.toFixed(0)}</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* 2. Cash & Individual UPI IDs Breakdown */}
        <View style={[styles.subCard, !isDark && styles.subCardLight]}>
          <View style={styles.subCardHeaderRow}>
            <Text style={[styles.subCardTitle, !isDark && { color: '#059669' }]}>
              💰 CASH & UPI ID RECONCILIATION
            </Text>
            <Text style={[styles.subCardCountBadge, !isDark && { color: '#64748b' }]}>
              {paymentBreakdown.cash.count + paymentBreakdown.upiTotal.count + paymentBreakdown.card.count} txns
            </Text>
          </View>

          {/* Cash Summary Banner */}
          <View style={[styles.cashSummaryBanner, !isDark && styles.cashSummaryBannerLight]}>
            <View>
              <Text style={styles.cashBannerTitle}>💵 Cash in Hand Payments</Text>
              <Text style={[styles.cashBannerSub, !isDark && { color: '#64748b' }]}>
                {paymentBreakdown.cash.count} cash transaction{paymentBreakdown.cash.count !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.cashBannerRevenue}>{settings.currencySymbol}{paymentBreakdown.cash.revenue.toFixed(2)}</Text>
              <Text style={[styles.cashBannerPct, !isDark && { color: '#64748b' }]}>
                {periodStats.totalSales > 0 ? `${((paymentBreakdown.cash.revenue / periodStats.totalSales) * 100).toFixed(1)}% of total` : '0%'}
              </Text>
            </View>
          </View>

          {/* UPI Breakdown Header */}
          <View style={styles.upiHeaderRow}>
            <Text style={[styles.upiSectionHeading, !isDark && { color: '#475569' }]}>
              📱 UPI TRANSACTIONS PER UPI ID
            </Text>
            <Text style={styles.upiTotalBadge}>
              Total: {settings.currencySymbol}{paymentBreakdown.upiTotal.revenue.toFixed(2)} ({paymentBreakdown.upiTotal.count})
            </Text>
          </View>

          {paymentBreakdown.upiAccounts.length === 0 ? (
            <Text style={[styles.emptySectionText, !isDark && { color: '#64748b' }]}>
              No UPI transactions recorded in this period.
            </Text>
          ) : (
            paymentBreakdown.upiAccounts.map((upiAcc, idx) => {
              const upiPct = paymentBreakdown.upiTotal.revenue > 0
                ? (upiAcc.totalRevenue / paymentBreakdown.upiTotal.revenue) * 100
                : 0;
              return (
                <View key={upiAcc.upiId + idx} style={[styles.upiItemCard, !isDark && styles.upiItemCardLight]}>
                  <View style={styles.upiItemTop}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.upiItemLabel, !isDark && { color: '#0f172a' }]} numberOfLines={1}>
                        {upiAcc.label}
                      </Text>
                      <Text style={styles.upiItemIdText} numberOfLines={1}>{upiAcc.upiId}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.upiItemRevenue}>{settings.currencySymbol}{upiAcc.totalRevenue.toFixed(2)}</Text>
                      <Text style={[styles.upiItemCountText, !isDark && { color: '#64748b' }]}>
                        {upiAcc.orderCount} txn{upiAcc.orderCount !== 1 ? 's' : ''} ({upiPct.toFixed(0)}%)
                      </Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={[styles.upiProgressBarBg, !isDark && { backgroundColor: '#e2e8f0' }]}>
                    <View
                      style={[
                        styles.upiProgressBarFill,
                        { width: `${Math.min(100, Math.max(8, upiPct))}%` },
                      ]}
                    />
                  </View>
                </View>
              );
            })
          )}

          {/* Card / POS (if any) */}
          {paymentBreakdown.card.count > 0 && (
            <View style={[styles.cardPosBanner, !isDark && styles.cardPosBannerLight]}>
              <View>
                <Text style={styles.cardPosTitle}>💳 Card / POS Terminal</Text>
                <Text style={[styles.cardPosSub, !isDark && { color: '#64748b' }]}>
                  {paymentBreakdown.card.count} transaction{paymentBreakdown.card.count !== 1 ? 's' : ''}
                </Text>
              </View>
              <Text style={styles.cardPosRevenue}>{settings.currencySymbol}{paymentBreakdown.card.revenue.toFixed(2)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* NEW SECTION: Most Sold Items Report */}
      <View style={[styles.topItemsCard, !isDark && styles.topItemsCardLight]}>
        <View style={styles.topItemsHeader}>
          <View style={styles.topItemsTitleGroup}>
            <Text style={[styles.topItemsTitle, !isDark && { color: '#0f172a' }]}>🔥 Most Sold Items Report</Text>
            <Text style={[styles.topItemsSub, !isDark && { color: '#64748b' }]}>Best sellers ranked by volume & revenue</Text>
          </View>
        </View>

        {/* Scope and Sort Filter Pills */}
        <View style={styles.filterControlsRow}>
          <View style={[styles.pillGroup, !isDark && { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}>
            <TouchableOpacity
              style={[styles.smallPill, !isDark && styles.smallPillLight, topItemsScope === 'PERIOD' && styles.smallPillActive]}
              onPress={() => setTopItemsScope('PERIOD')}
            >
              <Text style={[styles.smallPillText, !isDark && { color: '#475569' }, topItemsScope === 'PERIOD' && styles.smallPillTextActive]}>
                Period
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallPill, !isDark && styles.smallPillLight, topItemsScope === 'ALL' && styles.smallPillActive]}
              onPress={() => setTopItemsScope('ALL')}
            >
              <Text style={[styles.smallPillText, !isDark && { color: '#475569' }, topItemsScope === 'ALL' && styles.smallPillTextActive]}>
                All-Time
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.pillGroup, !isDark && { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}>
            <TouchableOpacity
              style={[styles.smallPill, !isDark && styles.smallPillLight, topItemsSortBy === 'QTY' && styles.smallPillActive]}
              onPress={() => setTopItemsSortBy('QTY')}
            >
              <Text style={[styles.smallPillText, !isDark && { color: '#475569' }, topItemsSortBy === 'QTY' && styles.smallPillTextActive]}>
                By Qty
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallPill, !isDark && styles.smallPillLight, topItemsSortBy === 'REVENUE' && styles.smallPillActive]}
              onPress={() => setTopItemsSortBy('REVENUE')}
            >
              <Text style={[styles.smallPillText, !isDark && { color: '#475569' }, topItemsSortBy === 'REVENUE' && styles.smallPillTextActive]}>
                By Revenue
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search input for sold item */}
        <TextInput
          style={[styles.topItemSearchInput, !isDark && styles.topItemSearchInputLight]}
          placeholder="Search sold product..."
          placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
          value={topItemSearch}
          onChangeText={setTopItemSearch}
        />

        {/* Top 3 Best Seller Podium */}
        {topSoldProducts.length >= 3 && !topItemSearch && (
          <View style={styles.podiumContainer}>
            <View style={[styles.podiumCardTop, !isDark && styles.podiumCardTopLight]}>
              <Text style={styles.podiumBadge}>🥇 #1 Top Seller</Text>
              <Text style={[styles.podiumName, !isDark && { color: '#0f172a' }]} numberOfLines={1}>{topSoldProducts[0].name}</Text>
              <View style={styles.podiumStatRow}>
                <Text style={styles.podiumQtyText}>{topSoldProducts[0].totalQty} sold</Text>
                <Text style={styles.podiumRevenueText}>{settings.currencySymbol}{topSoldProducts[0].totalRevenue.toFixed(0)}</Text>
              </View>
            </View>

            <View style={styles.podiumRow}>
              <View style={[styles.podiumCard, !isDark && styles.podiumCardLight]}>
                <Text style={styles.podiumBadgeSub}>🥈 #2 Seller</Text>
                <Text style={[styles.podiumNameSub, !isDark && { color: '#0f172a' }]} numberOfLines={1}>{topSoldProducts[1].name}</Text>
                <Text style={[styles.podiumQtySub, !isDark && { color: '#475569' }]}>{topSoldProducts[1].totalQty} sold</Text>
              </View>

              <View style={[styles.podiumCard, !isDark && styles.podiumCardLight]}>
                <Text style={styles.podiumBadgeSub}>🥉 #3 Seller</Text>
                <Text style={[styles.podiumNameSub, !isDark && { color: '#0f172a' }]} numberOfLines={1}>{topSoldProducts[2].name}</Text>
                <Text style={[styles.podiumQtySub, !isDark && { color: '#475569' }]}>{topSoldProducts[2].totalQty} sold</Text>
              </View>
            </View>
          </View>
        )}

        {/* Ranked Items List */}
        <View style={styles.rankedList}>
          {topSoldProducts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyText, !isDark && { color: '#64748b' }]}>No product sales recorded in this period</Text>
            </View>
          ) : (
            topSoldProducts.map((item, idx) => {
              const percent = Math.round((item.totalQty / maxSoldQty) * 100);
              return (
                <View key={item.id + idx} style={[styles.rankedItemCard, !isDark && styles.rankedItemCardLight]}>
                  <View style={styles.rankLeftGroup}>
                    <View style={[
                      styles.rankNumberBadge,
                      idx === 0 ? styles.rank1 : idx === 1 ? styles.rank2 : idx === 2 ? styles.rank3 : null
                    ]}>
                      <Text style={styles.rankNumberText}>#{idx + 1}</Text>
                    </View>
                    <View style={styles.rankItemInfo}>
                      <Text style={[styles.rankItemName, !isDark && { color: '#0f172a' }]} numberOfLines={1}>{item.name}</Text>
                      <Text style={[styles.rankItemSub, !isDark && { color: '#64748b' }]}>
                        Barcode: {item.barcode} • {item.orderCount} bill{item.orderCount > 1 ? 's' : ''}
                      </Text>
                      {/* Visual progress bar */}
                      <View style={[styles.progressBarTrack, !isDark && { backgroundColor: '#e2e8f0' }]}>
                        <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                      </View>
                    </View>
                  </View>

                  <View style={styles.rankRightGroup}>
                    <Text style={styles.rankQtyText}>{item.totalQty} units</Text>
                    <Text style={styles.rankRevenueText}>
                      {settings.currencySymbol}{item.totalRevenue.toFixed(2)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>

      {/* Transactions List */}
      <View style={[styles.logsBox, !isDark && styles.logsBoxLight]}>
        <View style={styles.logsHeader}>
          <Text style={[styles.logsTitle, !isDark && { color: '#0f172a' }]}>
            Filtered Invoices ({searchFilteredInvoices.length})
          </Text>
          <TextInput
            style={[styles.searchInput, !isDark && styles.searchInputLight]}
            placeholder="Search invoice #..."
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.logsList}>
          {searchFilteredInvoices.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyText, !isDark && { color: '#64748b' }]}>No invoices found in this date range</Text>
            </View>
          ) : (
            searchFilteredInvoices.map((inv) => (
              <View key={inv.id} style={[styles.logCard, !isDark && styles.logCardLight]}>
                <View style={styles.logMain}>
                  <View style={styles.logMetaRow}>
                    <Text style={[styles.invId, !isDark && { color: '#0f172a' }]}>{inv.id}</Text>
                    <Text style={[styles.payBadge, !isDark && { backgroundColor: '#e2e8f0', color: '#334155' }]}>{inv.paymentMethod}</Text>
                    {inv.includeTax === false && (
                      <Text style={styles.taxFreeBadge}>0% Free</Text>
                    )}
                    {inv.discountTotal > 0 && (
                      <Text style={styles.discBadge}>-{settings.currencySymbol}{inv.discountTotal.toFixed(0)}</Text>
                    )}
                    <Text style={[styles.timeText, !isDark && { color: '#64748b' }]}>
                      {new Date(inv.timestamp).toLocaleDateString()} {new Date(inv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={[styles.logItemsText, !isDark && { color: '#64748b' }]}>
                    {inv.items.length} items • {inv.customerName || 'Walk-in Customer'}
                  </Text>
                </View>

                <View style={styles.logActionRow}>
                  <Text style={styles.invAmount}>{settings.currencySymbol}{inv.grandTotal.toFixed(2)}</Text>
                  <TouchableOpacity style={styles.viewBtn} onPress={() => onViewInvoice(inv)}>
                    <Text style={styles.viewBtnText}>View Slip</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  kpiGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#020617',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginHorizontal: 3,
  },
  kpiLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  kpiRevenue: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: 'bold',
  },
  kpiTax: {
    color: '#818cf8',
    fontSize: 16,
    fontWeight: 'bold',
  },
  kpiSub: {
    color: '#94a3b8',
    fontSize: 9,
    marginTop: 2,
  },
  dateFilterContainer: {
    backgroundColor: '#020617',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 12,
  },
  dateFilterTitle: {
    color: '#818cf8',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  presetScroll: {
    marginBottom: 10,
  },
  presetPill: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginRight: 6,
  },
  presetPillActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#6366f1',
  },
  presetText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  presetTextActive: {
    color: '#ffffff',
  },
  dateInputsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    padding: 8,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  dateInputBox: {
    flex: 1,
    marginRight: 6,
  },
  dateInputLabel: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  dateInput: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontFamily: 'monospace',
  },
  resetBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  periodSummaryCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    padding: 10,
  },
  periodHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 4,
  },
  periodTitle: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: 'bold',
    flex: 1,
  },
  periodBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  periodKpiGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  periodKpiBox: {
    flex: 1,
    backgroundColor: '#020617',
    padding: 8,
    borderRadius: 8,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  periodKpiLabel: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  periodRevenue: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: 'bold',
  },
  periodAov: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  periodTaxText: {
    color: '#818cf8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  periodDiscText: {
    color: '#f97316',
    fontSize: 10,
    fontWeight: 'bold',
  },
  periodCashText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: 'bold',
  },
  periodDigitalText: {
    color: '#c084fc',
    fontSize: 10,
    fontWeight: 'bold',
  },
  topItemsCard: {
    backgroundColor: '#020617',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    padding: 12,
    marginBottom: 12,
  },
  topItemsHeader: {
    marginBottom: 8,
  },
  topItemsTitleGroup: {
    marginBottom: 2,
  },
  topItemsTitle: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: 'bold',
  },
  topItemsSub: {
    color: '#94a3b8',
    fontSize: 10,
  },
  filterControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pillGroup: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  smallPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  smallPillActive: {
    backgroundColor: '#f59e0b',
  },
  smallPillText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  smallPillTextActive: {
    color: '#020617',
  },
  topItemSearchInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    color: '#ffffff',
    fontSize: 11,
    marginBottom: 10,
  },
  podiumContainer: {
    marginBottom: 10,
  },
  podiumCardTop: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    padding: 10,
    marginBottom: 6,
  },
  podiumBadge: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  podiumName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  podiumStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  podiumQtyText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: 'bold',
  },
  podiumRevenueText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: 'bold',
  },
  podiumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  podiumCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  podiumBadgeSub: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  podiumNameSub: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  podiumQtySub: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: 'bold',
  },
  rankedList: {
    maxHeight: 280,
  },
  rankedItemCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rankLeftGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  rankNumberBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  rank1: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  rank2: {
    borderColor: '#94a3b8',
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  rank3: {
    borderColor: '#f97316',
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
  },
  rankNumberText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  rankItemInfo: {
    flex: 1,
  },
  rankItemName: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  rankItemSub: {
    color: '#94a3b8',
    fontSize: 9,
    marginTop: 1,
  },
  progressBarTrack: {
    height: 3,
    backgroundColor: '#020617',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 2,
  },
  rankRightGroup: {
    alignItems: 'flex-end',
  },
  rankQtyText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  rankRevenueText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: 'bold',
  },
  logsBox: {
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 10,
    marginTop: 4,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logsTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: '#ffffff',
    fontSize: 11,
    width: 120,
  },
  logsList: {
    maxHeight: 280,
  },
  emptyBox: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 11,
  },
  logCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logMain: {
    flex: 1,
  },
  logMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  invId: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginRight: 4,
  },
  payBadge: {
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 4,
  },
  taxFreeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#34d399',
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 4,
  },
  discBadge: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    color: '#fb7185',
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 4,
  },
  timeText: {
    color: '#64748b',
    fontSize: 9,
  },
  logItemsText: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
  },
  logActionRow: {
    alignItems: 'flex-end',
  },
  invAmount: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  viewBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  viewBtnText: {
    color: '#818cf8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  /* Accounts and Payment Breakdown Section Styles */
  accountsCard: {
    backgroundColor: '#020617',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  accountsCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  accountsHeader: {
    marginBottom: 10,
  },
  accountsTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  accountsSub: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
  },
  subCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  subCardLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  subCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subCardTitle: {
    color: '#818cf8',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  subCardCountBadge: {
    color: '#94a3b8',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  emptySectionText: {
    color: '#64748b',
    fontSize: 10,
    textAlign: 'center',
    paddingVertical: 8,
  },
  accountRowItem: {
    backgroundColor: '#020617',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  accountRowItemLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  accountTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountNameBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#312e81',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  accountAvatarText: {
    color: '#c7d2fe',
    fontSize: 11,
    fontWeight: 'bold',
  },
  accountNameText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  accountSalesCount: {
    color: '#94a3b8',
    fontSize: 9,
    marginTop: 1,
  },
  accountRevenueBox: {
    alignItems: 'flex-end',
  },
  accountRevenueVal: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  accountAvgText: {
    color: '#64748b',
    fontSize: 9,
  },
  accountChannelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    gap: 8,
  },
  accountCashSub: {
    color: '#f59e0b',
    fontSize: 9,
    fontFamily: 'monospace',
  },
  accountUpiSub: {
    color: '#a78bfa',
    fontSize: 9,
    fontFamily: 'monospace',
  },
  accountCardSub: {
    color: '#60a5fa',
    fontSize: 9,
    fontFamily: 'monospace',
  },
  cashSummaryBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cashSummaryBannerLight: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  cashBannerTitle: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cashBannerSub: {
    color: '#94a3b8',
    fontSize: 9,
    marginTop: 1,
  },
  cashBannerRevenue: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  cashBannerPct: {
    color: '#64748b',
    fontSize: 9,
  },
  upiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  upiSectionHeading: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  upiTotalBadge: {
    color: '#c084fc',
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  upiItemCard: {
    backgroundColor: '#020617',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  upiItemCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  upiItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  upiItemLabel: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  upiItemIdText: {
    color: '#a78bfa',
    fontSize: 9,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  upiItemRevenue: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  upiItemCountText: {
    color: '#64748b',
    fontSize: 9,
  },
  upiProgressBarBg: {
    height: 4,
    backgroundColor: '#1e293b',
    borderRadius: 2,
    overflow: 'hidden',
  },
  upiProgressBarFill: {
    height: '100%',
    backgroundColor: '#8b5cf6',
    borderRadius: 2,
  },
  cardPosBanner: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  cardPosBannerLight: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  cardPosTitle: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardPosSub: {
    color: '#94a3b8',
    fontSize: 9,
    marginTop: 1,
  },
  cardPosRevenue: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  containerLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  kpiCardLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  dateFilterContainerLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  presetPillLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  dateInputsRowLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  dateInputLight: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    color: '#0f172a',
  },
  resetBtnLight: {
    backgroundColor: '#e2e8f0',
  },
  periodSummaryCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  periodKpiBoxLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  topItemsCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
  },
  smallPillLight: {
    backgroundColor: '#ffffff',
  },
  topItemSearchInputLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    color: '#0f172a',
  },
  podiumCardTopLight: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
  },
  podiumCardLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  rankedItemCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  logsBoxLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  searchInputLight: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    color: '#0f172a',
  },
  logCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
});
