import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product, Invoice, StoreSettings, ThemeMode, UserSession, AuthCredentials } from '../types';

const STORAGE_KEYS = {
  PRODUCTS: 'fireworks_pos_products',
  INVOICES: 'fireworks_pos_invoices',
  SETTINGS: 'fireworks_pos_settings',
  INVOICE_COUNTER: 'fireworks_pos_inv_counter',
  THEME: 'fireworks_pos_theme',
  AUTH_SESSION: 'fireworks_pos_auth_session',
  CREDENTIALS: 'fireworks_pos_credentials',
};

export const DEFAULT_CREDENTIALS: AuthCredentials = {
  adminUser: 'SatyamambaFireworks',
  adminPass: 'SmF_9482_Admin',
  employeeUser: '',
  employeePass: '',
};

export const INITIAL_PRODUCTS: Product[] = [];

export const DEFAULT_SETTINGS: StoreSettings = {
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
  supabaseUrl: 'https://vxkgxlomnvizqwzachie.supabase.co',
  supabaseAnonKey: 'sb_publishable_NK0EaOo2owEELvqH0a-NeQ_oI4LvPXG',
};

// Purge old sample data automatically in Expo mobile app
export const purgeOldSampleData = async () => {
  try {
    const prodRaw = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (prodRaw) {
      const list: Product[] = JSON.parse(prodRaw);
      const hasSample = list.some(
        (p) =>
          p.id?.startsWith('prod-') ||
          p.name?.toLowerCase().includes('sparklers') ||
          p.name?.toLowerCase().includes('flower pots')
      );
      if (hasSample) {
        await AsyncStorage.removeItem(STORAGE_KEYS.PRODUCTS);
      }
    }

    const invRaw = await AsyncStorage.getItem(STORAGE_KEYS.INVOICES);
    if (invRaw) {
      const invList: Invoice[] = JSON.parse(invRaw);
      const hasSampleInv = invList.some(
        (inv) =>
          inv.cashierName === 'Store Cashier' ||
          inv.items?.some(
            (i) =>
              i.productId?.startsWith('prod-') ||
              i.name?.toLowerCase().includes('sparklers')
          )
      );
      if (hasSampleInv) {
        await AsyncStorage.removeItem(STORAGE_KEYS.INVOICES);
        await AsyncStorage.removeItem(STORAGE_KEYS.INVOICE_COUNTER);
      }
    }

    const credsRaw = await AsyncStorage.getItem(STORAGE_KEYS.CREDENTIALS);
    if (credsRaw) {
      const parsed = JSON.parse(credsRaw);
      if (parsed.adminUser !== 'SatyamambaFireworks') {
        parsed.adminUser = 'SatyamambaFireworks';
        await AsyncStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(parsed));
      }
    }
  } catch (e) {
    // ignore
  }
};

purgeOldSampleData();

export const getProducts = async (): Promise<Product[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!data) {
      return [];
    }
    const parsed: Product[] = JSON.parse(data);
    const cleaned = parsed.filter(
      (p) =>
        !p.id?.startsWith('prod-') &&
        !p.name?.toLowerCase().includes('sparklers') &&
        !p.name?.toLowerCase().includes('flower pots')
    );
    if (cleaned.length !== parsed.length) {
      await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
};

export const saveProducts = async (products: Product[]) => {
  await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
};

export const getInvoices = async (): Promise<Invoice[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.INVOICES);
    if (!data) return [];
    const parsed: Invoice[] = JSON.parse(data);
    const cleaned = parsed.filter(
      (inv) =>
        inv.cashierName !== 'Store Cashier' &&
        !inv.items?.some(
          (i) =>
            i.productId?.startsWith('prod-') ||
            i.name?.toLowerCase().includes('sparklers')
        )
    );
    if (cleaned.length !== parsed.length) {
      await AsyncStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
};

export const saveInvoice = async (invoice: Invoice): Promise<Invoice[]> => {
  const current = await getInvoices();
  const updated = [invoice, ...current];
  await AsyncStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(updated));
  return updated;
};

export const getSettings = async (): Promise<StoreSettings> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      return DEFAULT_SETTINGS;
    }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = async (settings: StoreSettings) => {
  await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
};

export const getNextInvoiceId = async (): Promise<string> => {
  try {
    const current = await AsyncStorage.getItem(STORAGE_KEYS.INVOICE_COUNTER);
    const num = current ? parseInt(current, 10) + 1 : 1;
    await AsyncStorage.setItem(STORAGE_KEYS.INVOICE_COUNTER, num.toString());
    const year = new Date().getFullYear();
    const formattedNum = num.toString().padStart(4, '0');
    return `INV-${year}-${formattedNum}`;
  } catch (e) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `INV-${new Date().getFullYear()}-${randomSuffix}`;
  }
};

// Theme Preference
export const getThemePreference = async (): Promise<ThemeMode> => {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode;
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  } catch {
    return 'dark';
  }
};

export const saveThemePreference = async (theme: ThemeMode) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch (e) {
    console.error('Failed to save theme in AsyncStorage', e);
  }
};

// User Session
export const getUserSession = async (): Promise<UserSession | null> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const saveUserSession = async (session: UserSession | null) => {
  try {
    if (session) {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    }
  } catch (e) {
    console.error('Failed to save session in AsyncStorage', e);
  }
};

export const clearUserSession = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
  } catch (e) {
    console.error('Failed to clear session in AsyncStorage', e);
  }
};

// Credentials
export const getCredentials = async (): Promise<AuthCredentials> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CREDENTIALS);
    if (!data) {
      await AsyncStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(DEFAULT_CREDENTIALS));
      return DEFAULT_CREDENTIALS;
    }
    const parsed = JSON.parse(data);
    const result: AuthCredentials = {
      ...DEFAULT_CREDENTIALS,
      ...parsed,
      adminUser: 'SatyamambaFireworks',
    };
    if (parsed.adminUser !== 'SatyamambaFireworks') {
      await AsyncStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(result));
    }
    return result;
  } catch {
    return DEFAULT_CREDENTIALS;
  }
};

export const saveCredentials = async (creds: AuthCredentials) => {
  try {
    const safeCreds = { ...creds, adminUser: 'SatyamambaFireworks' };
    await AsyncStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(safeCreds));
  } catch (e) {
    console.error('Failed to save credentials in AsyncStorage', e);
  }
};

