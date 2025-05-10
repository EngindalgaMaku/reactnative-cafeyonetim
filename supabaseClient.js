import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage';

// Environment variables yerine doğrudan değerleri kullanalım
// Bu değerleri gerçek uygulamada .env dosyasından almalısınız
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://fmvsccesfwiuoewhtloi.supabase.co'
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtdnNjY2VzZndpdW9ld2h0bG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTUyODUzMDQsImV4cCI6MjAzMDg2MTMwNH0.R80DE1L9_THr5Oci8RbQQnB9lDFNP2EESykYcuZjDUA'

// AsyncStorage kullanarak kalıcı oturum yapılandırması
const customStorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  // Global hata yakalama için listenerler
  global: {
    fetch: (...args) => fetch(...args),
  },
}); 