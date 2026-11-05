import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, ScrollView, Linking, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Invoice, StoreSettings } from '../types';

interface ReceiptViewModalProps {
  invoice: Invoice;
  settings: StoreSettings;
  onClose: () => void;
  onNewBill: () => void;
}

export const ReceiptViewModalNative: React.FC<ReceiptViewModalProps> = ({
  invoice,
  settings,
  onClose,
  onNewBill,
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const getReceiptHTML = () => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <style>
          body {
            font-family: 'Courier New', Courier, monospace;
            padding: 15px;
            font-size: 12px;
            color: #1e293b;
            max-width: 320px;
            margin: 0 auto;
            background-color: #ffffff;
          }
          .header { text-align: center; margin-bottom: 12px; border-bottom: 1px dashed #64748b; padding-bottom: 8px; }
          .store-name { font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 0; }
          .sub { font-size: 10px; color: #475569; margin: 2px 0; }
          .meta { font-size: 11px; margin-bottom: 10px; border-bottom: 1px dashed #64748b; padding-bottom: 6px; }
          .meta-row { display: flex; justify-content: space-between; margin: 2px 0; }
          .table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          .table th { text-align: left; font-size: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
          .table td { padding: 4px 0; font-size: 11px; vertical-align: top; }
          .right { text-align: right; }
          .center { text-align: center; }
          .totals { border-top: 1px dashed #64748b; border-bottom: 1px dashed #64748b; padding: 8px 0; margin-top: 6px; }
          .total-row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 11px; }
          .grand-total { font-size: 14px; font-weight: bold; margin-top: 6px; border-top: 1px solid #000; padding-top: 4px; }
          .footer { text-align: center; font-size: 10px; color: #64748b; margin-top: 14px; }
          .barcode { text-align: center; letter-spacing: 4px; font-weight: bold; margin-top: 8px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="store-name">${settings.storeName}</div>
          ${settings.address ? `<div class="sub">${settings.address}</div>` : ''}
          <div class="sub">Ph: ${settings.phone} | GST: ${settings.gstin}</div>
        </div>

        <div class="meta">
          <div class="meta-row"><span>INVOICE:</span> <strong>${invoice.id}</strong></div>
          <div class="meta-row"><span>DATE:</span> <span>${new Date(invoice.timestamp).toLocaleString()}</span></div>
          <div class="meta-row"><span>CASHIER:</span> <span>${invoice.cashierName}</span></div>
          ${invoice.customerName ? `<div class="meta-row"><span>CUSTOMER:</span> <span>${invoice.customerName}</span></div>` : ''}
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>ITEM</th>
              <th class="center">QTY</th>
              <th class="right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td class="center">x${item.quantity}</td>
                <td class="right">${settings.currencySymbol}${item.lineTotal.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row"><span>Subtotal:</span> <span>${settings.currencySymbol}${invoice.subtotal.toFixed(2)}</span></div>
          <div class="total-row"><span>Tax Total:</span> <span>${invoice.includeTax === false ? '0% Tax Free (₹0.00)' : `${settings.currencySymbol}${invoice.taxTotal.toFixed(2)}`}</span></div>
          ${invoice.discountTotal > 0 ? `<div class="total-row" style="color: #c2410c"><span>Discount ${invoice.overallDiscountValue ? `(${invoice.overallDiscountType === 'FLAT' ? `${settings.currencySymbol}${invoice.overallDiscountValue}` : `${invoice.overallDiscountValue}%`})` : ''}:</span> <span>-${settings.currencySymbol}${invoice.discountTotal.toFixed(2)}</span></div>` : ''}
          <div class="total-row grand-total"><span>GRAND TOTAL:</span> <span>${settings.currencySymbol}${invoice.grandTotal.toFixed(2)}</span></div>
        </div>

        <div style="font-size: 10px; margin-top: 6px;">
          <div class="meta-row"><span>Payment Mode:</span> <strong>${invoice.paymentMethod}</strong></div>
          ${invoice.cashTendered ? `
            <div class="meta-row"><span>Tendered:</span> <span>${settings.currencySymbol}${invoice.cashTendered.toFixed(2)}</span></div>
            <div class="meta-row"><span>Change Returned:</span> <span>${settings.currencySymbol}${(invoice.changeDue || 0).toFixed(2)}</span></div>
          ` : ''}
        </div>

        <div class="footer">
          <p>${settings.receiptFooter || 'Thank you for shopping with us!'}</p>
          <div class="barcode">|||| ||| ||||||| |||</div>
        </div>
      </body>
    </html>
  `;

  // Native Print Dialog Trigger
  const handlePrint = async () => {
    try {
      setIsProcessing(true);
      const html = getReceiptHTML();
      await Print.printAsync({ html });
    } catch (e: any) {
      console.warn('Print error:', e);
      Alert.alert('Print Error', e?.message || 'Could not trigger print dialog.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Export PDF & Share sheet
  const handleExportPDF = async () => {
    try {
      setIsProcessing(true);
      const html = getReceiptHTML();
      const { uri: tempUri } = await Print.printToFileAsync({ html });

      // Copy file to FileSystem.cacheDirectory so Android FileProvider / getContentUriAsync can access it with full permissions
      const cleanInvoiceId = (invoice.id || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');
      const targetUri = `${FileSystem.cacheDirectory}Invoice_${cleanInvoiceId}.pdf`;
      
      let pdfUriToShare = tempUri;
      try {
        const info = await FileSystem.getInfoAsync(targetUri);
        if (info.exists) {
          await FileSystem.deleteAsync(targetUri, { idempotent: true });
        }
        await FileSystem.copyAsync({
          from: tempUri,
          to: targetUri,
        });
        pdfUriToShare = targetUri;
      } catch (copyErr) {
        console.warn('Could not copy PDF file to cache root, using tempUri fallback:', copyErr);
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUriToShare, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Invoice ${invoice.id}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Print.printAsync({ html });
      }
    } catch (e: any) {
      console.warn('PDF export fallback to Print:', e);
      try {
        await Print.printAsync({ html: getReceiptHTML() });
      } catch (err) {
        Alert.alert('PDF Export Error', e?.message || 'Failed to generate PDF file.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShareWhatsApp = () => {
    const itemsText = invoice.items
      .map(i => `• ${i.name} x${i.quantity} = ${settings.currencySymbol}${i.lineTotal.toFixed(2)}`)
      .join('\n');

    const text = `🧾 *RECEIPT FROM ${settings.storeName.toUpperCase()}*\n` +
      `Invoice: *${invoice.id}*\n` +
      `Date: ${new Date(invoice.timestamp).toLocaleDateString()}\n\n` +
      `*ITEMS:*\n${itemsText}\n\n` +
      `Subtotal: ${settings.currencySymbol}${invoice.subtotal.toFixed(2)}\n` +
      `Tax: ${settings.currencySymbol}${invoice.taxTotal.toFixed(2)}\n` +
      `*GRAND TOTAL: ${settings.currencySymbol}${invoice.grandTotal.toFixed(2)}*\n\n` +
      `Payment Mode: ${invoice.paymentMethod}\n\n` +
      `Thank you for shopping with us!`;

    const encoded = encodeURIComponent(text);
    const whatsappUrl = invoice.customerPhone
      ? `https://wa.me/${invoice.customerPhone.replace(/[^0-9]/g, '')}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    Linking.openURL(whatsappUrl).catch(() => {
      Alert.alert('WhatsApp Error', 'Could not open WhatsApp. Ensure WhatsApp is installed.');
    });
  };

  return (
    <Modal visible animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bill Completed ({invoice.id})</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Thermal slip view */}
          <ScrollView style={styles.slipContainer}>
            <View style={styles.slip}>
              <Text style={styles.storeName}>{settings.storeName}</Text>
              {settings.address ? <Text style={styles.storeAddress}>{settings.address}</Text> : null}
              <Text style={styles.storePhone}>Ph: {settings.phone} | GST: {settings.gstin}</Text>

              <View style={styles.divider} />

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>INVOICE #:</Text>
                <Text style={styles.metaValue}>{invoice.id}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>DATE:</Text>
                <Text style={styles.metaValue}>{new Date(invoice.timestamp).toLocaleString()}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>CASHIER:</Text>
                <Text style={styles.metaValue}>{invoice.cashierName}</Text>
              </View>

              <View style={styles.divider} />

              {invoice.items.map((item, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQty}>x{item.quantity}</Text>
                  <Text style={styles.itemTotal}>{settings.currencySymbol}{item.lineTotal.toFixed(2)}</Text>
                </View>
              ))}

              <View style={styles.divider} />

              <View style={styles.subRow}>
                <Text style={styles.subLabel}>Subtotal:</Text>
                <Text style={styles.subVal}>{settings.currencySymbol}{invoice.subtotal.toFixed(2)}</Text>
              </View>

              <View style={styles.subRow}>
                <Text style={styles.subLabel}>Tax Total:</Text>
                <Text style={[styles.subVal, invoice.includeTax === false && styles.taxFreeVal]}>
                  {invoice.includeTax === false ? '0% Tax Free' : `${settings.currencySymbol}${invoice.taxTotal.toFixed(2)}`}
                </Text>
              </View>

              {invoice.discountTotal > 0 && (
                <View style={styles.subRow}>
                  <Text style={styles.discLabel}>
                    Discount {invoice.overallDiscountValue ? `(${invoice.overallDiscountType === 'FLAT' ? `${settings.currencySymbol}${invoice.overallDiscountValue}` : `${invoice.overallDiscountValue}%`})` : ''}:
                  </Text>
                  <Text style={styles.discVal}>-{settings.currencySymbol}{invoice.discountTotal.toFixed(2)}</Text>
                </View>
              )}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>GRAND TOTAL:</Text>
                <Text style={styles.totalValue}>{settings.currencySymbol}{invoice.grandTotal.toFixed(2)}</Text>
              </View>

              <Text style={styles.footerText}>{settings.receiptFooter}</Text>
            </View>
          </ScrollView>

          {/* Action Sheet */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#4f46e5' }]}
              onPress={handlePrint}
              disabled={isProcessing}
            >
              <Text style={styles.actionBtnText}>🖨️ Print</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#0284c7' }]}
              onPress={handleExportPDF}
              disabled={isProcessing}
            >
              <Text style={styles.actionBtnText}>📄 Save PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#10b981' }]}
              onPress={handleShareWhatsApp}
              disabled={isProcessing}
            >
              <Text style={styles.actionBtnText}>💬 WhatsApp</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.newBillBtn} onPress={onNewBill}>
            <Text style={styles.newBillBtnText}>⚡ Start Next Bill</Text>
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
    maxHeight: '88%',
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
    fontSize: 15,
    fontWeight: 'bold',
  },
  closeBtn: {
    color: '#94a3b8',
    fontSize: 18,
  },
  slipContainer: {
    padding: 16,
  },
  slip: {
    backgroundColor: '#fffbeb',
    padding: 16,
    borderRadius: 8,
  },
  storeName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
  },
  storeAddress: {
    fontSize: 10,
    color: '#475569',
    textAlign: 'center',
    marginTop: 2,
  },
  storePhone: {
    fontSize: 10,
    color: '#475569',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#cbd5e1',
    marginVertical: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  metaLabel: {
    fontSize: 10,
    color: '#475569',
  },
  metaValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemName: {
    flex: 1,
    fontSize: 11,
    color: '#0f172a',
  },
  itemQty: {
    fontSize: 11,
    color: '#475569',
    paddingHorizontal: 8,
  },
  itemTotal: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  subLabel: {
    fontSize: 10,
    color: '#475569',
  },
  subVal: {
    fontSize: 10,
    fontWeight: '500',
    color: '#0f172a',
  },
  taxFreeVal: {
    color: '#047857',
    fontWeight: 'bold',
  },
  discLabel: {
    fontSize: 10,
    color: '#c2410c',
  },
  discVal: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#c2410c',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    paddingTop: 4,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  totalValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#047857',
  },
  footerText: {
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    padding: 12,
    justifyContent: 'space-between',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  actionBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 11,
  },
  newBillBtn: {
    backgroundColor: '#d97706',
    paddingVertical: 14,
    alignItems: 'center',
  },
  newBillBtnText: {
    color: '#020617',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
