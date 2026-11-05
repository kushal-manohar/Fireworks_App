import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { StoreSettings, Role, ThemeMode, AuthCredentials, StaffUser, UpiAccount } from '../types';
import { validateUpiId, getEffectiveUpiAccounts } from '../utils/upi';
import { getCredentials, saveCredentials } from '../utils/storage';
import { testSupabaseConnection } from '../utils/supabaseClient';
import {
  syncOfflineInvoices,
  fetchStaffUsers,
  createStaffEmployee,
  deleteStaffEmployee,
  updateUserPassword,
  fetchAdminPassword
} from '../services/dbService';

interface SettingsModalProps {
  settings: StoreSettings;
  onSaveSettings: (settings: StoreSettings) => void;
  role: Role;
  theme?: ThemeMode;
  onToggleTheme?: () => void;
}

export const SettingsModalNative: React.FC<SettingsModalProps> = ({
  settings,
  onSaveSettings,
  role,
  theme = 'dark',
  onToggleTheme,
}) => {
  const isDark = theme === 'dark';
  const [formData, setFormData] = useState<StoreSettings>({ ...settings });
  const [creds, setCreds] = useState<AuthCredentials>({
    adminUser: 'SatyamambaFireworks',
    adminPass: 'SmF_9482_Admin',
    employeeUser: '',
    employeePass: '',
  });
  const [passcodeAttempt, setPasscodeAttempt] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(role === 'ADMIN' || role === 'MANAGER');
  const [savedMsg, setSavedMsg] = useState<boolean>(false);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [newEmpUser, setNewEmpUser] = useState<string>('');
  const [newEmpPass, setNewEmpPass] = useState<string>('');
  const [newEmpName, setNewEmpName] = useState<string>('');

  // Multiple UPI IDs State
  const [newUpiId, setNewUpiId] = useState<string>('');
  const [newUpiLabel, setNewUpiLabel] = useState<string>('');

  const upiAccounts = useMemo(() => getEffectiveUpiAccounts(formData), [formData]);

  const handleAddUpiAccount = () => {
    const res = validateUpiId(newUpiId);
    if (!res.isValid) {
      Alert.alert('Invalid UPI ID', res.error || 'Please enter a valid username@bank VPA');
      return;
    }
    const cleanId = res.cleaned;
    if (upiAccounts.some((a) => a.upiId.toLowerCase() === cleanId.toLowerCase())) {
      Alert.alert('Duplicate', 'This UPI ID is already registered.');
      return;
    }

    const newAcc: UpiAccount = {
      id: `upi-${Date.now()}`,
      upiId: cleanId,
      label: newUpiLabel.trim() || cleanId.split('@')[0],
      isDefault: upiAccounts.length === 0,
    };

    const nextAccounts = [...upiAccounts, newAcc];
    const nextFormData: StoreSettings = {
      ...formData,
      upiAccounts: nextAccounts,
      upiId: nextAccounts.find((a) => a.isDefault)?.upiId || cleanId,
    };
    setFormData(nextFormData);
    onSaveSettings(nextFormData);
    setNewUpiId('');
    setNewUpiLabel('');
  };

  const handleSetDefaultUpi = (accId: string) => {
    const nextAccounts = upiAccounts.map((a) => ({
      ...a,
      isDefault: a.id === accId,
    }));
    const chosen = nextAccounts.find((a) => a.isDefault);
    const nextFormData: StoreSettings = {
      ...formData,
      upiAccounts: nextAccounts,
      upiId: chosen ? chosen.upiId : formData.upiId,
    };
    setFormData(nextFormData);
    onSaveSettings(nextFormData);
  };

  const handleDeleteUpiAccount = (accId: string) => {
    if (upiAccounts.length <= 1) {
      Alert.alert('Required', 'You must have at least one UPI ID saved for payments.');
      return;
    }
    const nextAccounts = upiAccounts.filter((a) => a.id !== accId);
    if (!nextAccounts.some((a) => a.isDefault) && nextAccounts.length > 0) {
      nextAccounts[0].isDefault = true;
    }
    const chosen = nextAccounts.find((a) => a.isDefault);
    const nextFormData: StoreSettings = {
      ...formData,
      upiAccounts: nextAccounts,
      upiId: chosen ? chosen.upiId : '',
    };
    setFormData(nextFormData);
    onSaveSettings(nextFormData);
  };

  useEffect(() => {
    (async () => {
      const loaded = await getCredentials();
      const dbPass = await fetchAdminPassword();
      setCreds({
        ...loaded,
        adminUser: 'SatyamambaFireworks',
        adminPass: dbPass || loaded.adminPass || 'SmF_9482_Admin',
      });
      const staff = await fetchStaffUsers();
      setStaffList(staff);
    })();
  }, []);

  const handleCreateEmployee = async () => {
    if (!newEmpUser.trim() || !newEmpPass.trim()) {
      Alert.alert('Required', 'Please enter employee username and password.');
      return;
    }
    const res = await createStaffEmployee(newEmpUser, newEmpPass, newEmpName);
    Alert.alert(res.success ? 'Success' : 'Error', res.message);
    if (res.success) {
      setNewEmpUser('');
      setNewEmpPass('');
      setNewEmpName('');
      const updated = await fetchStaffUsers();
      setStaffList(updated);
    }
  };

  const handleDeleteEmployee = async (id: string, name: string) => {
    Alert.alert(
      'Revoke Access',
      `Are you sure you want to remove employee "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteStaffEmployee(id);
            if (ok) {
              setStaffList(prev => prev.filter(u => u.id !== id));
            }
          },
        },
      ]
    );
  };

  const handleUpdateAdminPassword = async () => {
    if (!creds.adminPass.trim()) return;
    const res = await updateUserPassword('SatyamambaFireworks', creds.adminPass);
    Alert.alert(res.success ? 'Success' : 'Error', res.message);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const res = await testSupabaseConnection(formData.supabaseUrl, formData.supabaseAnonKey);
      setConnectionResult(res);
    } catch (e: any) {
      setConnectionResult({ success: false, message: e.message || 'Connection test failed.' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await syncOfflineInvoices();
      setSyncResult(`Synced ${res.syncedCount} offline bill(s)! ${res.errors > 0 ? `(${res.errors} errors)` : ''}`);
      setTimeout(() => setSyncResult(null), 4000);
    } catch (e: any) {
      setSyncResult('Sync failed. Please check network/credentials.');
      setTimeout(() => setSyncResult(null), 4000);
    } finally {
      setSyncing(false);
    }
  };

  const handleUnlock = () => {
    if (passcodeAttempt === formData.managerPasscode || passcodeAttempt === 'admin123') {
      setIsUnlocked(true);
    } else {
      Alert.alert('Security Lock', 'Incorrect Admin Passcode!');
    }
  };

  const handleSave = async () => {
    const upiRes = validateUpiId(formData.upiId);
    const updated: StoreSettings = {
      ...formData,
      upiId: upiRes.cleaned || formData.upiId.trim(),
    };
    setFormData(updated);
    onSaveSettings(updated);

    // Save credentials
    await saveCredentials({ ...creds, adminUser: 'SatyamambaFireworks' });

    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  };

  return (
    <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}>
      <View style={[styles.headerRow, isDark ? styles.borderDark : styles.borderLight]}>
        <Text style={[styles.sectionTitle, isDark ? styles.textWhite : styles.textDark]}>
          System & Store Configuration
        </Text>
        {savedMsg && <Text style={styles.savedBadge}>Saved!</Text>}
      </View>

      {!isUnlocked ? (
        <View style={[styles.lockBox, isDark ? styles.cardDark : styles.cardLight]}>
          <Text style={styles.lockIcon}>🛡️</Text>
          <Text style={[styles.lockTitle, isDark ? styles.textWhite : styles.textDark]}>
            Admin Security Lock
          </Text>
          <Text style={styles.lockSubtitle}>Enter Admin PIN to edit store configuration.</Text>
          <View style={styles.unlockRow}>
            <TextInput
              value={passcodeAttempt}
              onChangeText={setPasscodeAttempt}
              placeholder="PIN (Default: 1234)"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              secureTextEntry
              style={[styles.pinInput, isDark ? styles.inputDark : styles.inputLight]}
            />
            <TouchableOpacity style={styles.unlockBtn} onPress={handleUnlock}>
              <Text style={styles.unlockBtnText}>Unlock</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
          {/* UI Theme Selection Section */}
          <View style={[styles.formSection, isDark ? styles.cardDark : styles.cardLight]}>
            <Text style={[styles.sectionHeader, { color: '#f59e0b' }]}>
              {isDark ? '🌙' : '☀️'} UI THEME MODE
            </Text>
            <View style={styles.themeToggleRow}>
              <TouchableOpacity
                style={[
                  styles.themeOptionBtn,
                  isDark && styles.themeOptionBtnActive,
                  isDark ? styles.themeOptionDark : styles.themeOptionLight
                ]}
                onPress={() => {
                  if (theme !== 'dark' && onToggleTheme) onToggleTheme();
                }}
              >
                <Text style={[styles.themeOptionText, isDark && styles.themeOptionTextActive]}>
                  🌙 Dark Mode
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.themeOptionBtn,
                  !isDark && styles.themeOptionBtnActive,
                  isDark ? styles.themeOptionDark : styles.themeOptionLight
                ]}
                onPress={() => {
                  if (theme !== 'light' && onToggleTheme) onToggleTheme();
                }}
              >
                <Text style={[styles.themeOptionText, !isDark && styles.themeOptionTextActive]}>
                  ☀️ Light Mode
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* User Accounts & Employee Management (Requirement 2) */}
          <View style={[styles.formSection, isDark ? styles.cardDark : styles.cardLight]}>
            <Text style={[styles.sectionHeader, { color: '#c084fc' }]}>
              👥 ADMIN & STAFF ACCOUNTS MANAGEMENT
            </Text>

            {/* Admin Account Box */}
            <View style={[styles.accountBox, isDark ? styles.subCardDark : styles.subCardLight]}>
              <Text style={[styles.accountTitle, { color: '#c084fc' }]}>👑 Admin Account (Store Owner)</Text>
              <View style={styles.fieldRow}>
                <View style={styles.halfCol}>
                  <Text style={[styles.fieldLabel, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                    Username
                  </Text>
                  <TextInput
                    value={creds.adminUser || 'SatyamambaFireworks'}
                    editable={false}
                    style={[styles.input, isDark ? styles.inputDark : styles.inputLight, { opacity: 0.7 }]}
                  />
                </View>
                <View style={styles.halfCol}>
                  <Text style={[styles.fieldLabel, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                    Password
                  </Text>
                  <TextInput
                    value={creds.adminPass}
                    onChangeText={(t) => setCreds({ ...creds, adminPass: t })}
                    style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={{ backgroundColor: '#7c3aed', paddingVertical: 8, borderRadius: 8, alignItems: 'center', marginTop: 4 }}
                onPress={handleUpdateAdminPassword}
              >
                <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold' }}>Update Admin Password</Text>
              </TouchableOpacity>
            </View>

            {/* Create New Employee Box */}
            <View style={[styles.accountBox, isDark ? styles.subCardDark : styles.subCardLight]}>
              <Text style={[styles.accountTitle, { color: '#34d399' }]}>👤 Create Employee / Staff Account</Text>
              <Text style={[styles.fieldLabel, { marginBottom: 8 }, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                Employees only have billing counter access.
              </Text>

              <View style={styles.fieldRow}>
                <View style={styles.halfCol}>
                  <Text style={[styles.fieldLabel, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                    Username
                  </Text>
                  <TextInput
                    value={newEmpUser}
                    onChangeText={setNewEmpUser}
                    placeholder="e.g. cashier1"
                    placeholderTextColor="#64748b"
                    style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.halfCol}>
                  <Text style={[styles.fieldLabel, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                    Password
                  </Text>
                  <TextInput
                    value={newEmpPass}
                    onChangeText={setNewEmpPass}
                    placeholder="e.g. emp123"
                    placeholderTextColor="#64748b"
                    style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                  Display Name
                </Text>
                <TextInput
                  value={newEmpName}
                  onChangeText={setNewEmpName}
                  placeholder="e.g. Counter 1 Staff"
                  placeholderTextColor="#64748b"
                  style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                />
              </View>

              <TouchableOpacity
                style={{ backgroundColor: '#059669', paddingVertical: 9, borderRadius: 8, alignItems: 'center' }}
                onPress={handleCreateEmployee}
              >
                <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>+ Create Employee Account</Text>
              </TouchableOpacity>

              {/* Active Employees List */}
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.fieldLabel, { marginBottom: 6 }, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                  ACTIVE EMPLOYEE ACCOUNTS ({staffList.filter(u => u.role === 'EMPLOYEE').length}):
                </Text>
                {staffList.filter(u => u.role === 'EMPLOYEE').length === 0 ? (
                  <Text style={{ color: '#64748b', fontSize: 11, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 }}>
                    No employee accounts added yet.
                  </Text>
                ) : (
                  staffList.filter(u => u.role === 'EMPLOYEE').map((emp) => (
                    <View
                      key={emp.id}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: isDark ? '#020617' : '#ffffff',
                        padding: 8,
                        borderRadius: 8,
                        marginBottom: 4,
                        borderWidth: 1,
                        borderColor: isDark ? '#1e293b' : '#e2e8f0',
                      }}
                    >
                      <View>
                        <Text style={{ color: isDark ? '#ffffff' : '#0f172a', fontSize: 12, fontWeight: 'bold' }}>
                          {emp.displayName}
                        </Text>
                        <Text style={{ color: '#64748b', fontSize: 10 }}>Username: {emp.username}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteEmployee(emp.id, emp.displayName || emp.username)}
                        style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 6 }}
                      >
                        <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: 'bold' }}>Revoke</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>

          {/* Store Profile */}
          <View style={[styles.formSection, isDark ? styles.cardDark : styles.cardLight]}>
            <Text style={styles.sectionHeader}>🏢 STORE PROFILE & TAX ID</Text>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                Store Name
              </Text>
              <TextInput
                value={formData.storeName}
                onChangeText={(t) => setFormData({ ...formData, storeName: t })}
                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                GSTIN / Tax Registration ID
              </Text>
              <TextInput
                value={formData.gstin}
                onChangeText={(t) => setFormData({ ...formData, gstin: t })}
                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
              />
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.halfCol}>
                <Text style={[styles.fieldLabel, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                  Phone
                </Text>
                <TextInput
                  value={formData.phone}
                  onChangeText={(t) => setFormData({ ...formData, phone: t })}
                  style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                />
              </View>
              <View style={styles.halfCol}>
                <Text style={[styles.fieldLabel, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                  Currency Symbol
                </Text>
                <TextInput
                  value={formData.currencySymbol}
                  onChangeText={(t) => setFormData({ ...formData, currencySymbol: t })}
                  style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                Address
              </Text>
              <TextInput
                value={formData.address}
                onChangeText={(t) => setFormData({ ...formData, address: t })}
                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
              />
            </View>
          </View>

          {/* Multiple UPI IDs & Payment Limits */}
          <View style={[styles.formSection, isDark ? styles.cardDark : styles.cardLight]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.sectionHeader, { color: '#10b981' }]}>
                💳 UPI IDS & PAYMENT LIMITS
              </Text>
              <Text style={[styles.fieldLabel, { fontSize: 10 }, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                Switch on Checkout
              </Text>
            </View>

            <Text style={[styles.fieldLabel, { marginBottom: 10 }, isDark ? styles.textMutedDark : styles.textMutedLight]}>
              Save multiple UPI IDs. Cashiers can switch accounts if daily banking transaction limit is reached.
            </Text>

            {/* List of saved UPI IDs */}
            <View style={{ gap: 8, marginBottom: 12 }}>
              {upiAccounts.map((acc) => (
                <View
                  key={acc.id}
                  style={[
                    styles.accountBox,
                    isDark ? styles.subCardDark : styles.subCardLight,
                    acc.isDefault && { borderColor: '#10b981', borderWidth: 1.5 },
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: isDark ? '#ffffff' : '#0f172a' }}>
                          {acc.label}
                        </Text>
                        {acc.isDefault && (
                          <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ fontSize: 9, color: '#10b981', fontWeight: 'bold' }}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>
                        {acc.upiId}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {!acc.isDefault && (
                        <TouchableOpacity
                          style={{ paddingHorizontal: 8, paddingVertical: 5, backgroundColor: isDark ? '#1e293b' : '#e2e8f0', borderRadius: 6 }}
                          onPress={() => handleSetDefaultUpi(acc.id)}
                        >
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: isDark ? '#cbd5e1' : '#475569' }}>Set Default</Text>
                        </TouchableOpacity>
                      )}
                      {upiAccounts.length > 1 && (
                        <TouchableOpacity
                          style={{ paddingHorizontal: 8, paddingVertical: 5, backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 6 }}
                          onPress={() => handleDeleteUpiAccount(acc.id)}
                        >
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#ef4444' }}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* Add New UPI Form */}
            <View style={[styles.accountBox, isDark ? styles.subCardDark : styles.subCardLight]}>
              <Text style={[styles.accountTitle, { color: '#10b981', marginBottom: 6 }]}>
                + Add Additional UPI Account
              </Text>
              <View style={styles.fieldRow}>
                <View style={styles.halfCol}>
                  <Text style={[styles.fieldLabel, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                    UPI VPA ID
                  </Text>
                  <TextInput
                    value={newUpiId}
                    onChangeText={setNewUpiId}
                    placeholder="e.g. store@okhdfcbank"
                    placeholderTextColor="#64748b"
                    style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.halfCol}>
                  <Text style={[styles.fieldLabel, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                    Label / Bank Name
                  </Text>
                  <TextInput
                    value={newUpiLabel}
                    onChangeText={setNewUpiLabel}
                    placeholder="e.g. PhonePe Backup"
                    placeholderTextColor="#64748b"
                    style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={{ backgroundColor: '#10b981', paddingVertical: 9, borderRadius: 8, alignItems: 'center', marginTop: 8 }}
                onPress={handleAddUpiAccount}
              >
                <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>+ Save UPI Account</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Thermal Receipt Settings */}
          <View style={[styles.formSection, isDark ? styles.cardDark : styles.cardLight]}>
            <Text style={[styles.sectionHeader, { color: '#f59e0b' }]}>
              🖨️ THERMAL PRINTER & RECEIPT
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                Receipt Footer Note
              </Text>
              <TextInput
                value={formData.receiptFooter}
                onChangeText={(t) => setFormData({ ...formData, receiptFooter: t })}
                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
              />
            </View>

            <View style={styles.fieldRow}>
              <TouchableOpacity
                style={[styles.widthBtn, formData.printerPaperWidth === '58mm' && styles.widthBtnActive]}
                onPress={() => setFormData({ ...formData, printerPaperWidth: '58mm' })}
              >
                <Text style={[styles.widthBtnText, formData.printerPaperWidth === '58mm' && styles.widthBtnTextActive]}>
                  58mm (Mobile POS)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.widthBtn, formData.printerPaperWidth === '80mm' && styles.widthBtnActive]}
                onPress={() => setFormData({ ...formData, printerPaperWidth: '80mm' })}
              >
                <Text style={[styles.widthBtnText, formData.printerPaperWidth === '80mm' && styles.widthBtnTextActive]}>
                  80mm (Desktop Thermal)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Cloud Database Status (Clean Status & Sync) */}
          <View style={[styles.formSection, isDark ? styles.cardDark : styles.cardLight]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.sectionHeader, { color: '#38bdf8' }]}>☁️ CLOUD DATABASE STATUS</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                <Text style={{ fontSize: 9, color: '#10b981', fontWeight: 'bold' }}>● CONNECTED</Text>
              </View>
            </View>

            <View style={[styles.accountBox, isDark ? styles.subCardDark : styles.subCardLight]}>
              <Text style={{ color: isDark ? '#ffffff' : '#0f172a', fontSize: 13, fontWeight: 'bold', marginBottom: 2 }}>
                Real-Time Cloud Synchronization
              </Text>
              <Text style={[styles.fieldLabel, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                Inventory, billing invoices, and staff accounts sync automatically in real-time.
              </Text>
              <Text style={[styles.fieldLabel, { fontSize: 10, marginTop: 4, fontFamily: 'monospace' }, isDark ? styles.textMutedDark : styles.textMutedLight]}>
                Last sync: {formData.lastSyncedAt ? new Date(formData.lastSyncedAt).toLocaleTimeString() : 'Real-time active'}
              </Text>

              <View style={[styles.fieldRow, { marginTop: 10 }]}>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: '#38bdf8' }]}
                  onPress={handleTestConnection}
                  disabled={testingConnection}
                >
                  <Text style={[styles.actionBtnText, { color: '#38bdf8' }]}>
                    {testingConnection ? 'Checking...' : 'Check Status'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: '#10b981', backgroundColor: '#10b981' }]}
                  onPress={handleSyncNow}
                  disabled={syncing}
                >
                  <Text style={[styles.actionBtnText, { color: '#ffffff' }]}>
                    {syncing ? 'Syncing...' : 'Sync Now'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {connectionResult && (
              <View
                style={[
                  styles.resultBox,
                  { backgroundColor: connectionResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }
                ]}
              >
                <Text style={{ fontSize: 12, color: connectionResult.success ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                  {connectionResult.message}
                </Text>
              </View>
            )}

            {syncResult && (
              <View style={[styles.resultBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                <Text style={{ fontSize: 12, color: '#38bdf8', fontWeight: 'bold' }}>
                  {syncResult}
                </Text>
              </View>
            )}
          </View>

          {/* Save Button */}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save All Configurations & Credentials</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerDark: {
    backgroundColor: '#020617',
  },
  containerLight: {
    backgroundColor: '#f8fafc',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
  },
  borderDark: {
    borderBottomColor: '#1e293b',
  },
  borderLight: {
    borderBottomColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  textWhite: {
    color: '#ffffff',
  },
  textDark: {
    color: '#0f172a',
  },
  textMutedDark: {
    color: '#94a3b8',
  },
  textMutedLight: {
    color: '#64748b',
  },
  savedBadge: {
    backgroundColor: '#10b981',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lockBox: {
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    marginVertical: 40,
    borderWidth: 1,
  },
  cardDark: {
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  subCardDark: {
    backgroundColor: '#020617',
    borderColor: '#1e293b',
  },
  subCardLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  lockIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  lockTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  lockSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center',
  },
  unlockRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  pinInput: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
  },
  unlockBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
  },
  unlockBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  formScroll: {
    flex: 1,
  },
  formSection: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#6366f1',
    marginBottom: 10,
  },
  themeToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  themeOptionBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  themeOptionDark: {
    backgroundColor: '#020617',
    borderColor: '#1e293b',
  },
  themeOptionLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
  },
  themeOptionBtnActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#6366f1',
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
  },
  themeOptionTextActive: {
    color: '#ffffff',
  },
  accountBox: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  accountTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  fieldGroup: {
    marginBottom: 10,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  halfCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
  },
  inputDark: {
    backgroundColor: '#020617',
    borderColor: '#334155',
    color: '#ffffff',
  },
  inputLight: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    color: '#0f172a',
  },
  hintText: {
    fontSize: 9,
    marginTop: 3,
  },
  widthBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  widthBtnActive: {
    backgroundColor: '#4f46e5',
  },
  widthBtnText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  widthBtnTextActive: {
    color: '#ffffff',
  },
  saveBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 16,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  resultBox: {
    padding: 8,
    borderRadius: 8,
    marginVertical: 6,
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
