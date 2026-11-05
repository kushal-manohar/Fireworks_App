import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { CartItem, StoreSettings, DiscountType, ThemeMode } from '../types';

export interface CheckoutDetails {
  includeTax: boolean;
  overallDiscountType: DiscountType;
  overallDiscountValue: number;
  overallDiscountAmount: number;
}

interface CartViewProps {
  cart: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onApplyLineDiscount: (productId: string, type: DiscountType, value: number) => void;
  onClearCart: () => void;
  onProceedToCheckout: (details: CheckoutDetails) => void;
  onAddMoreItems?: () => void;
  settings: StoreSettings;
  theme?: ThemeMode;
}

export const CartViewNative: React.FC<CartViewProps> = ({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onApplyLineDiscount,
  onClearCart,
  onProceedToCheckout,
  onAddMoreItems,
  settings,
  theme = 'dark',
}) => {
  const isDark = theme !== 'light';
  // Option 1: Tax inclusion / exclusion toggle (Default: Tax Free 0%)
  const [includeTax, setIncludeTax] = useState<boolean>(settings.defaultIncludeTax ?? false);

  // Option 2: Overall Bill discount mode (% or ₹)
  const [overallDiscountType, setOverallDiscountType] = useState<DiscountType>('PERCENT');
  const [overallDiscountValue, setOverallDiscountValue] = useState<number>(0);
  const [customOverallInput, setCustomOverallInput] = useState<string>('');

  // Active line item discount editor
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [lineDiscType, setLineDiscType] = useState<DiscountType>('PERCENT');
  const [lineDiscInput, setLineDiscInput] = useState<string>('');

  // Calculations
  const rawSubtotal = cart.reduce((acc, item) => {
    const basePrice = item.product.price * item.quantity;
    const itemDiscAmount = item.discountType === 'FLAT'
      ? Math.min(item.discountValue || 0, basePrice)
      : (basePrice * (item.discountPercent || item.discountValue || 0)) / 100;
    return acc + Math.max(0, basePrice - itemDiscAmount);
  }, 0);

  const totalTax = includeTax ? cart.reduce((acc, item) => {
    const basePrice = item.product.price * item.quantity;
    const itemDiscAmount = item.discountType === 'FLAT'
      ? Math.min(item.discountValue || 0, basePrice)
      : (basePrice * (item.discountPercent || item.discountValue || 0)) / 100;
    const lineSubtotal = Math.max(0, basePrice - itemDiscAmount);
    return acc + (lineSubtotal * ((item.product.taxRate || 0) / 100));
  }, 0) : 0;

  const overallDiscountAmount = overallDiscountType === 'FLAT'
    ? Math.min(overallDiscountValue, rawSubtotal)
    : (rawSubtotal * overallDiscountValue) / 100;

  const grandTotal = Math.max(0, rawSubtotal + totalTax - overallDiscountAmount);

  // Line discount quick save
  const handleSaveLineDiscount = (productId: string) => {
    const val = parseFloat(lineDiscInput) || 0;
    onApplyLineDiscount(productId, lineDiscType, val);
    setEditingLineId(null);
    setLineDiscInput('');
  };

  const percentPresets = [0, 5, 10, 15, 20];
  const flatPresets = [0, 50, 100, 200, 500];

  return (
    <View style={[styles.card, !isDark && styles.cardLight]}>
      <ScrollView
        style={styles.cartScroll}
        contentContainerStyle={styles.cartScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={[styles.cardHeader, !isDark && styles.cardHeaderLight]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.cardTitle, !isDark && { color: '#0f172a' }]}>
              Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)} items)
            </Text>
            <Text style={[styles.headerSubtitle, !isDark && { color: '#64748b' }]}>
              {includeTax ? 'Tax Included (GST)' : 'Tax Excluded (0% Free)'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {onAddMoreItems && (
              <TouchableOpacity onPress={onAddMoreItems} style={styles.addMoreBtn}>
                <Text style={styles.addMoreBtnText}>+ Add Items</Text>
              </TouchableOpacity>
            )}
            {cart.length > 0 && (
              <TouchableOpacity onPress={onClearCart} style={styles.clearBtn}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tax Include / Exclude Switch */}
        <View style={[styles.taxToggleContainer, !isDark && styles.taxToggleContainerLight]}>
          <Text style={[styles.taxToggleLabel, !isDark && { color: '#334155' }]}>Bill Tax Mode:</Text>
          <View style={[styles.taxToggleButtons, !isDark && { backgroundColor: '#e2e8f0' }]}>
            <TouchableOpacity
              style={[styles.taxBtn, includeTax && styles.taxBtnIncludeActive]}
              onPress={() => setIncludeTax(true)}
            >
              <Text
                style={[
                  styles.taxBtnText,
                  !isDark && !includeTax && { color: '#64748b' },
                  includeTax && styles.taxBtnTextActive,
                ]}
              >
                Include Tax
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.taxBtn, !includeTax && styles.taxBtnExcludeActive]}
              onPress={() => setIncludeTax(false)}
            >
              <Text
                style={[
                  styles.taxBtnText,
                  !isDark && includeTax && { color: '#64748b' },
                  !includeTax && styles.taxBtnTextActive,
                ]}
              >
                Exclude Tax (0%)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Item list container */}
        <View style={styles.cartListContainer}>
          {cart.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🛒</Text>
              <Text style={[styles.emptyText, !isDark && { color: '#475569' }]}>Cart is empty</Text>
              <Text style={[styles.emptySubtext, !isDark && { color: '#64748b' }]}>
                Scan barcodes or select items from Type & Search billing.
              </Text>
              {onAddMoreItems && (
                <TouchableOpacity onPress={onAddMoreItems} style={styles.emptyAddBtn}>
                  <Text style={styles.emptyAddBtnText}>+ Start Adding Products</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            cart.map((item) => {
              const basePrice = item.product.price * item.quantity;
              const itemDiscAmount = item.discountType === 'FLAT'
                ? Math.min(item.discountValue || 0, basePrice)
                : (basePrice * (item.discountPercent || item.discountValue || 0)) / 100;
              const lineSubtotal = Math.max(0, basePrice - itemDiscAmount);
              const isEditingThis = editingLineId === item.product.id;

              return (
                <View key={item.product.id} style={[styles.itemRow, !isDark && styles.itemRowLight]}>
                  <View style={styles.itemTopRow}>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, !isDark && { color: '#0f172a' }]}>{item.product.name}</Text>
                      <View style={styles.metaRow}>
                        <Text style={[styles.itemMeta, !isDark && { color: '#64748b' }]}>
                          {settings.currencySymbol}{item.product.price.toFixed(2)}/unit
                        </Text>
                        <Text style={[styles.itemMetaTax, !includeTax && styles.itemMetaTaxFree]}>
                          Tax: {includeTax ? `${item.product.taxRate}%` : '0% (Free)'}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity onPress={() => onRemoveItem(item.product.id)} style={styles.deleteBtn}>
                      <Text style={[styles.deleteText, !isDark && { color: '#64748b' }]}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Line discount active badge / editor */}
                  {isEditingThis ? (
                    <View style={[styles.inlineDiscountEditor, !isDark && { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}>
                      <Text style={[styles.inlineDiscountTitle, !isDark && { color: '#475569' }]}>Item Discount:</Text>
                      <View style={[styles.inlineModeSwitch, !isDark && { backgroundColor: '#e2e8f0' }]}>
                        <TouchableOpacity
                          style={[styles.modeMiniBtn, lineDiscType === 'PERCENT' && styles.modeMiniBtnActive]}
                          onPress={() => setLineDiscType('PERCENT')}
                        >
                          <Text style={[styles.modeMiniBtnText, lineDiscType === 'PERCENT' && styles.modeMiniBtnTextActive]}>%</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.modeMiniBtn, lineDiscType === 'FLAT' && styles.modeMiniBtnActive]}
                          onPress={() => setLineDiscType('FLAT')}
                        >
                          <Text style={[styles.modeMiniBtnText, lineDiscType === 'FLAT' && styles.modeMiniBtnTextActive]}>₹</Text>
                        </TouchableOpacity>
                      </View>

                      <TextInput
                        style={[styles.inlineInput, !isDark && { backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' }]}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#64748b"
                        value={lineDiscInput}
                        onChangeText={setLineDiscInput}
                      />

                      <TouchableOpacity
                        style={styles.saveMiniBtn}
                        onPress={() => handleSaveLineDiscount(item.product.id)}
                      >
                        <Text style={styles.saveMiniBtnText}>Apply</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cancelMiniBtn}
                        onPress={() => setEditingLineId(null)}
                      >
                        <Text style={styles.cancelMiniBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.discountRowItem}>
                      <TouchableOpacity
                        style={[styles.discBadgeBtn, !isDark && { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}
                        onPress={() => {
                          setEditingLineId(item.product.id);
                          setLineDiscType(item.discountType || 'PERCENT');
                          setLineDiscInput(String(item.discountValue || item.discountPercent || ''));
                        }}
                      >
                        <Text style={[styles.discBadgeText, !isDark && { color: '#334155' }]}>
                          Discount:{' '}
                          {item.discountAmount > 0
                            ? `${item.discountType === 'FLAT' ? `₹${item.discountValue}` : `${item.discountValue || item.discountPercent}%`} (-₹${item.discountAmount.toFixed(0)})`
                            : 'None (Tap to add)'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.itemControls}>
                    <View style={[styles.qtyBox, !isDark && { backgroundColor: '#f1f5f9' }]}>
                      <TouchableOpacity
                        style={[styles.qtyBtn, !isDark && { backgroundColor: '#e2e8f0' }]}
                        onPress={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                      >
                        <Text style={[styles.qtyBtnText, !isDark && { color: '#0f172a' }]}>-</Text>
                      </TouchableOpacity>
                      <Text style={[styles.qtyText, !isDark && { color: '#0f172a' }]}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={[styles.qtyBtn, !isDark && { backgroundColor: '#e2e8f0' }]}
                        onPress={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                      >
                        <Text style={[styles.qtyBtnText, !isDark && { color: '#0f172a' }]}>+</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.linePrice}>
                      {settings.currencySymbol}{lineSubtotal.toFixed(2)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Bill Footer */}
        {cart.length > 0 && (
          <View style={[styles.footer, !isDark && styles.footerLight]}>
            {/* Bill Overall Discount Section with Rupees vs Percentage Mode */}
            <View style={[styles.overallDiscountBox, !isDark && styles.overallDiscountBoxLight]}>
              <View style={styles.discountHeaderRow}>
                <Text style={[styles.discountLabel, !isDark && { color: '#334155' }]}>Overall Bill Discount</Text>
                {/* Type Switcher: % vs ₹ */}
                <View style={[styles.typeSwitcher, !isDark && { backgroundColor: '#e2e8f0' }]}>
                  <TouchableOpacity
                    style={[styles.typeBtn, overallDiscountType === 'PERCENT' && styles.typeBtnActive]}
                    onPress={() => {
                      setOverallDiscountType('PERCENT');
                      setOverallDiscountValue(0);
                      setCustomOverallInput('');
                    }}
                  >
                    <Text style={[styles.typeBtnText, !isDark && overallDiscountType !== 'PERCENT' && { color: '#64748b' }, overallDiscountType === 'PERCENT' && styles.typeBtnTextActive]}>
                      % Percentage
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.typeBtn, overallDiscountType === 'FLAT' && styles.typeBtnActive]}
                    onPress={() => {
                      setOverallDiscountType('FLAT');
                      setOverallDiscountValue(0);
                      setCustomOverallInput('');
                    }}
                  >
                    <Text style={[styles.typeBtnText, !isDark && overallDiscountType !== 'FLAT' && { color: '#64748b' }, overallDiscountType === 'FLAT' && styles.typeBtnTextActive]}>
                      ₹ Rupees
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Presets and Custom Input */}
              <View style={styles.discountControlsRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
                  {(overallDiscountType === 'PERCENT' ? percentPresets : flatPresets).map((val) => {
                    const isActive = overallDiscountValue === val && !customOverallInput;
                    return (
                      <TouchableOpacity
                        key={val}
                        style={[
                          styles.presetChip,
                          !isDark && { backgroundColor: '#e2e8f0' },
                          isActive && styles.presetChipActive,
                        ]}
                        onPress={() => {
                          setOverallDiscountValue(val);
                          setCustomOverallInput('');
                        }}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            !isDark && !isActive && { color: '#334155' },
                            isActive && styles.presetChipTextActive,
                          ]}
                        >
                          {overallDiscountType === 'PERCENT' ? `${val}%` : `₹${val}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Custom Value Input */}
                <View style={styles.customInputContainer}>
                  <TextInput
                    style={[styles.customInput, !isDark && { backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' }]}
                    keyboardType="numeric"
                    placeholder={overallDiscountType === 'PERCENT' ? 'Custom %' : 'Custom ₹'}
                    placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                    value={customOverallInput}
                    onChangeText={(text) => {
                      setCustomOverallInput(text);
                      const parsed = parseFloat(text) || 0;
                      setOverallDiscountValue(parsed);
                    }}
                  />
                </View>
              </View>
            </View>

            {/* Breakdown Rows */}
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, !isDark && { color: '#64748b' }]}>Items Subtotal:</Text>
              <Text style={[styles.summaryValue, !isDark && { color: '#0f172a' }]}>{settings.currencySymbol}{rawSubtotal.toFixed(2)}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, !isDark && { color: '#64748b' }]}>
                Tax (GST): {includeTax ? '' : '(0% Free / Excluded)'}
              </Text>
              <Text style={[styles.summaryValue, !isDark && { color: '#0f172a' }, !includeTax && styles.taxFreeValue]}>
                {includeTax ? `${settings.currencySymbol}${totalTax.toFixed(2)}` : '₹0.00 (Exempt)'}
              </Text>
            </View>

            {overallDiscountAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.discountText}>
                  Bill Discount ({overallDiscountType === 'FLAT' ? `₹${overallDiscountValue}` : `${overallDiscountValue}%`}):
                </Text>
                <Text style={styles.discountText}>-{settings.currencySymbol}{overallDiscountAmount.toFixed(2)}</Text>
              </View>
            )}

            <View style={[styles.totalRow, !isDark && { borderTopColor: '#e2e8f0' }]}>
              <Text style={[styles.totalLabel, !isDark && { color: '#0f172a' }]}>Grand Total:</Text>
              <Text style={styles.totalValue}>{settings.currencySymbol}{grandTotal.toFixed(2)}</Text>
            </View>

            <TouchableOpacity
              style={styles.checkoutBtn}
              onPress={() => onProceedToCheckout({
                includeTax,
                overallDiscountType,
                overallDiscountValue,
                overallDiscountAmount,
              })}
            >
              <Text style={styles.checkoutBtnText}>Proceed to Checkout ({settings.currencySymbol}{grandTotal.toFixed(2)}) ➔</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
    marginBottom: 0,
  },
  cardHeader: {
    padding: 12,
    backgroundColor: '#020617',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerLeft: {
    flex: 1,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 6,
  },
  clearText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: 'bold',
  },
  taxToggleContainer: {
    backgroundColor: '#090d16',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  taxToggleLabel: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: 'bold',
  },
  taxToggleButtons: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 2,
  },
  taxBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  taxBtnIncludeActive: {
    backgroundColor: '#4f46e5',
  },
  taxBtnExcludeActive: {
    backgroundColor: '#059669',
  },
  taxBtnText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  taxBtnTextActive: {
    color: '#ffffff',
  },
  cartScroll: {
    flex: 1,
  },
  cartScrollContent: {
    paddingBottom: 140,
  },
  cartListContainer: {
    padding: 10,
  },
  addMoreBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#059669',
    borderRadius: 6,
  },
  addMoreBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyAddBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#4f46e5',
    borderRadius: 8,
  },
  emptyAddBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: 'bold',
  },
  emptySubtext: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  itemRow: {
    backgroundColor: '#020617',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: 'bold',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  itemMeta: {
    color: '#64748b',
    fontSize: 10,
  },
  itemMetaTax: {
    color: '#818cf8',
    fontSize: 10,
    fontWeight: '600',
  },
  itemMetaTaxFree: {
    color: '#34d399',
  },
  deleteBtn: {
    padding: 4,
  },
  deleteText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  discountRowItem: {
    marginBottom: 6,
  },
  discBadgeBtn: {
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#334155',
  },
  discBadgeText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '600',
  },
  inlineDiscountEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 6,
    borderRadius: 8,
    marginBottom: 6,
    gap: 6,
  },
  inlineDiscountTitle: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  inlineModeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 4,
    padding: 1,
  },
  modeMiniBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  modeMiniBtnActive: {
    backgroundColor: '#4f46e5',
  },
  modeMiniBtnText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modeMiniBtnTextActive: {
    color: '#ffffff',
  },
  inlineInput: {
    backgroundColor: '#020617',
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 10,
    width: 44,
    textAlign: 'center',
  },
  saveMiniBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  saveMiniBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cancelMiniBtn: {
    padding: 4,
  },
  cancelMiniBtnText: {
    color: '#94a3b8',
    fontSize: 10,
  },
  itemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 2,
  },
  qtyBtn: {
    width: 24,
    height: 24,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  qtyText: {
    color: '#ffffff',
    fontWeight: 'bold',
    paddingHorizontal: 8,
    fontSize: 12,
  },
  linePrice: {
    color: '#10b981',
    fontWeight: 'bold',
    fontSize: 13,
  },
  footer: {
    padding: 12,
    backgroundColor: '#020617',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  overallDiscountBox: {
    backgroundColor: '#0b1120',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  discountHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  discountLabel: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: 'bold',
  },
  typeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 6,
    padding: 2,
  },
  typeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  typeBtnActive: {
    backgroundColor: '#f59e0b',
  },
  typeBtnText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  typeBtnTextActive: {
    color: '#020617',
  },
  discountControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presetsScroll: {
    flex: 1,
  },
  presetChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#1e293b',
    borderRadius: 6,
    marginRight: 4,
  },
  presetChipActive: {
    backgroundColor: '#f59e0b',
  },
  presetChipText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  presetChipTextActive: {
    color: '#020617',
  },
  customInputContainer: {
    width: 68,
  },
  customInput: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    color: '#ffffff',
    fontSize: 10,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: {
    color: '#94a3b8',
    fontSize: 11,
  },
  summaryValue: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '500',
  },
  taxFreeValue: {
    color: '#34d399',
    fontWeight: 'bold',
  },
  discountText: {
    color: '#f43f5e',
    fontSize: 11,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 6,
    marginTop: 4,
    marginBottom: 10,
  },
  totalLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  totalValue: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkoutBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkoutBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeaderLight: {
    backgroundColor: '#f8fafc',
    borderBottomColor: '#e2e8f0',
  },
  taxToggleContainerLight: {
    backgroundColor: '#f1f5f9',
    borderBottomColor: '#e2e8f0',
  },
  itemRowLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  footerLight: {
    backgroundColor: '#f8fafc',
    borderTopColor: '#e2e8f0',
  },
  overallDiscountBoxLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
});
