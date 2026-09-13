import { getSupabaseClient } from './supabase';
import { get, set } from 'idb-keyval';

// Real-data fetcher: Supabase is authoritative; offline cache is used only for previously loaded real records.
async function fetchRealData<T>(tableName: string): Promise<T[]> {
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
  return fetchRealData('cameras');
}

export async function fetchBehaviorEvents() {
  return fetchRealData('behavior_events');
}

export async function fetchSecurityIncidents() {
  return fetchRealData('security_incidents');
}

export async function fetchAttendanceRecords() {
  return fetchRealData('attendance_records');
}

export async function fetchInventoryProducts() {
  return fetchRealData('inventory_products');
}

export async function fetchEmployees() {
  return fetchRealData('employees');
}

export async function fetchAuditLogs() {
  return fetchRealData('audit_logs');
}

export async function fetchUsers() {
  return fetchRealData('users');
}

export async function fetchTenants() {
  return fetchRealData('tenants');
}

