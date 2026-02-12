// IndexedDB wrapper for offline incident report storage
const DB_NAME = 'GsystemOfflineDB';
const DB_VERSION = 4; // Bumped to 4 to force teachers store creation if version 3 was skipped
const STORE_NAME = 'incidentReports';
const STUDENTS_STORE_NAME = 'students';

let db = null;
let dbPromise = null;

// Initialize IndexedDB with Singleton Pattern and Retry Logic
export async function initDB() {
    if (db) return db;
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        console.log(`[IndexedDB] Opening ${DB_NAME} version ${DB_VERSION}...`);
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = async (event) => {
            console.error('IndexedDB error:', request.error);

            // If internal error, try to delete and recreate
            if (request.error && (request.error.name === 'UnknownError' || request.error.message.includes('Internal error'))) {
                console.warn('Database corruption detected. Attempting to delete and recreate...');
                try {
                    await deleteDatabase();
                    // Retry initialization once
                    const retryRequest = indexedDB.open(DB_NAME, DB_VERSION);
                    retryRequest.onsuccess = () => {
                        db = retryRequest.result;
                        console.log('IndexedDB recovered and initialized');
                        resolve(db);
                    };
                    retryRequest.onerror = () => {
                        reject(new Error('Failed to recover IndexedDB: ' + retryRequest.error));
                    };
                    retryRequest.onupgradeneeded = (e) => {
                        createObjectStore(e.target.result);
                    };
                } catch (e) {
                    reject(e);
                }
            } else {
                reject(request.error);
            }
            dbPromise = null; // Reset promise so we can try again
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('IndexedDB initialized successfully');

            // Handle generic errors globally for this connection
            db.onversionchange = () => {
                db.close();
                db = null;
                console.log('Database outdated, closed.');
            };

            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            console.log(`[IndexedDB] Upgrade needed: version ${event.oldVersion} to ${event.newVersion}`);
            createObjectStore(event.target.result);
        };

        request.onblocked = () => {
            console.warn('[IndexedDB] Upgrade BLOCKED. Please close all other tabs of this app!');
            alert('A database update is pending. Please close other tabs of this application to complete the update.');
        };
    });

    return dbPromise;
}

function createObjectStore(database) {
    // Incident Reports Store
    if (!database.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = database.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true
        });

        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('synced', 'synced', { unique: false });

        console.log('Reports object store created successfully');
    }

    // Students Cache Store
    if (!database.objectStoreNames.contains(STUDENTS_STORE_NAME)) {
        const studentStore = database.createObjectStore(STUDENTS_STORE_NAME, {
            keyPath: 'studentName' // Use name as key for simplicity in cache
        });
        // We might want to search by other fields later, but name is primary
        console.log('Students object store created successfully');
    }

    // Teachers Cache Store (for POD)
    if (!database.objectStoreNames.contains('teachers')) {
        const teacherStore = database.createObjectStore('teachers', {
            keyPath: 'teacherName'
        });
        console.log('Teachers object store created successfully');
    }
}

// Save students to cache (overwrites existing)
export async function saveStudents(students) {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STUDENTS_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STUDENTS_STORE_NAME);

        // Clear existing cache first to avoid stale data
        const clearRequest = store.clear();

        clearRequest.onsuccess = () => {
            // Add all new students
            let addedCount = 0;
            if (students && students.length > 0) {
                students.forEach(student => {
                    store.put(student);
                    addedCount++;
                });
            }

            transaction.oncomplete = () => {
                console.log(`Cached ${addedCount} students`);
                resolve(true);
            };
        };

        clearRequest.onerror = () => reject(clearRequest.error);
        transaction.onerror = () => reject(transaction.error);
    });
}

// Get all cached students
export async function getCachedStudents() {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STUDENTS_STORE_NAME], 'readonly');
        const store = transaction.objectStore(STUDENTS_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            console.log(`Retrieved ${request.result ? request.result.length : 0} cached students`);
            resolve(request.result || []);
        };

        request.onerror = () => {
            console.error('Error getting cached students:', request.error);
            reject(request.error);
        };
    });
}

// Save teachers to cache (for POD)
export async function saveTeachers(teachers) {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['teachers'], 'readwrite');
        const store = transaction.objectStore('teachers');

        // Clear existing cache first
        const clearRequest = store.clear();

        clearRequest.onsuccess = () => {
            let addedCount = 0;
            if (teachers && teachers.length > 0) {
                teachers.forEach(teacher => {
                    store.put(teacher);
                    addedCount++;
                });
            }

            transaction.oncomplete = () => {
                console.log(`Cached ${addedCount} teachers`);
                resolve(true);
            };
        };

        clearRequest.onerror = () => reject(clearRequest.error);
        transaction.onerror = () => reject(transaction.error);
    });
}

