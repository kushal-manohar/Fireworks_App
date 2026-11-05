import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Linking,
  Alert
} from 'react-native';
import QRCodeSvg from 'react-native-qrcode-svg';
import { CartItem, PaymentMethod, Invoice, StoreSettings, DiscountType, ThemeMode } from '../types';
import { getNextInvoiceNumber } from '../services/dbService';
import { validateUpiId, buildUpiPaymentUrl, getEffectiveUpiAccounts } from '../utils/upi';

interface CheckoutModalProps {
  cart: CartItem[];
  includeTax: boolean;
  overallDiscountType?: DiscountType;
  overallDiscountValue?: number;
  overallDiscountAmount?: number;
  overallDiscountPercent?: number;
  onClose: () => void;
  onCompleteCheckout: (invoice: Invoice) => void;
  settings: StoreSettings;
  cashierName: string;
  theme?: ThemeMode;
}

export const CheckoutModalNative: React.FC<CheckoutModalProps> = ({
  cart,
  includeTax,
  overallDiscountType = 'PERCENT',
  overallDiscountValue = 0,
  overallDiscountAmount,
  overallDiscountPercent = 0,
  onClose,
  onCompleteCheckout,
  settings,
  cashierName,
  theme = 'dark',
}) => {
  const isDark = theme !== 'light';
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [isStaticQr, setIsStaticQr] = useState<boolean>(false);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  // Line items and tax calculations
  const itemsBreakdown = useMemo(() => {
    return cart.map((item) => {
      const lineBase = item.product.price * item.quantity;
      const lineDiscAmount = item.discountType === 'FLAT'
        ? Math.min(item.discountValue || 0, lineBase)
        : (lineBase * (item.discountPercent || item.discountValue || 0)) / 100;
      const lineDiscPercent = lineBase > 0 ? (lineDiscAmount / lineBase) * 100 : 0;
      const lineSub = Math.max(0, lineBase - lineDiscAmount);
      const effectiveTaxRate = includeTax ? (item.product.taxRate ?? 0) : 0;
      const lineTax = includeTax ? (lineSub * (effectiveTaxRate / 100)) : 0;
      return {
        ...item,
        lineBase,
        lineDiscAmount,
        lineDiscPercent,
        lineSub,
        effectiveTaxRate,
        lineTax,
        lineTotal: lineSub + lineTax,
      };
    });
  }, [cart, includeTax]);

  const rawSubtotal = itemsBreakdown.reduce((acc, i) => acc + i.lineSub, 0);
  const totalTax = includeTax ? itemsBreakdown.reduce((acc, i) => acc + i.lineTax, 0) : 0;

  const resolvedDiscountType: DiscountType = overallDiscountType || 'PERCENT';
  const resolvedDiscountValue = overallDiscountValue !== undefined 
    ? overallDiscountValue 
    : (overallDiscountPercent || 0);

  const calcOverallDiscountAmount = overallDiscountAmount !== undefined
    ? overallDiscountAmount
    : resolvedDiscountType === 'FLAT'
      ? Math.min(resolvedDiscountValue, rawSubtotal)
      : (rawSubtotal * resolvedDiscountValue) / 100;

  const grandTotal = Math.max(0, rawSubtotal + totalTax - calcOverallDiscountAmount);

  const tenderedVal = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, tenderedVal - grandTotal);

  // Quick Cash suggestions (exact amount, nearest 50, 100, 500)
  const quickCashOptions = [
    Math.ceil(grandTotal),
    Math.ceil(grandTotal / 50) * 50 || 50,
    Math.ceil(grandTotal / 100) * 100 || 100,
    Math.ceil(grandTotal / 500) * 500 || 500,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= grandTotal);

  // Multiple UPI Accounts selection
  const upiAccounts = useMemo(() => getEffectiveUpiAccounts(settings), [settings]);
  const [activeUpiId, setActiveUpiId] = useState<string>(() => {
    const def = upiAccounts.find((a) => a.isDefault);
    return def ? def.upiId : (settings.upiId || '');
  });

  const effectiveUpiId = activeUpiId || settings.upiId;

  // UPI Validation and URL Construction
  const upiValidation = useMemo(() => validateUpiId(effectiveUpiId), [effectiveUpiId]);

  const upiPayUrl = useMemo(() => {
    return buildUpiPaymentUrl({
      upiId: effectiveUpiId,
      storeName: settings.storeName,
      amount: grandTotal,
      note: 'Store Bill Payment',
      isStatic: isStaticQr,
    });
  }, [effectiveUpiId, settings.storeName, grandTotal, isStaticQr]);

  const handleOpenUpiApp = async () => {
    try {
      const canOpen = await Linking.canOpenURL(upiPayUrl);
      if (canOpen) {
        await Linking.openURL(upiPayUrl);
      } else {
        await Linking.openURL(upiPayUrl).catch(() => {
          Alert.alert('UPI App', 'No supported UPI application found on this phone.');
        });
      }
    } catch (e: any) {
      Alert.alert('UPI Intent Error', e?.message || 'Could not launch UPI application.');
    }
  };

  const handleFinishCheckout = async () => {
    if (paymentMethod === 'CASH' && tenderedVal < grandTotal) {
      Alert.alert('Payment Error', `Cash tendered (${settings.currencySymbol}${tenderedVal}) is less than total amount (${settings.currencySymbol}${grandTotal.toFixed(2)})`);
      return;
    }

    const invoiceId = await getNextInvoiceNumber();
    const newInvoice: Invoice = {
      id: invoiceId,
      timestamp: new Date().toISOString(),
      cashierName: cashierName || 'Store Cashier',
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      includeTax: includeTax,
      overallDiscountType: resolvedDiscountType,
      overallDiscountValue: resolvedDiscountValue,
      items: itemsBreakdown.map(i => ({
        productId: i.product.id,
        barcode: i.product.barcode,
        name: i.product.name,
        unitPrice: i.product.price,
        taxRate: i.effectiveTaxRate,
        quantity: i.quantity,
        discountType: i.discountType || 'PERCENT',
        discountValue: i.discountValue !== undefined ? i.discountValue : i.discountPercent,
        lineDiscount: i.lineDiscPercent,
        lineSubtotal: i.lineSub,
        lineTax: i.lineTax,
        lineTotal: i.lineTotal,
      })),
      subtotal: rawSubtotal,
      taxTotal: totalTax,
      discountTotal: calcOverallDiscountAmount,
      grandTotal: grandTotal,
      paymentMethod: paymentMethod,
      selectedUpiId: paymentMethod === 'UPI' ? effectiveUpiId : undefined,
      cashTendered: paymentMethod === 'CASH' ? tenderedVal : undefined,
      changeDue: paymentMethod === 'CASH' ? changeDue : undefined,
      syncStatus: 'LOCAL',
    };

    onCompleteCheckout(newInvoice);
  };

  return (
    <Modal visible animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={[styles.modalContent, !isDark && styles.modalContentLight]}>
          {/* Header */}
          <View style={[styles.modalHeader, !isDark && styles.modalHeaderLight]}>
            <Text style={[styles.modalTitle, !isDark && { color: '#0f172a' }]}>Checkout & Payment</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeBtn, !isDark && { color: '#64748b' }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            {/* Customer Inputs */}
            <View style={styles.inputGroup}>
              <TextInput
                style={[styles.input, !isDark && styles.inputLight]}
                placeholder="Customer Name (Optional)"
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                value={customerName}
                onChangeText={setCustomerName}
              />
              <TextInput
                style={[styles.input, !isDark && styles.inputLight]}
                placeholder="Customer Phone (WhatsApp)"
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                keyboardType="phone-pad"
              />
            </View>

            {/* Payment Method selector */}
            <Text style={[styles.sectionLabel, !isDark && { color: '#334155' }]}>Select Payment Method:</Text>
            <View style={styles.methodRow}>
              <TouchableOpacity
                style={[styles.methodBtn, !isDark && styles.methodBtnLight, paymentMethod === 'CASH' && styles.methodBtnActive]}
                onPress={() => setPaymentMethod('CASH')}
              >
                <Text style={[styles.methodText, !isDark && paymentMethod !== 'CASH' && { color: '#475569' }, paymentMethod === 'CASH' && styles.methodTextActive]}>💵 Cash</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.methodBtn, !isDark && styles.methodBtnLight, paymentMethod === 'UPI' && styles.methodBtnActive]}
                onPress={() => setPaymentMethod('UPI')}
              >
                <Text style={[styles.methodText, !isDark && paymentMethod !== 'UPI' && { color: '#475569' }, paymentMethod === 'UPI' && styles.methodTextActive]}>📱 UPI / QR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.methodBtn, !isDark && styles.methodBtnLight, paymentMethod === 'CARD' && styles.methodBtnActive]}
                onPress={() => setPaymentMethod('CARD')}
              >
                <Text style={[styles.methodText, !isDark && paymentMethod !== 'CARD' && { color: '#475569' }, paymentMethod === 'CARD' && styles.methodTextActive]}>💳 Card / POS</Text>
              </TouchableOpacity>
            </View>

            {/* Cash Calculator with Tendered Suggestions */}
            {paymentMethod === 'CASH' && (
              <View style={[styles.cashBox, !isDark && styles.cashBoxLight]}>
                <Text style={[styles.cashLabel, !isDark && { color: '#334155' }]}>Enter Cash Received from Customer:</Text>
                <TextInput
                  style={[styles.cashInput, !isDark && styles.cashInputLight]}
                  placeholder={grandTotal.toFixed(0)}
                  placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                  value={cashTendered}
                  onChangeText={setCashTendered}
                  keyboardType="numeric"
                />

                {/* Quick Cash Tender Suggestions Chips */}
                <Text style={[styles.chipLabel, !isDark && { color: '#64748b' }]}>Quick Cash Suggestions:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {quickCashOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.cashChip, !isDark && styles.cashChipLight]}
                      onPress={() => setCashTendered(opt.toString())}
                    >
                      <Text style={[styles.cashChipText, !isDark && { color: '#047857' }]}>{settings.currencySymbol}{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Change Returned Display */}
                <View style={styles.changeBox}>
                  <Text style={styles.changeLabel}>CHANGE DUE TO CUSTOMER:</Text>
                  <Text style={styles.changeValue}>{settings.currencySymbol}{changeDue.toFixed(2)}</Text>
                </View>
              </View>
            )}

            {/* UPI QR */}
            {paymentMethod === 'UPI' && (
              <View style={[styles.upiBox, !isDark && styles.upiBoxLight]}>
                {/* Select UPI Receiver Account */}
                {upiAccounts.length > 0 && (
                  <View style={[styles.upiSelectorCard, !isDark && styles.upiSelectorCardLight]}>
                    <Text style={[styles.upiSelectorTitle, !isDark && { color: '#475569' }]}>
                      RECEIVING UPI ACCOUNT (TAP TO SWITCH):
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.upiScrollRow}>
                      {upiAccounts.map((acc) => {
                        const isSelected = effectiveUpiId === acc.upiId;
                        return (
                          <TouchableOpacity
                            key={acc.id}
                            style={[
                              styles.upiPill,
                              !isDark && styles.upiPillLight,
                              isSelected && styles.upiPillActive,
                            ]}
                            onPress={() => setActiveUpiId(acc.upiId)}
                          >
                            <Text
                              style={[
                                styles.upiPillLabel,
                                !isDark && { color: '#334155' },
                                isSelected && styles.upiPillLabelActive,
                              ]}
                            >
                              {acc.label} {isSelected ? '✓' : ''}
                            </Text>
                            <Text
                              style={[
                                styles.upiPillId,
                                !isDark && { color: '#64748b' },
                                isSelected && styles.upiPillIdActive,
                              ]}
                            >
                              {acc.upiId}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {!upiValidation.isValid ? (
                  <View style={styles.upiWarnBox}>
                    <Text style={styles.upiWarnTitle}>⚠️ Invalid UPI ID Configuration</Text>
                    <Text style={styles.upiWarnText}>
                      "{effectiveUpiId || 'empty'}" is not a valid UPI ID.
                      UPI IDs must include an @ and bank handle (e.g. 9876543210@paytm, store@okhdfcbank).
                      Please update it in Settings.
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.upiScanHint}>Scan with PhonePe / Google Pay / Paytm / BHIM</Text>
                )}

                {/* QR Display */}
                <View style={styles.qrContainer}>
                  {upiValidation.isValid ? (
                    <QRCodeSvg
                      value={upiPayUrl || 'upi://pay'}
                      size={170}
                      color="#000000"
                      backgroundColor="#ffffff"
                    />
                  ) : (
                    <View style={styles.qrLoadingBox}>
                      <Text style={styles.qrLoadingText}>Configure UPI ID in Settings</Text>
                    </View>
                  )}
                </View>

                {/* Fixed vs Open Amount Toggle */}
                <View style={styles.modeToggleRow}>
                  <TouchableOpacity
                    style={[styles.modeToggleBtn, !isDark && { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }, !isStaticQr && styles.modeToggleBtnActive]}
                    onPress={() => setIsStaticQr(false)}
                  >
                    <Text style={[styles.modeToggleText, !isDark && isStaticQr && { color: '#64748b' }, !isStaticQr && styles.modeToggleTextActive]}>
                      ⚡ Fixed {settings.currencySymbol}{grandTotal.toFixed(2)}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modeToggleBtn, !isDark && { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }, isStaticQr && styles.modeToggleBtnActive]}
                    onPress={() => setIsStaticQr(true)}
                  >
                    <Text style={[styles.modeToggleText, !isDark && !isStaticQr && { color: '#64748b' }, isStaticQr && styles.modeToggleTextActive]}>
                      Open Amount QR
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Payee Info Box */}
                <View style={[styles.vpaDetailsBox, !isDark && styles.vpaDetailsBoxLight]}>
                  <View style={styles.vpaRow}>
                    <Text style={[styles.vpaLabel, !isDark && { color: '#64748b' }]}>Payee VPA:</Text>
                    <Text style={[styles.vpaValue, !isDark && { color: '#0f172a' }]}>{upiValidation.cleaned || effectiveUpiId}</Text>
                  </View>
                  <View style={styles.vpaRow}>
                    <Text style={[styles.vpaLabel, !isDark && { color: '#64748b' }]}>Amount Payable:</Text>
                    <Text style={styles.vpaAmountText}>{settings.currencySymbol}{grandTotal.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Direct Pay via Installed App Button */}
                <TouchableOpacity style={styles.openAppBtn} onPress={handleOpenUpiApp}>
                  <Text style={styles.openAppBtnText}>⚡ Pay via Installed UPI App (GPay/PhonePe)</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Card Confirmation */}
            {paymentMethod === 'CARD' && (
              <View style={[styles.cardPosBox, !isDark && { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' }]}>
                <Text style={styles.cardPosTitle}>💳 External POS Terminal</Text>
                <Text style={[styles.cardPosSub, !isDark && { color: '#64748b' }]}>Swipe/dip card for {settings.currencySymbol}{grandTotal.toFixed(2)} and tap complete.</Text>
              </View>
            )}

            {/* Bill Summary Breakdown */}
            <View style={[styles.summaryBreakdown, !isDark && styles.summaryBreakdownLight]}>
              <View style={styles.summaryBreakdownRow}>
                <Text style={[styles.summaryBreakdownLabel, !isDark && { color: '#64748b' }]}>Items Subtotal:</Text>
                <Text style={[styles.summaryBreakdownVal, !isDark && { color: '#0f172a' }]}>{settings.currencySymbol}{rawSubtotal.toFixed(2)}</Text>
              </View>

              <View style={styles.summaryBreakdownRow}>
                <Text style={[styles.summaryBreakdownLabel, !isDark && { color: '#64748b' }]}>
                  Tax (GST): {includeTax ? '' : '(0% Tax Free)'}
                </Text>
                <Text style={[styles.summaryBreakdownVal, !isDark && { color: '#0f172a' }, !includeTax && styles.taxFreeVal]}>
                  {includeTax ? `${settings.currencySymbol}${totalTax.toFixed(2)}` : '₹0.00 (Exempt)'}
                </Text>
              </View>

              {calcOverallDiscountAmount > 0 && (
                <View style={styles.summaryBreakdownRow}>
                  <Text style={styles.discBreakdownLabel}>
                    Bill Discount ({resolvedDiscountType === 'FLAT' ? `${settings.currencySymbol}${resolvedDiscountValue}` : `${resolvedDiscountValue}%`}):
                  </Text>
                  <Text style={styles.discBreakdownVal}>-{settings.currencySymbol}{calcOverallDiscountAmount.toFixed(2)}</Text>
                </View>
              )}

              <View style={[styles.totalPayBar, !isDark && styles.totalPayBarLight]}>
                <Text style={[styles.totalPayLabel, !isDark && { color: '#0f172a' }]}>Total Payable Amount:</Text>
                <Text style={styles.totalPayValue}>{settings.currencySymbol}{grandTotal.toFixed(2)}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Submit button */}
          <TouchableOpacity style={styles.finishBtn} onPress={handleFinishCheckout}>
            <Text style={styles.finishBtnText}>Complete Bill ({settings.currencySymbol}{grandTotal.toFixed(2)})</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 16,
    backgroundColor: '#020617',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeBtn: {
    color: '#94a3b8',
    fontSize: 18,
    paddingHorizontal: 6,
  },
  body: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    padding: 10,
    color: '#ffffff',
    fontSize: 12,
    marginBottom: 8,
  },
  sectionLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  methodBtn: {
    flex: 1,
    backgroundColor: '#020617',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  methodBtnActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  methodText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  methodTextActive: {
    color: '#ffffff',
  },
  cashBox: {
    backgroundColor: '#020617',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 12,
  },
  cashLabel: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 4,
  },
  cashInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 10,
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  chipLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  chipScroll: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  cashChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cashChipText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: 'bold',
  },
  changeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#064e3b',
    padding: 10,
    borderRadius: 8,
  },
  changeLabel: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: 'bold',
  },
  changeValue: {
    color: '#34d399',
    fontSize: 16,
    fontWeight: 'bold',
  },
  upiBox: {
    alignItems: 'center',
    backgroundColor: '#020617',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  upiSelectorCard: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  upiSelectorCardLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  upiSelectorTitle: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  upiScrollRow: {
    flexDirection: 'row',
  },
  upiPill: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
    alignItems: 'flex-start',
  },
  upiPillLight: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
  },
  upiPillActive: {
    backgroundColor: '#4338ca',
    borderColor: '#818cf8',
  },
  upiPillLabel: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: 'bold',
  },
  upiPillLabelActive: {
    color: '#ffffff',
  },
  upiPillId: {
    color: '#94a3b8',
    fontSize: 9,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  upiPillIdActive: {
    color: '#c7d2fe',
  },
  upiScanHint: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  upiWarnBox: {
    backgroundColor: 'rgba(180, 83, 9, 0.2)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    width: '100%',
  },
  upiWarnTitle: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  upiWarnText: {
    color: '#fef3c7',
    fontSize: 10,
    lineHeight: 14,
  },
  qrContainer: {
    padding: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 10,
  },
  qrImage: {
    width: 170,
    height: 170,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  qrLoadingBox: {
    width: 170,
    height: 170,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrLoadingText: {
    color: '#64748b',
    fontSize: 11,
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  modeToggleBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modeToggleBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: '#6366f1',
  },
  modeToggleText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modeToggleTextActive: {
    color: '#c7d2fe',
  },
  vpaDetailsBox: {
    backgroundColor: '#0f172a',
    width: '100%',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 10,
  },
  vpaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  vpaLabel: {
    color: '#94a3b8',
    fontSize: 10,
  },
  vpaValue: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  vpaAmountText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: 'bold',
  },
  openAppBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    width: '100%',
    alignItems: 'center',
  },
  openAppBtnText: {
    color: '#c7d2fe',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardPosBox: {
    backgroundColor: '#020617',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  cardPosTitle: {
    color: '#c084fc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardPosSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
  },
  summaryBreakdown: {
    backgroundColor: '#020617',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16,
  },
  summaryBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryBreakdownLabel: {
    color: '#94a3b8',
    fontSize: 11,
  },
  summaryBreakdownVal: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '500',
  },
  taxFreeVal: {
    color: '#34d399',
    fontWeight: 'bold',
  },
  discBreakdownLabel: {
    color: '#f43f5e',
    fontSize: 11,
    fontWeight: '600',
  },
  discBreakdownVal: {
    color: '#f43f5e',
    fontSize: 11,
    fontWeight: 'bold',
  },
  totalPayBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  totalPayLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  totalPayValue: {
    color: '#10b981',
    fontSize: 18,
    fontWeight: 'bold',
  },
  finishBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    alignItems: 'center',
  },
  finishBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalContentLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  modalHeaderLight: {
    backgroundColor: '#f8fafc',
    borderBottomColor: '#e2e8f0',
  },
  inputLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    color: '#0f172a',
  },
  methodBtnLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  cashBoxLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  cashInputLight: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    color: '#0f172a',
  },
  cashChipLight: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  upiBoxLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  vpaDetailsBoxLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  summaryBreakdownLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  totalPayBarLight: {
    backgroundColor: '#f1f5f9',
  },
});
