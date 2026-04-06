// Firebase seed functionality has been disabled - data is now managed via the local SQLite API.
export async function seedBigData() {
  console.warn('Seeding via Firebase is disabled. Use the Admin UI to create data manually.');
}
export async function seedInitialData() {
  console.warn('Seeding via Firebase is disabled. The local database initializes with a default admin user.');
}
export async function clearAllData() {
  console.warn('Clearing via Firebase is disabled.');
}