// Get all cached teachers
export async function getCachedTeachers() {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['teachers'], 'readonly');
        const store = transaction.objectStore('teachers');
        const request = store.getAll();

        request.onsuccess = () => {
            console.log(`Retrieved ${request.result ? request.result.length : 0} cached teachers`);
            resolve(request.result || []);
        };

        request.onerror = () => {
            console.error('Error getting cached teachers:', request.error);
            reject(request.error);
        };
    });
}

// Add incident report to IndexedDB
export async function addIncidentReport(reportData) {
    if (!db) {
        await initDB();
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);

        // Add metadata
        const dataToStore = {
            ...reportData,
            timestamp: new Date().toISOString(),
            synced: false
        };

        const request = objectStore.add(dataToStore);

        request.onsuccess = () => {
            console.log('Incident report added to IndexedDB:', request.result);
            resolve(request.result);
        };

        request.onerror = () => {
            console.error('Error adding incident report:', request.error);
            reject(request.error);
        };
    });
}

// Get all unsynced incident reports
export async function getUnsyncedReports() {
    if (!db) {
        await initDB();
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const results = [];

        // Use cursor to iterate through all records
        const request = objectStore.openCursor();

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                // Only add unsynced reports
                if (cursor.value.synced === false) {
                    results.push(cursor.value);
                }
                cursor.continue();
            } else {
                // No more entries
                console.log('Retrieved unsynced reports:', results);
                resolve(results);
            }
        };

        request.onerror = () => {
            console.error('Error getting unsynced reports:', request.error);
            reject(request.error);
        };
    });
}

// Get all incident reports (synced and unsynced)
export async function getAllReports() {
    if (!db) {
        await initDB();
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.getAll();

        request.onsuccess = () => {
            console.log('Retrieved all reports:', request.result);
            resolve(request.result);
        };

        request.onerror = () => {
            console.error('Error getting all reports:', request.error);
            reject(request.error);
        };
    });
}

// Mark report as synced
export async function markAsSynced(id) {
    if (!db) {
        await initDB();
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const getRequest = objectStore.get(id);

        getRequest.onsuccess = () => {
            const data = getRequest.result;
            if (data) {
                data.synced = true;
                data.syncedAt = new Date().toISOString();

                const updateRequest = objectStore.put(data);

                updateRequest.onsuccess = () => {
                    console.log('Report marked as synced:', id);
                    resolve(true);
                };

                updateRequest.onerror = () => {
                    console.error('Error marking as synced:', updateRequest.error);
                    reject(updateRequest.error);
                };
            } else {
                reject(new Error('Report not found'));
            }
        };

        getRequest.onerror = () => {
            console.error('Error getting report:', getRequest.error);
            reject(getRequest.error);
        };
    });
}

// Delete a report from IndexedDB
export async function deleteReport(id) {
    if (!db) {
        await initDB();
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.delete(id);

        request.onsuccess = () => {
            console.log('Report deleted:', id);
            resolve(true);
        };

        request.onerror = () => {
            console.error('Error deleting report:', request.error);
            reject(request.error);
        };
    });
}

// Clear all synced reports (cleanup)
export async function clearSyncedReports() {
    if (!db) {
        await initDB();
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const index = objectStore.index('synced');
        const request = index.openCursor(true); // Get all where synced = true

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                objectStore.delete(cursor.primaryKey);
                cursor.continue();
            } else {
                console.log('All synced reports cleared');
                resolve(true);
            }
        };

        request.onerror = () => {
            console.error('Error clearing synced reports:', request.error);
            reject(request.error);
        };
    });
}

// Check if online
export function isOnline() {
    return navigator.onLine;
}

// Get connection status
export function getConnectionStatus() {
    return {
        online: navigator.onLine,
        timestamp: new Date().toISOString()
    };
}

// Delete the entire database (for troubleshooting)
export async function deleteDatabase() {
    return new Promise((resolve, reject) => {
        if (db) {
            db.close();
            db = null;
        }

        const request = indexedDB.deleteDatabase(DB_NAME);

        request.onsuccess = () => {
            console.log('Database deleted successfully');
            resolve(true);
        };

        request.onerror = () => {
            console.error('Error deleting database:', request.error);
            reject(request.error);
        };

        request.onblocked = () => {
            console.warn('Database deletion blocked - close all tabs using this database');
        };
    });
}
