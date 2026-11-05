import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Alert, Text, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavbarNative } from './src/components/Navbar.native';
import { BarcodeScannerNative } from './src/components/BarcodeScanner.native';
import { CartViewNative, CheckoutDetails } from './src/components/CartView.native';
import { CheckoutModalNative } from './src/components/CheckoutModal.native';
import { ReceiptViewModalNative } from './src/components/ReceiptViewModal.native';
import { InventoryManagerNative } from './src/components/InventoryManager.native';
import { SalesReportsNative } from './src/components/SalesReports.native';
import { SettingsModalNative } from './src/components/SettingsModal.native';
import { LoginPageNative } from './src/components/LoginPage.native';
import { Product, CartItem, Invoice, StoreSettings, Role, ThemeMode, UserSession, DiscountType } from './src/types';
import {
  getProducts,
  getInvoices,
  getSettings,
  getThemePreference,
  saveThemePreference,
  getUserSession,
  saveUserSession,
  clearUserSession,
  purgeOldSampleData
} from './src/utils/storage';
import {
  fetchProducts,
  saveProductRecord,
  deleteProductRecord,
  fetchInvoices,
  recordInvoice,
  fetchStoreSettings,
  saveStoreSettings,
  syncOfflineInvoices,
  subscribeToRealtimeChanges
} from './src/services/dbService';

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [session, setSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<'billing' | 'inventory' | 'reports' | 'settings'>('billing');
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({
    storeName: 'Satyamamba Fireworks',
    address: '',
    phone: '',
    gstin: '',
    currencySymbol: '₹',
    upiId: '',
    managerPasscode: '1234',
    receiptFooter: 'Thank you for shopping at Satyamamba Fireworks! Wish you a happy & safe celebration.',
    printerPaperWidth: '58mm',
    enableHaptics: true,
    enableSound: true,
    defaultIncludeTax: false,
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [billingSubTab, setBillingSubTab] = useState<'search' | 'barcode' | 'cart'>('search');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [checkoutConfig, setCheckoutConfig] = useState<CheckoutDetails>({
    includeTax: false,
    overallDiscountType: 'PERCENT',
    overallDiscountValue: 0,
    overallDiscountAmount: 0,
  });
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    (async () => {
      // 0. Purge legacy sample data
      await purgeOldSampleData();

      // 1. Immediate local render
      const p = await getProducts();
      const i = await getInvoices();
      const s = await getSettings();
      const t = await getThemePreference();
      const sess = await getUserSession();
      setProducts(p);
      setInvoices(i);
      setSettings(s);
      setTheme(t);
      setSession(sess);

      // 2. Sync with Supabase cloud in background
      try {
        const cloudSettings = await fetchStoreSettings();
        setSettings(cloudSettings);
        const cloudProducts = await fetchProducts();
        setProducts(cloudProducts);
        const cloudInvoices = await fetchInvoices();
        setInvoices(cloudInvoices);
        await syncOfflineInvoices();
      } catch (err) {
        console.warn('Expo cloud sync error:', err);
      }

      // 3. Supabase Realtime multi-counter sync
      unsubscribe = await subscribeToRealtimeChanges({
        onProductsUpdate: async () => {
          const freshP = await fetchProducts();
          setProducts(freshP);
        },
        onInvoicesUpdate: async () => {
          const freshI = await fetchInvoices();
          setInvoices(freshI);
        },
        onSettingsUpdate: async () => {
          const freshS = await fetchStoreSettings();
          setSettings(freshS);
        },
      });
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleToggleTheme = async () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    await saveThemePreference(next);
  };

  const handleLoginSuccess = async (newSession: UserSession) => {
    setSession(newSession);
    await saveUserSession(newSession);
    setActiveTab('billing');
  };

  const handleLogout = async () => {
    await clearUserSession();
    setSession(null);
    setActiveTab('billing');
  };

  const handleAddProduct = (product: Product) => {
    setCart(prevCart => {
      const existingIdx = prevCart.findIndex(item => item.product.id === product.id);
      if (existingIdx > -1) {
        return prevCart.map((item, idx) =>
          idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [
          ...prevCart,
          {
            product,
            quantity: 1,
            discountType: 'PERCENT',
            discountValue: 0,
            discountPercent: 0,
            discountAmount: 0,
          }
        ];
      }
    });
  };

  const handleScanSuccess = (scannedBarcode: string) => {
    const cleanBarcode = scannedBarcode.trim();
    const foundProduct = products.find(p => p.barcode?.trim() === cleanBarcode);

    if (foundProduct) {
      handleAddProduct(foundProduct);
    } else {
      if (session?.role === 'ADMIN') {
        Alert.alert('Unmapped Product', `Barcode "${scannedBarcode}" is not registered. Navigate to Stock tab to add it.`);
      } else {
        Alert.alert('Unmapped Product', `Barcode "${scannedBarcode}" is not registered. Ask Store Admin to add it to Catalog.`);
      }
    }
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.product.id !== productId));
      return;
    }
    setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity } : item));
  };

  const handleApplyLineDiscount = (productId: string, type: DiscountType, value: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id !== productId) return item;
      const basePrice = item.product.price * item.quantity;
      const flatAmount = type === 'FLAT' 
        ? Math.min(value, basePrice)
        : (basePrice * value) / 100;
      const percent = basePrice > 0 ? (flatAmount / basePrice) * 100 : 0;
      return {
        ...item,
        discountType: type,
        discountValue: value,
        discountPercent: percent,
        discountAmount: flatAmount,
      };
    }));
  };

  const handleCompleteCheckout = async (newInvoice: Invoice) => {
    const saved = await recordInvoice(newInvoice);
    setInvoices(prev => [saved, ...prev.filter(i => i.id !== saved.id)]);

    const updatedProducts = products.map(p => {
      const cartMatch = newInvoice.items.find(i => i.productId === p.id);
      if (cartMatch) {
        const nextProd = { ...p, stock: Math.max(0, p.stock - cartMatch.quantity) };
        saveProductRecord(nextProd);
        return nextProd;
      }
      return p;
    });
    setProducts(updatedProducts);

    setCart([]);
    setIsCheckoutOpen(false);
    setViewingInvoice(saved);
  };

  const handleSaveProduct = async (updatedProduct: Product) => {
    const exists = products.some(p => p.id === updatedProduct.id);
    let nextList: Product[];
    if (exists) {
      nextList = products.map(p => p.id === updatedProduct.id ? updatedProduct : p);
    } else {
      nextList = [updatedProduct, ...products];
    }
    setProducts(nextList);
    await saveProductRecord(updatedProduct);
  };

  const handleDeleteProduct = async (productId: string) => {
    const nextList = products.filter(p => p.id !== productId);
    setProducts(nextList);
    await deleteProductRecord(productId);
  };

  const handleSaveSettings = async (newSettings: StoreSettings) => {
    setSettings(newSettings);
    await saveStoreSettings(newSettings);
  };

  // If not logged in, show Login Screen
  if (!session) {
    return (
      <LoginPageNative
        onLoginSuccess={handleLoginSuccess}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        storeName={settings.storeName}
      />
    );
  }

  const isDark = theme === 'dark';
  const role: Role = session.role;
  const isAdmin = role === 'ADMIN';

  return (
    <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Top Navbar */}
      <NavbarNative
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
        role={role}
        storeName={settings.storeName}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        session={session}
        onLogout={handleLogout}
      />

      {/* Main Tab Content */}
      {activeTab === 'billing' ? (
        <View style={styles.billingContainer}>
          {/* Sub-tab Navigation Bar: Search & Type | Barcode | Cart */}
          <View style={[styles.subTabBar, !isDark && styles.subTabBarLight]}>
            <TouchableOpacity
              style={[
                styles.subTabBtn,
                !isDark && styles.subTabBtnLight,
                billingSubTab === 'search' && styles.subTabBtnActiveSearch,
              ]}
              onPress={() => setBillingSubTab('search')}
            >
              <Text
                style={[
                  styles.subTabText,
                  !isDark && styles.subTabTextLight,
                  billingSubTab === 'search' && styles.subTabTextActive,
                ]}
              >
                🔍 Search & Type
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.subTabBtn,
                !isDark && styles.subTabBtnLight,
                billingSubTab === 'barcode' && styles.subTabBtnActiveBarcode,
              ]}
              onPress={() => setBillingSubTab('barcode')}
            >
              <Text
                style={[
                  styles.subTabText,
                  !isDark && styles.subTabTextLight,
                  billingSubTab === 'barcode' && styles.subTabTextActive,
                ]}
              >
                📷 Barcode
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.subTabBtn,
                !isDark && styles.subTabBtnLight,
                billingSubTab === 'cart' && styles.subTabBtnActiveCart,
              ]}
              onPress={() => setBillingSubTab('cart')}
            >
              <Text
                style={[
                  styles.subTabText,
                  !isDark && styles.subTabTextLight,
                  billingSubTab === 'cart' && styles.subTabTextActive,
                ]}
              >
                🛒 Cart ({cart.reduce((s, i) => s + i.quantity, 0)})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sub-tab View */}
          {billingSubTab === 'cart' ? (
            <View style={{ flex: 1 }}>
              <CartViewNative
                cart={cart}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={(id) => setCart(prev => prev.filter(i => i.product.id !== id))}
                onApplyLineDiscount={handleApplyLineDiscount}
                onClearCart={() => setCart([])}
                onProceedToCheckout={(details) => {
                  setCheckoutConfig(details);
                  setIsCheckoutOpen(true);
                }}
                onAddMoreItems={() => setBillingSubTab('search')}
                settings={settings}
                theme={theme}
              />
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <BarcodeScannerNative
                mode={billingSubTab}
                hideHeaderTabs={true}
                onScanSuccess={handleScanSuccess}
                onAddProduct={handleAddProduct}
                products={products}
                enableHaptics={settings.enableHaptics}
                currencySymbol={settings.currencySymbol}
                theme={theme}
                onGoToCart={() => setBillingSubTab('cart')}
                cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
                cartTotal={cart.reduce((sum, item) => {
                  const basePrice = item.product.price * item.quantity;
                  const disc = item.discountType === 'FLAT'
                    ? Math.min(item.discountValue || 0, basePrice)
                    : (basePrice * (item.discountPercent || item.discountValue || 0)) / 100;
                  return sum + (basePrice - disc);
                }, 0)}
              />
            </View>
          )}
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {/* Catalog & Stock - Admin Only */}
          {activeTab === 'inventory' && isAdmin && (
            <InventoryManagerNative
              products={products}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              settings={settings}
              theme={theme}
            />
          )}

          {/* Sales & Invoices Reports - Admin Only */}
          {activeTab === 'reports' && isAdmin && (
            <SalesReportsNative
              invoices={invoices}
              settings={settings}
              onViewInvoice={(inv) => setViewingInvoice(inv)}
              theme={theme}
            />
          )}

          {/* System Settings - Admin Only */}
          {activeTab === 'settings' && isAdmin && (
            <SettingsModalNative
              settings={settings}
              onSaveSettings={handleSaveSettings}
              role={role}
              theme={theme}
              onToggleTheme={handleToggleTheme}
            />
          )}
        </ScrollView>
      )}

      {/* Modals */}
      {isCheckoutOpen && (
        <CheckoutModalNative
          cart={cart}
          includeTax={checkoutConfig.includeTax}
          overallDiscountType={checkoutConfig.overallDiscountType}
          overallDiscountValue={checkoutConfig.overallDiscountValue}
          overallDiscountAmount={checkoutConfig.overallDiscountAmount}
          onClose={() => setIsCheckoutOpen(false)}
          onCompleteCheckout={handleCompleteCheckout}
          settings={settings}
          cashierName={session.displayName || (isAdmin ? 'Manager (Admin)' : 'Store Cashier')}
          theme={theme}
        />
      )}

      {viewingInvoice && (
        <ReceiptViewModalNative
          invoice={viewingInvoice}
          settings={settings}
          onClose={() => setViewingInvoice(null)}
          onNewBill={() => {
            setViewingInvoice(null);
            setActiveTab('billing');
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 28,
  },
  containerDark: {
    backgroundColor: '#020617',
  },
  containerLight: {
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    padding: 10,
  },
  billingContainer: {
    flex: 1,
    padding: 10,
  },
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    padding: 4,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 4,
  },
  subTabBarLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#020617',
  },
  subTabBtnLight: {
    backgroundColor: '#f1f5f9',
  },
  subTabBtnActiveSearch: {
    backgroundColor: '#059669',
  },
  subTabBtnActiveBarcode: {
    backgroundColor: '#4f46e5',
  },
  subTabBtnActiveCart: {
    backgroundColor: '#d97706',
  },
  subTabText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  subTabTextLight: {
    color: '#64748b',
  },
  subTabTextActive: {
    color: '#ffffff',
  },
});
