import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { UserSession, ThemeMode } from '../types';
import { authenticateUser } from '../services/dbService';

interface LoginPageProps {
  onLoginSuccess: (session: UserSession) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  storeName: string;
}

export const LoginPageNative: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  theme,
  onToggleTheme,
  storeName,
}) => {
  const isDark = theme === 'dark';
  const [roleMode, setRoleMode] = useState<'ADMIN' | 'EMPLOYEE'>('ADMIN');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSelectRole = (role: 'ADMIN' | 'EMPLOYEE') => {
    setRoleMode(role);
    setErrorMsg('');
  };

  const handleLogin = async () => {
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const session = await authenticateUser(username, password);
      if (session) {
        onLoginSuccess(session);
        return;
      }
      setIsSubmitting(false);
      setErrorMsg('Invalid credentials. Please check your username and password.');
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Top Header Row with Theme Switcher */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Image
              source={require('../../assets/fireworks-icon.png')}
              style={styles.brandLogoImg}
              resizeMode="contain"
            />
          </View>
          <View>
            <Text style={[styles.storeTitle, isDark ? styles.textWhite : styles.textDark]}>
              {storeName}
            </Text>
            <Text style={styles.storeSubtitle}>POS Terminal Login</Text>
          </View>
        </View>

        {/* Theme Toggle Button */}
        <TouchableOpacity
          style={[styles.themeBtn, isDark ? styles.themeBtnDark : styles.themeBtnLight]}
          onPress={onToggleTheme}
        >
          <Text style={styles.themeBtnText}>{isDark ? '☀️ Light' : '🌙 Dark'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Login Card */}
        <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
          {/* Role Segmented Tabs */}
          <View style={[styles.roleTabRow, isDark ? styles.roleTabRowDark : styles.roleTabRowLight]}>
            <TouchableOpacity
              style={[styles.roleTab, roleMode === 'ADMIN' && styles.roleTabActive]}
              onPress={() => handleSelectRole('ADMIN')}
            >
              <Text style={[styles.roleTabText, roleMode === 'ADMIN' && styles.roleTabTextActive]}>
                👑 Admin Mode
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleTab, roleMode === 'EMPLOYEE' && styles.roleTabActive]}
              onPress={() => handleSelectRole('EMPLOYEE')}
            >
              <Text style={[styles.roleTabText, roleMode === 'EMPLOYEE' && styles.roleTabTextActive]}>
                👤 Employee Mode
              </Text>
            </TouchableOpacity>
          </View>

          {/* Role Privilege Banner */}
          <View
            style={[
              styles.privilegeBox,
              roleMode === 'ADMIN'
                ? isDark ? styles.privilegeAdminDark : styles.privilegeAdminLight
                : isDark ? styles.privilegeEmpDark : styles.privilegeEmpLight
            ]}
          >
            {roleMode === 'ADMIN' ? (
              <Text style={[styles.privilegeText, isDark ? styles.privilegeTextAdminDark : styles.privilegeTextAdminLight]}>
                👑 <Text style={styles.bold}>Admin Access:</Text> Full system control over Stock & Catalog, Sales & Invoices, Store Settings, and Billing Counter.
              </Text>
            ) : (
              <Text style={[styles.privilegeText, isDark ? styles.privilegeTextEmpDark : styles.privilegeTextEmpLight]}>
                👤 <Text style={styles.bold}>Employee Access:</Text> Dedicated Billing Counter & Checkout for fast cashier operations. Management sections are locked.
              </Text>
            )}
          </View>

          {/* Error Message */}
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
            </View>
          ) : null}

          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark ? styles.labelDark : styles.labelLight]}>
              USERNAME
            </Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Enter username"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              autoCapitalize="none"
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <View style={styles.passLabelRow}>
              <Text style={[styles.inputLabel, isDark ? styles.labelDark : styles.labelLight]}>
                PASSWORD
              </Text>
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.showPassText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
            />
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={handleLogin}
            disabled={isSubmitting}
          >
            <Text style={styles.loginBtnText}>
              {isSubmitting ? 'Authenticating...' : 'Sign In to POS Counter →'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.footerText, isDark ? styles.labelDark : styles.labelLight]}>
          Offline-First Billing System • Safe & Secure Local Storage
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 36,
  },
  containerDark: {
    backgroundColor: '#020617',
  },
  containerLight: {
    backgroundColor: '#f8fafc',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  brandLogoImg: {
    width: 36,
    height: 36,
    borderRadius: 9,
  },
  logoIcon: {
    fontSize: 18,
  },
  storeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  storeSubtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  textWhite: {
    color: '#ffffff',
  },
  textDark: {
    color: '#0f172a',
  },
  themeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  themeBtnDark: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
  },
  themeBtnLight: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
  },
  themeBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4f46e5',
  },
  scrollContent: {
    padding: 16,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  cardDark: {
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  roleTabRow: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  roleTabRowDark: {
    backgroundColor: '#020617',
  },
  roleTabRowLight: {
    backgroundColor: '#f1f5f9',
  },
  roleTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  roleTabActive: {
    backgroundColor: '#4f46e5',
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
  },
  roleTabTextActive: {
    color: '#ffffff',
  },
  privilegeBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  privilegeAdminDark: {
    backgroundColor: 'rgba(147, 51, 234, 0.15)',
    borderColor: 'rgba(147, 51, 234, 0.3)',
  },
  privilegeAdminLight: {
    backgroundColor: '#faf5ff',
    borderColor: '#e9d5ff',
  },
  privilegeEmpDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  privilegeEmpLight: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  privilegeText: {
    fontSize: 11,
    lineHeight: 16,
  },
  privilegeTextAdminDark: {
    color: '#d8b4fe',
  },
  privilegeTextAdminLight: {
    color: '#6b21a8',
  },
  privilegeTextEmpDark: {
    color: '#6ee7b7',
  },
  privilegeTextEmpLight: {
    color: '#166534',
  },
  bold: {
    fontWeight: 'bold',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
  },
  inputGroup: {
    marginBottom: 14,
  },
  passLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  labelDark: {
    color: '#94a3b8',
  },
  labelLight: {
    color: '#64748b',
  },
  showPassText: {
    fontSize: 11,
    color: '#6366f1',
    fontWeight: 'bold',
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  inputDark: {
    backgroundColor: '#020617',
    borderColor: '#334155',
    color: '#ffffff',
  },
  inputLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    color: '#0f172a',
  },
  loginBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    marginTop: 18,
  },
});
