import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { Role, ThemeMode, UserSession } from '../types';

interface NavbarProps {
  activeTab: 'billing' | 'inventory' | 'reports' | 'settings';
  setActiveTab: (tab: 'billing' | 'inventory' | 'reports' | 'settings') => void;
  cartCount: number;
  role: Role;
  storeName: string;
  theme: ThemeMode;
  onToggleTheme: () => void;
  session: UserSession | null;
  onLogout: () => void;
}

export const NavbarNative: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  role,
  storeName,
  theme,
  onToggleTheme,
  session,
  onLogout,
}) => {
  const isDark = theme === 'dark';
  const isAdmin = role === 'ADMIN' || role === 'MANAGER';

  return (
    <View style={[styles.headerContainer, isDark ? styles.headerDark : styles.headerLight]}>
      {/* Top Header Row */}
      <View style={styles.topRow}>
        <View style={styles.brandBox}>
          <View style={styles.logoBadge}>
            <Image
              source={require('../../assets/fireworks-icon.png')}
              style={styles.brandLogoImg}
              resizeMode="contain"
            />
          </View>
          <View style={styles.storeTextBox}>
            <View style={styles.titleRow}>
              <Text style={[styles.storeTitle, isDark ? styles.textWhite : styles.textDark]} numberOfLines={1}>
                {storeName}
              </Text>
              <View style={styles.readyBadge}>
                <Text style={styles.readyText}>● Ready</Text>
              </View>
            </View>
            <Text style={[styles.storeSubtitle, isDark ? styles.textMutedDark : styles.textMutedLight]}>
              {isAdmin ? '👑 Admin Management' : '👤 Cashier Terminal'}
            </Text>
          </View>
        </View>

        {/* Right Action Buttons: Theme Toggle & Logout */}
        <View style={styles.rightActions}>
          <TouchableOpacity
            style={[styles.themeBtn, isDark ? styles.themeBtnDark : styles.themeBtnLight]}
            onPress={onToggleTheme}
          >
            <Text style={styles.themeBtnIcon}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>

          <View style={[styles.userBadge, isAdmin ? styles.userBadgeAdmin : styles.userBadgeEmp]}>
            <Text style={[styles.userBadgeText, isAdmin ? styles.userAdminText : styles.userEmpText]}>
              {isAdmin ? '👑 Admin' : '👤 Cashier'}
            </Text>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation Tabs */}
      <View style={[styles.navRow, isDark ? styles.navRowDark : styles.navRowLight]}>
        {/* Billing Counter - Visible to both Admin and Employee */}
        <TouchableOpacity
          style={[styles.navTab, activeTab === 'billing' && styles.navTabActive]}
          onPress={() => setActiveTab('billing')}
        >
          <View style={styles.tabContent}>
            <Text style={[styles.navTabText, activeTab === 'billing' && styles.navTabTextActive]}>
              🛒 Billing Counter
            </Text>
            {cartCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cartCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Admin Only Tabs */}
        {isAdmin && (
          <>
            <TouchableOpacity
              style={[styles.navTab, activeTab === 'inventory' && styles.navTabActive]}
              onPress={() => setActiveTab('inventory')}
            >
              <Text style={[styles.navTabText, activeTab === 'inventory' && styles.navTabTextActive]}>
                📦 Stock
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navTab, activeTab === 'reports' && styles.navTabActive]}
              onPress={() => setActiveTab('reports')}
            >
              <Text style={[styles.navTabText, activeTab === 'reports' && styles.navTabTextActive]}>
                📊 Sales
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navTab, activeTab === 'settings' && styles.navTabActive]}
              onPress={() => setActiveTab('settings')}
            >
              <Text style={[styles.navTabText, activeTab === 'settings' && styles.navTabTextActive]}>
                ⚙️ Settings
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: 8,
    borderBottomWidth: 1,
  },
  headerDark: {
    backgroundColor: '#0f172a',
    borderBottomColor: '#1e293b',
  },
  headerLight: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  brandBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  brandLogoImg: {
    width: 32,
    height: 32,
    borderRadius: 7,
  },
  logoText: {
    fontSize: 16,
  },
  storeTextBox: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storeTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  textWhite: {
    color: '#f8fafc',
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
  readyBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  readyText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: 'bold',
  },
  storeSubtitle: {
    fontSize: 10,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  themeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeBtnDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  themeBtnLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  themeBtnIcon: {
    fontSize: 14,
  },
  userBadge: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  userBadgeAdmin: {
    backgroundColor: 'rgba(147, 51, 234, 0.15)',
    borderColor: 'rgba(147, 51, 234, 0.3)',
  },
  userBadgeEmp: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  userBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  userAdminText: {
    color: '#c084fc',
  },
  userEmpText: {
    color: '#34d399',
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  logoutBtnText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: 'bold',
  },
  navRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  navRowDark: {
    backgroundColor: '#020617',
    borderTopColor: '#1e293b',
  },
  navRowLight: {
    backgroundColor: '#f8fafc',
    borderTopColor: '#e2e8f0',
  },
  navTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  navTabActive: {
    backgroundColor: '#4f46e5',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navTabText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
  },
  navTabTextActive: {
    color: '#ffffff',
  },
  badge: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: {
    color: '#020617',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
