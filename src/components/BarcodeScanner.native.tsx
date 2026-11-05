import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  FlatList
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Product, ThemeMode } from '../types';

interface BarcodeScannerProps {
  onScanSuccess: (barcode: string) => void;
  onAddProduct?: (product: Product) => void;
  products: Product[];
  enableHaptics: boolean;
  currencySymbol?: string;
  theme?: ThemeMode;
  mode?: 'search' | 'barcode';
  billingTab?: 'search' | 'barcode' | 'cart';
  onBillingTabChange?: (tab: 'search' | 'barcode' | 'cart') => void;
  onGoToCart?: () => void;
  cartCount?: number;
  cartTotal?: number;
  hideHeaderTabs?: boolean;
}

export const BarcodeScannerNative: React.FC<BarcodeScannerProps> = ({
  onScanSuccess,
  onAddProduct,
  products,
  enableHaptics,
  currencySymbol = '₹',
  theme = 'dark',
  mode,
  billingTab,
  onBillingTabChange,
  onGoToCart,
  cartCount = 0,
  cartTotal = 0,
  hideHeaderTabs = false,
}) => {
  const isDark = theme !== 'light';
  // 3 sub-tabs: Type & Search (first), Barcode (second), Cart (third)
  const [internalTab, setInternalTab] = useState<'search' | 'barcode' | 'cart'>('search');
  const activeTab = mode !== undefined ? mode : (billingTab !== undefined ? billingTab : internalTab);

  const handleSelectTab = (tab: 'search' | 'barcode' | 'cart') => {
    if (onBillingTabChange) {
      onBillingTabChange(tab);
    }
    setInternalTab(tab);
    if (tab !== 'barcode') {
      setIsCameraOpen(false);
      setTorch(false);
    }
  };

  // Camera permissions & toggle (Camera is OFF by default; opened via button)
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [torch, setTorch] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>('');
  const [scanned, setScanned] = useState<boolean>(false);

  // Type & Search Billing States
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isDropdownModalOpen, setIsDropdownModalOpen] = useState<boolean>(false);
  const [recentAddedName, setRecentAddedName] = useState<string | null>(null);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    if (enableHaptics) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    onScanSuccess(data);

    // Re-enable scanning after 1.2s
    setTimeout(() => {
      setScanned(false);
    }, 1200);
  };

  const handleManualAdd = () => {
    if (manualCode.trim()) {
      handleBarCodeScanned({ data: manualCode.trim() });
      setManualCode('');
    }
  };

  const handleSelectProduct = (prod: Product) => {
    if (enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (onAddProduct) {
      onAddProduct(prod);
    } else {
      handleBarCodeScanned({ data: prod.barcode });
    }
    setRecentAddedName(prod.name);
    setIsDropdownModalOpen(false);
    setTimeout(() => {
      setRecentAddedName(null);
    }, 2500);
  };

  const handleToggleCamera = async () => {
    if (!isCameraOpen) {
      if (!permission?.granted) {
        const res = await requestPermission();
        if (!res.granted) return;
      }
      setIsCameraOpen(true);
    } else {
      setIsCameraOpen(false);
      setTorch(false);
    }
  };

  // Derive categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [products]);

  // Filtered products based on search & category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      if (!matchCat) return false;

      if (!productSearchQuery.trim()) return true;
      const q = productSearchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    });
  }, [products, productSearchQuery, selectedCategory]);

  return (
    <View style={[styles.card, !isDark && styles.cardLight]}>
      {/* 3 distinct billing tabs: Type & Search Billing (First), Barcode Billing (Second), Cart (Third) */}
      {!hideHeaderTabs && (
        <View style={[styles.tabHeaderRow, !isDark && styles.tabHeaderRowLight]}>
          <TouchableOpacity
            style={[
              styles.billingTabBtn,
              !isDark && styles.billingTabBtnLight,
              activeTab === 'search' && styles.billingTabBtnActiveSearch,
            ]}
            onPress={() => handleSelectTab('search')}
          >
            <Text
              style={[
                styles.billingTabText,
                !isDark && styles.billingTabTextLight,
                activeTab === 'search' && styles.billingTabTextActive,
              ]}
            >
              🔍 Search & Type
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.billingTabBtn,
              !isDark && styles.billingTabBtnLight,
              activeTab === 'barcode' && styles.billingTabBtnActiveBarcode,
            ]}
            onPress={() => handleSelectTab('barcode')}
          >
            <Text
              style={[
                styles.billingTabText,
                !isDark && styles.billingTabTextLight,
                activeTab === 'barcode' && styles.billingTabTextActive,
              ]}
            >
              📷 Barcode
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.billingTabBtn,
              !isDark && styles.billingTabBtnLight,
              activeTab === 'cart' && styles.billingTabBtnActiveCart,
            ]}
            onPress={() => handleSelectTab('cart')}
          >
            <Text
              style={[
                styles.billingTabText,
                !isDark && styles.billingTabTextLight,
                activeTab === 'cart' && styles.billingTabTextActive,
              ]}
            >
              🛒 Cart ({cartCount})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Feedback Toast Banner */}
      {recentAddedName && (
        <View style={styles.toastBanner}>
          <Text style={styles.toastText}>✓ Added "{recentAddedName}" to Bill!</Text>
        </View>
      )}

      {/* TAB 1: BARCODE BILLING */}
      {activeTab === 'barcode' && (
        <ScrollView
          style={styles.searchScroll}
          contentContainerStyle={styles.searchScrollContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* Button to Open/Close Camera */}
          <View style={styles.cameraBtnRow}>
            <TouchableOpacity
              style={[styles.openCameraBtn, isCameraOpen && styles.closeCameraBtn]}
              onPress={handleToggleCamera}
            >
              <Text style={styles.openCameraBtnText}>
                {isCameraOpen ? '✕ Close Camera Scanner' : '📷 Open Camera for Scan'}
              </Text>
            </TouchableOpacity>

            {isCameraOpen && (
              <TouchableOpacity
                style={[
                  styles.torchBtn,
                  !isDark && { backgroundColor: '#e2e8f0' },
                  torch && styles.torchBtnActive,
                ]}
                onPress={() => setTorch(!torch)}
              >
                <Text style={[styles.torchBtnText, !isDark && !torch && { color: '#1e293b' }]}>
                  {torch ? 'Flash ON' : 'Flash OFF'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Camera Viewfinder (only rendered when user clicks Open Camera) */}
          {isCameraOpen && (
            <View style={styles.cameraContainer}>
              <CameraView
                style={styles.camera}
                enableTorch={torch}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
                }}
              >
                {/* Laser overlay reticle */}
                <View style={styles.overlay}>
                  <View style={styles.targetFrame}>
                    <View style={styles.laserLine} />
                  </View>
                </View>
              </CameraView>
            </View>
          )}

          {/* Hardware Barcode Scanner Status */}
          {!isCameraOpen && (
            <View style={[styles.hwInfoBox, !isDark && styles.hwInfoBoxLight]}>
              <Text style={[styles.hwInfoTitle, !isDark && { color: '#4f46e5' }]}>
                ⚡ Hardware Barcode Scanner Ready
              </Text>
              <Text style={styles.hwInfoSub}>
                USB & Bluetooth laser barcode readers input directly into the field below.
              </Text>
            </View>
          )}

          {/* Manual barcode entry */}
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, !isDark && styles.inputLight]}
              placeholder="Scan or enter barcode number..."
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              value={manualCode}
              onChangeText={setManualCode}
              keyboardType="default"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.addBtn} onPress={handleManualAdd}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* TAB 2: TYPE & SEARCH BILLING */}
      {activeTab === 'search' && (
        <ScrollView
          style={styles.searchScroll}
          contentContainerStyle={styles.searchScrollContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search Box Input */}
          <View style={styles.searchBoxRow}>
            <TextInput
              style={[styles.searchInput, !isDark && styles.searchInputLight]}
              placeholder="Type product name, category, or code..."
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              value={productSearchQuery}
              onChangeText={setProductSearchQuery}
            />
            {productSearchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => setProductSearchQuery('')}
              >
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Category Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.catPill,
                  !isDark && styles.catPillLight,
                  selectedCategory === cat && styles.catPillActive,
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text
                  style={[
                    styles.catPillText,
                    !isDark && { color: '#475569' },
                    selectedCategory === cat && styles.catPillTextActive,
                  ]}
                >
                  {cat === 'ALL' ? '🏷️ All' : cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Dropdown Selection Button */}
          <TouchableOpacity
            style={[styles.dropdownBtn, !isDark && styles.dropdownBtnLight]}
            onPress={() => setIsDropdownModalOpen(true)}
          >
            <Text style={[styles.dropdownBtnText, !isDark && { color: '#047857' }]}>
              ▼ Select Product from Dropdown ({filteredProducts.length} items)
            </Text>
          </TouchableOpacity>

          {/* Interactive Products List Tray */}
          <View style={styles.resultsContainer}>
            <View style={styles.resultsHeaderRow}>
              <Text style={[styles.resultsHeader, !isDark && { color: '#64748b' }]}>
                {productSearchQuery.trim() ? `Search Results (${filteredProducts.length})` : `Available Catalog (${filteredProducts.length})`}
              </Text>
            </View>

            {products.length === 0 ? (
              <View style={[styles.emptyCatalogBox, !isDark && styles.emptyCatalogBoxLight]}>
                <Text style={[styles.emptyCatalogTitle, !isDark && { color: '#0f172a' }]}>
                  No products in catalog yet
                </Text>
                <Text style={styles.emptyCatalogSub}>
                  Go to Catalog & Stock in Admin login to add your Satyamamba Fireworks products.
                </Text>
              </View>
            ) : filteredProducts.length === 0 ? (
              <Text style={styles.noMatchText}>No products matched "{productSearchQuery}".</Text>
            ) : (
              <View style={styles.productsList}>
                {filteredProducts.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.resultItem, !isDark && styles.resultItemLight]}
                    onPress={() => handleSelectProduct(item)}
                  >
                    <View style={styles.resultItemInfo}>
                      <Text style={[styles.resultItemName, !isDark && { color: '#0f172a' }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.resultItemSub}>
                        {item.category} • Barcode: {item.barcode} • Stock: {item.stock} {item.unit}
                      </Text>
                    </View>
                    <View style={styles.resultItemRight}>
                      <Text style={[styles.resultItemPrice, !isDark && { color: '#059669' }]}>
                        {currencySymbol}{item.price.toFixed(2)}
                      </Text>
                      <View style={styles.quickAddBadge}>
                        <Text style={styles.quickAddText}>+ Add</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Full Dropdown Product Picker Modal */}
      <Modal visible={isDropdownModalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, !isDark && styles.modalContentLight]}>
            <View style={[styles.modalHeader, !isDark && styles.modalHeaderLight]}>
              <Text style={[styles.modalTitle, !isDark && { color: '#0f172a' }]}>
                Choose Product to Add to Bill
              </Text>
              <TouchableOpacity onPress={() => setIsDropdownModalOpen(false)}>
                <Text style={[styles.modalClose, !isDark && { color: '#64748b' }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 12 }}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>
                  No products available in this selection.
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, !isDark && styles.modalItemLight]}
                  onPress={() => handleSelectProduct(item)}
                >
                  <View style={styles.modalItemInfo}>
                    <Text style={[styles.modalItemName, !isDark && { color: '#0f172a' }]}>{item.name}</Text>
                    <Text style={styles.modalItemSub}>
                      {item.category} | Barcode: {item.barcode} | Stock: {item.stock} {item.unit}
                    </Text>
                  </View>
                  <View style={styles.modalItemAction}>
                    <Text style={[styles.modalItemPrice, !isDark && { color: '#059669' }]}>
                      {currencySymbol}{item.price.toFixed(2)}
                    </Text>
                    <Text style={styles.modalAddBtn}>+ Add</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Quick Cart Floating Bottom Bar (Visible on Search & Barcode tabs when items exist) */}
      {activeTab !== 'cart' && cartCount > 0 && (
        <TouchableOpacity
          style={[styles.floatingCartBar, !isDark && styles.floatingCartBarLight]}
          onPress={() => {
            if (onGoToCart) onGoToCart();
            else handleSelectTab('cart');
          }}
        >
          <View style={styles.floatingCartLeft}>
            <Text style={styles.floatingCartIcon}>🛒</Text>
            <View>
              <Text style={styles.floatingCartCount}>
                {cartCount} {cartCount === 1 ? 'item' : 'items'} in Cart
              </Text>
              <Text style={styles.floatingCartTotal}>
                Total: {currencySymbol}{cartTotal.toFixed(2)}
              </Text>
            </View>
          </View>
          <View style={styles.floatingCartRight}>
            <Text style={styles.floatingCartActionText}>View Cart →</Text>
          </View>
        </TouchableOpacity>
      )}
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
  searchScroll: {
    flex: 1,
  },
  searchScrollContent: {
    padding: 12,
    paddingBottom: 110,
  },
  tabHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#020617',
    padding: 6,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  billingTabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  billingTabBtnActiveBarcode: {
    backgroundColor: '#4f46e5',
  },
  billingTabBtnActiveSearch: {
    backgroundColor: '#059669',
  },
  billingTabBtnActiveCart: {
    backgroundColor: '#d97706',
  },
  floatingCartBar: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4f46e5',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  floatingCartBarLight: {
    backgroundColor: '#4338ca',
  },
  floatingCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  floatingCartIcon: {
    fontSize: 20,
  },
  floatingCartCount: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  floatingCartTotal: {
    color: '#e0e7ff',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  floatingCartRight: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  floatingCartActionText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  billingTabText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  billingTabTextActive: {
    color: '#ffffff',
  },
  tabContent: {
    padding: 12,
  },
  cameraBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  openCameraBtn: {
    flex: 1,
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeCameraBtn: {
    backgroundColor: '#e11d48',
  },
  openCameraBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  torchBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchBtnActive: {
    backgroundColor: '#d97706',
  },
  torchBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cameraContainer: {
    height: 200,
    backgroundColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetFrame: {
    width: 240,
    height: 120,
    borderWidth: 2,
    borderColor: '#6366f1',
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laserLine: {
    width: '90%',
    height: 2,
    backgroundColor: '#ef4444',
  },
  hwInfoBox: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  hwInfoTitle: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  hwInfoSub: {
    color: '#64748b',
    fontSize: 10,
    textAlign: 'center',
  },
  toastBanner: {
    backgroundColor: '#064e3b',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#059669',
  },
  toastText: {
    color: '#a7f3d0',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
  },
  addBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  addBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  searchBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
  },
  clearBtn: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  clearBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  catScroll: {
    marginBottom: 10,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginRight: 6,
  },
  catPillActive: {
    backgroundColor: '#059669',
    borderColor: '#10b981',
  },
  catPillText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  catPillTextActive: {
    color: '#ffffff',
  },
  dropdownBtn: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  dropdownBtnText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: 'bold',
  },
  resultsContainer: {
    marginTop: 4,
  },
  resultsHeaderRow: {
    marginBottom: 6,
  },
  resultsHeader: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  emptyCatalogBox: {
    padding: 20,
    backgroundColor: '#020617',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  emptyCatalogTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emptyCatalogSub: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
  },
  noMatchText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12,
  },
  productsList: {
    gap: 6,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#020617',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  resultItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  resultItemName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  resultItemSub: {
    color: '#64748b',
    fontSize: 10,
  },
  resultItemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  resultItemPrice: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: 'bold',
  },
  quickAddBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  quickAddText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalClose: {
    color: '#94a3b8',
    fontSize: 16,
    padding: 4,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalItemInfo: {
    flex: 1,
    marginRight: 10,
  },
  modalItemName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  modalItemSub: {
    color: '#64748b',
    fontSize: 11,
  },
  modalItemAction: {
    alignItems: 'flex-end',
  },
  modalItemPrice: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalAddBtn: {
    backgroundColor: '#059669',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
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
  tabHeaderRowLight: {
    backgroundColor: '#f1f5f9',
    borderBottomColor: '#e2e8f0',
  },
  billingTabBtnLight: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  billingTabTextLight: {
    color: '#64748b',
  },
  hwInfoBoxLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  inputLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    color: '#0f172a',
  },
  searchInputLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    color: '#0f172a',
  },
  catPillLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  dropdownBtnLight: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  emptyCatalogBoxLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  resultItemLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  modalContentLight: {
    backgroundColor: '#ffffff',
  },
  modalHeaderLight: {
    borderBottomColor: '#e2e8f0',
  },
  modalItemLight: {
    borderBottomColor: '#f1f5f9',
  },
});
