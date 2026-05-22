import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform, ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import {
  SQLiteProvider,
  useSQLiteContext,
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';
import { migrateDbIfNeeded } from './migrations';

// ── Web singleton ─────────────────────────────────────────────────────────────
// Stored on `window` so HMR module re-evaluations reuse the same open
// connection instead of spawning a second worker that fights for the OPFS lock.
declare global {
  interface Window { __recipesDb?: SQLiteDatabase; }
}

const WebDbContext = createContext<SQLiteDatabase | null>(null);

function WebDatabaseProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<SQLiteDatabase | null>(
    typeof window !== 'undefined' ? (window.__recipesDb ?? null) : null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (db) return; // reuse existing singleton

    openDatabaseAsync('recipes.db')
      .then(async (database) => {
        await migrateDbIfNeeded(database);
        window.__recipesDb = database;
        setDb(database);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Database error: {error}</Text>
      </View>
    );
  }

  if (!db) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#E05C2D" />
      </View>
    );
  }

  return <WebDbContext.Provider value={db}>{children}</WebDbContext.Provider>;
}

// ── Unified hook ──────────────────────────────────────────────────────────────
export function useDatabase(): SQLiteDatabase {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const db = useContext(WebDbContext);
    if (!db) throw new Error('useDatabase must be used inside DatabaseProvider');
    return db;
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSQLiteContext();
}

// ── Unified provider ──────────────────────────────────────────────────────────
export function DatabaseProvider({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') {
    return <WebDatabaseProvider>{children}</WebDatabaseProvider>;
  }
  return (
    <SQLiteProvider databaseName="recipes.db" onInit={migrateDbIfNeeded}>
      {children}
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 14, color: '#888', textAlign: 'center', padding: 24 },
});
