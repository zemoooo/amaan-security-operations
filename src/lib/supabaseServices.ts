import { getSupabaseClient } from './supabase';
import * as mockData from '../mock/data';
import { get, set } from 'idb-keyval';

// Generic fetcher that falls back to empty arrays if Supabase isn't configured or returns empty
async function fetchWithMockFallback<T>(tableName: string): Promise<T[]> {
  const supabase = await getSupabaseClient();
  const cacheKey = `cctv_cache_${tableName}`;
  
  if (!supabase) {
    // If no supabase client, try to load from local cache first
    const cachedData = await get(cacheKey);
    return cachedData ? (cachedData as T[]) : [];
  }
  
  try {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) {
      console.warn(`Supabase error for ${tableName}:`, error.message);
      // Fallback to local cache on error (e.g. offline)
      const cachedData = await get(cacheKey);
      return cachedData ? (cachedData as T[]) : [];
    }
    if (!data || data.length === 0) {
      // Keep cache as is or update it to empty? Let's assume if it's empty online, it's empty
      await set(cacheKey, []);
      return []; 
    }
    
    // Save to local IndexedDB cache
    await set(cacheKey, data);
    return data as unknown as T[];
  } catch (err) {
    console.warn(`Failed to fetch ${tableName} from Supabase, attempting to load from cache.`, err);
    const cachedData = await get(cacheKey);
    return cachedData ? (cachedData as T[]) : [];
  }
}

export async function fetchCameras() {
  return fetchWithMockFallback('cameras');
}

export async function fetchBehaviorEvents() {
  return fetchWithMockFallback('behavior_events');
}

export async function fetchSecurityIncidents() {
  return fetchWithMockFallback('security_incidents');
}

export async function fetchAttendanceRecords() {
  return fetchWithMockFallback('attendance_records');
}

export async function fetchInventoryProducts() {
  return fetchWithMockFallback('inventory_products');
}

export async function fetchEmployees() {
  return fetchWithMockFallback('employees');
}

export async function fetchAuditLogs() {
  return fetchWithMockFallback('audit_logs');
}

export async function fetchUsers() {
  return fetchWithMockFallback('users');
}

export async function fetchTenants() {
  return fetchWithMockFallback('tenants');
}

// Function to seed mock data to Supabase (run once manually or via UI)
export async function seedMockDataToSupabase() {
  const supabase = await getSupabaseClient();
  
  if (!supabase) {
    throw new Error('Supabase is not configured in environment variables');
  }

  const seed = async (table: string, data: any[]) => {
    console.log(`Seeding ${table}...`);
    const { error } = await supabase.from(table).upsert(data, { onConflict: 'id' });
    if (error) console.error(`Error seeding ${table}:`, error.message);
  };

  await seed('tenants', mockData.MOCK_TENANTS);
  await seed('users', mockData.MOCK_USERS);
  await seed('cameras', mockData.MOCK_CAMERAS);
  await seed('employees', mockData.MOCK_EMPLOYEES);
  await seed('attendance_records', mockData.MOCK_ATTENDANCE);
  await seed('behavior_events', mockData.MOCK_BEHAVIOR_EVENTS);
  await seed('security_incidents', mockData.MOCK_SECURITY_INCIDENTS);
  await seed('inventory_products', mockData.MOCK_INVENTORY_PRODUCTS);
  await seed('audit_logs', mockData.MOCK_AUDIT_LOGS);

  console.log('Database seeding complete.');
}
