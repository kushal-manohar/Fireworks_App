import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, Modal, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Product, StoreSettings, ThemeMode } from '../types';

interface InventoryManagerProps {
  products: Product[];
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  settings: StoreSettings;
  theme?: ThemeMode;
}

export const InventoryManagerNative: React.FC<InventoryManagerProps> = ({
  products,
  onSaveProduct,
  onDeleteProduct,
  settings,
  theme = 'dark',
}) => {
  const isDark = theme !== 'light';
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // In-modal Camera Barcode Scanner State
  const [isScanningBarcode, setIsScanningBarcode] = useState<boolean>(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const categories = ['ALL', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesQuery = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.barcode.includes(searchQuery) ||
                         p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesQuery && matchesCat;
  });

  const handleOpenAddModal = () => {
    setEditingProduct({
      id: `prod-${Date.now()}`,
      barcode: `890${Math.floor(100000000 + Math.random() * 900000000)}`,
      name: '',
      category: 'General',
      price: 100,
      taxRate: 18,
      stock: 50,
      unit: 'pcs',
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct({ ...product });
    setIsModalOpen(true);
  };

  const handleFormSubmit = () => {
    if (!editingProduct?.name || !editingProduct?.barcode || !editingProduct?.price) {
      Alert.alert('Missing Details', 'Please fill in product name, barcode, and price.');
      return;
    }
    onSaveProduct(editingProduct as Product);
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  // Open camera scanner inside Add Product modal
  const handleStartCameraScan = async () => {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        Alert.alert('Camera Permission Required', 'Camera permission is needed to scan product barcodes.');
        return;
      }
    }
    setIsScanningBarcode(true);
  };

  // Barcode detected in Add Product modal
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (settings.enableHaptics) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setIsScanningBarcode(false);

    // Check if product already exists in database
    const existing = products.find(p => p.barcode === data);
    if (existing) {
      Alert.alert(
        'Product Found!',
        `Barcode "${data}" matches existing item "${existing.name}". Product details populated for editing.`
      );
      setEditingProduct({ ...existing });
    } else {
      setEditingProduct(prev => ({
        ...prev,
        barcode: data,
      }));
      Alert.alert('Barcode Scanned', `Scanned Barcode: ${data}\nFill in the remaining details and tap Save.`);
    }
  };

  return (
    <View style={[styles.container, !isDark && styles.containerLight]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, !isDark && { color: '#0f172a' }]}>Catalog & Stock Inventory</Text>
          <Text style={[styles.headerSubtitle, !isDark && { color: '#64748b' }]}>{products.length} Items Registered</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleOpenAddModal}>
          <Text style={styles.addBtnText}>+ Add Product</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchBox}>
        <TextInput
          style={[styles.searchInput, !isDark && styles.searchInputLight]}
          placeholder="Search by name, barcode, category..."
          placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Category Pills */}
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
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Product List */}
      <ScrollView style={styles.productList}>
        {filteredProducts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyText, !isDark && { color: '#64748b' }]}>No products found</Text>
          </View>
        ) : (
          filteredProducts.map((p) => (
            <View key={p.id} style={[styles.productCard, !isDark && styles.productCardLight]}>
              <View style={styles.cardMain}>
                <View style={styles.badgeRow}>
                  <Text style={styles.catBadge}>{p.category}</Text>
                  <Text style={[styles.barcodeText, !isDark && { color: '#64748b' }]}>{p.barcode}</Text>
                </View>
                <Text style={[styles.prodTitle, !isDark && { color: '#0f172a' }]}>{p.name}</Text>
                <Text style={styles.prodDetails}>
                  {settings.currencySymbol}{p.price.toFixed(2)} / {p.unit} • Tax: {p.taxRate === 0 ? '0% (Tax Free)' : `${p.taxRate}%`} • Stock: {p.stock}
                </Text>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.editBtn, !isDark && styles.editBtnLight]} onPress={() => handleOpenEditModal(p)}>
                  <Text style={[styles.editBtnText, !isDark && { color: '#4f46e5' }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteBtn, !isDark && styles.deleteBtnLight]}
                  onPress={() => {
                    Alert.alert('Delete Product', `Remove "${p.name}"?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => onDeleteProduct(p.id) },
                    ]);
                  }}
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add/Edit Product Modal */}
      {isModalOpen && editingProduct && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContent, !isDark && styles.modalContentLight]}>
              <View style={[styles.modalHeader, !isDark && styles.modalHeaderLight]}>
                <Text style={[styles.modalTitle, !isDark && { color: '#0f172a' }]}>
                  {products.some(p => p.id === editingProduct.id) ? 'Edit Product' : 'Add New Product'}
                </Text>
                <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                  <Text style={[styles.modalCloseText, !isDark && { color: '#64748b' }]}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Live Camera Scanner Overlay inside modal */}
              {isScanningBarcode ? (
                <View style={[styles.scanOverlayBox, !isDark && { backgroundColor: '#f8fafc' }]}>
                  <Text style={[styles.scanOverlayTitle, !isDark && { color: '#0f172a' }]}>Point camera at product barcode</Text>
                  <CameraView
                    style={styles.modalCamera}
                    onBarcodeScanned={handleBarcodeScanned}
                    barcodeScannerSettings={{
                      barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
                    }}
                  />
                  <TouchableOpacity
                    style={[styles.cancelScanBtn, !isDark && { backgroundColor: '#e2e8f0' }]}
                    onPress={() => setIsScanningBarcode(false)}
                  >
                    <Text style={styles.cancelScanBtnText}>Cancel Camera Scanner</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView style={styles.formBody}>
                  {/* Barcode input with SCAN BARCODE Button */}
                  <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Product Barcode ID:</Text>
                  <View style={styles.barcodeInputRow}>
                    <TextInput
                      style={[styles.input, styles.barcodeInput, !isDark && styles.inputLight]}
                      value={editingProduct.barcode || ''}
                      onChangeText={(val) => setEditingProduct({ ...editingProduct, barcode: val })}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity style={styles.scanBtn} onPress={handleStartCameraScan}>
                      <Text style={styles.scanBtnText}>📷 Scan Barcode</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Product Name:</Text>
                  <TextInput
                    style={[styles.input, !isDark && styles.inputLight]}
                    value={editingProduct.name || ''}
                    onChangeText={(val) => setEditingProduct({ ...editingProduct, name: val })}
                    placeholder="e.g. 10cm Electric Sparklers"
                    placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                  />

                  <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Category:</Text>
                  <TextInput
                    style={[styles.input, !isDark && styles.inputLight]}
                    value={editingProduct.category || ''}
                    onChangeText={(val) => setEditingProduct({ ...editingProduct, category: val })}
                  />

                  <View style={styles.gridRow}>
                    <View style={styles.gridCol}>
                      <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Price ({settings.currencySymbol}):</Text>
                      <TextInput
                        style={[styles.input, !isDark && styles.inputLight]}
                        value={editingProduct.price ? editingProduct.price.toString() : ''}
                        onChangeText={(val) => setEditingProduct({ ...editingProduct, price: parseFloat(val) || 0 })}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.gridCol}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Tax Rate (%):</Text>
                        {editingProduct.taxRate === 0 && (
                          <Text style={{ fontSize: 9, color: '#10b981', fontWeight: 'bold' }}>0% Free</Text>
                        )}
                      </View>
                      <TextInput
                        style={[styles.input, !isDark && styles.inputLight]}
                        value={editingProduct.taxRate !== undefined && editingProduct.taxRate !== null ? editingProduct.taxRate.toString() : '0'}
                        onChangeText={(val) => {
                          const num = val === '' ? 0 : parseFloat(val);
                          setEditingProduct({ ...editingProduct, taxRate: isNaN(num) ? 0 : num });
                        }}
                        keyboardType="numeric"
                      />
                      <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                        {[0, 5, 12, 18, 28].map((rate) => (
                          <TouchableOpacity
                            key={rate}
                            onPress={() => setEditingProduct({ ...editingProduct, taxRate: rate })}
                            style={{
                              flex: 1,
                              paddingVertical: 3,
                              borderRadius: 4,
                              backgroundColor: editingProduct.taxRate === rate
                                ? (rate === 0 ? '#059669' : '#4f46e5')
                                : (!isDark ? '#e2e8f0' : '#1e293b'),
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{
                              fontSize: 9,
                              fontWeight: 'bold',
                              color: editingProduct.taxRate === rate ? '#ffffff' : (!isDark ? '#334155' : '#94a3b8')
                            }}>{rate}%</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={styles.gridRow}>
                    <View style={styles.gridCol}>
                      <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Stock Quantity:</Text>
                      <TextInput
                        style={[styles.input, !isDark && styles.inputLight]}
                        value={editingProduct.stock ? editingProduct.stock.toString() : '50'}
                        onChangeText={(val) => setEditingProduct({ ...editingProduct, stock: parseInt(val, 10) || 0 })}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.gridCol}>
                      <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Unit:</Text>
                      <TextInput
                        style={[styles.input, !isDark && styles.inputLight]}
                        value={editingProduct.unit || 'pcs'}
                        onChangeText={(val) => setEditingProduct({ ...editingProduct, unit: val })}
                      />
                    </View>
                  </View>

                  <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleFormSubmit}>
                    <Text style={styles.saveSubmitText}>Save Product Details</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      )}
    </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
  },
  addBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 11,
  },
  searchBox: {
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 12,
  },
  catScroll: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  catPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#020617',
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  catPillActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  catPillText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  catPillTextActive: {
    color: '#ffffff',
  },
  productList: {
    maxHeight: 380,
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12,
  },
  productCard: {
    backgroundColor: '#020617',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMain: {
    flex: 1,
    marginRight: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  catBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    color: '#818cf8',
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 6,
  },
  barcodeText: {
    color: '#64748b',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  prodTitle: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: 'bold',
  },
  prodDetails: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
  },
  editBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 4,
  },
  editBtnText: {
    color: '#818cf8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  deleteBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  deleteBtnText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalBackdrop: {
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
    maxHeight: '88%',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 14,
    backgroundColor: '#020617',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalCloseText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  formBody: {
    padding: 14,
  },
  barcodeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  barcodeInput: {
    flex: 1,
    marginBottom: 0,
    marginRight: 8,
    fontFamily: 'monospace',
  },
  scanBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
  },
  scanBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  scanOverlayBox: {
    padding: 16,
    alignItems: 'center',
  },
  scanOverlayTitle: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalCamera: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cancelScanBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cancelScanBtnText: {
    color: '#f87171',
    fontWeight: 'bold',
    fontSize: 12,
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 12,
    marginBottom: 10,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridCol: {
    flex: 1,
    marginRight: 6,
  },
  saveSubmitBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  saveSubmitText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  containerLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
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
  productCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  editBtnLight: {
    backgroundColor: '#e0e7ff',
  },
  deleteBtnLight: {
    backgroundColor: '#fee2e2',
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
});
