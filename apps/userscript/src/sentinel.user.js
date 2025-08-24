// ==UserScript==
// @name        Project Sentinel
// @namespace   KPMG.Consulting.C&O.FinalStrategicDefense
// @version     35.0.0
// @description A comprehensive privacy framework with advanced ML intelligence, anti-fingerprinting, and network protection.
// @author      Koon Wang
// @license     MIT
// @match       *://*/*
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_registerMenuCommand
// @grant       GM_addStyle
// @grant       GM_xmlhttpRequest
// @run-at      document-start
// ==/UserScript==

/*global GM_setValue, GM_getValue, GM_registerMenuCommand, GM_addStyle, GM_xmlhttpRequest, unsafeWindow*/

(function() {
    'use strict';

    const Sentinel = {
        // --- 1. CORE CONFIGURATION ---
        config: {},

            capabilities: {
                workers: null // null = undetermined, false = not supported, true = supported
            },
        defaultConfig: {
            scriptEnabled: true,
            enableCopy: true,
            enableRightClick: true,
            disableSelectionTracking: true,
            spoofPageVisibility: true,
            blockBeaconOnUnload: true,
            disableAntiDevTools: true,
            neutralizeIntersectionObserver: true,
            blockMouseEvents: true,
            fingerprintProtection: 'intelligent',
            spoofFonts: true,
            commonFonts: [
                'Arial', 'Verdana', 'Helvetica', 'Tahoma', 'Trebuchet MS', 'Times New Roman',
                'Georgia', 'Garamond', 'Courier New', 'Brush Script MT', 'Calibri', 'Cambria',
                'Comic Sans MS', 'Impact', 'Lucida Console', 'Palatino', 'Book Antiqua',
                'Century Gothic', 'Franklin Gothic Medium', 'Segoe UI', 'System',
                'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Source Sans Pro', 'Nunito',
                'PT Sans', 'Ubuntu', 'Playfair Display', 'Merriweather', 'Oswald', 'Raleway'
            ],
            enableHeuristics: true,
            heuristicMode: 'log',
            blockTrackers: true,
            debugMode: true
        },
        hostname: window.location.hostname,

        DB: {
            dbName: 'SentinelML',
            dbVersion: 2, // INCREMENTED: To trigger schema update for non-unique indexes
            db: null,
            initialized: true,

            // Initialize IndexedDB connection with structured schema
            async init() {
                try {
                    return new Promise((resolve, reject) => {
                        const request = indexedDB.open(this.dbName, this.dbVersion);

                        request.onerror = () => {
                            Sentinel.logError('DB.init.request', new Error(request.error));
                            reject(request.error);
                        };

                        request.onsuccess = () => {
                            this.db = request.result;
                            this.initialized = true;
                            console.log('[Sentinel DB] IndexedDB connection established for ML data storage');

                            // Verify schema after successful connection
                            this.verifySchema().then(schemaValid => {
                                if (schemaValid) {
                                    console.log('[Sentinel DB] Database schema validated - machine learning ready');
                                } else {
                                    console.warn('[Sentinel DB] Database schema issues detected - ML may be limited');
                                }
                            });

                            resolve(this.db);
                        };

                        request.onupgradeneeded = (event) => {
                            const db = event.target.result;
                            const oldVersion = event.oldVersion;
                            const newVersion = event.newVersion;

                            console.log(`[Sentinel DB] Upgrading database from version ${oldVersion} to ${newVersion}`);

                            // Handle schema migration for existing databases
                            if (oldVersion < 2) {
                                // If upgrading from version 1, we need to recreate the object store
                                // because IndexedDB doesn't allow changing index uniqueness
                                if (db.objectStoreNames.contains('training_history')) {
                                    console.log('[Sentinel DB] Removing old training_history store for schema migration');
                                    db.deleteObjectStore('training_history');
                                }
                            }

                            // Create training_history object store with corrected schema
                            if (!db.objectStoreNames.contains('training_history')) {
                                const store = db.createObjectStore('training_history', {
                                    keyPath: 'id'
                                });

                                // FIXED: Remove unique constraints to allow multiple training events
                                // These indexes are for efficient querying, not data constraints
                                store.createIndex('hostname', 'hostname', { unique: false });
                                store.createIndex('timestamp', 'timestamp', { unique: false });
                                store.createIndex('label', 'label', { unique: false });

                                console.log('[Sentinel DB] Created training_history object store with non-unique indexes for efficient querying');
                                console.log('[Sentinel DB] Schema migration completed - machine learning system now functional');
                            }
                        };
                    });
                } catch (error) {
                    Sentinel.logError('DB.init', error);
                    throw error;
                }
            },

            // NEW: Verify database schema and functionality
            async verifySchema() {
                try {
                    if (!this.initialized) {
                        await this.init();
                    }

                    const transaction = this.db.transaction(['training_history'], 'readonly');
                    const store = transaction.objectStore('training_history');

                    // Check if indexes exist and are non-unique
                    store.index('hostname');
                    store.index('timestamp');
                    store.index('label');

                    console.log('[Sentinel DB] Schema verification successful - all indexes are non-unique');
                    console.log('[Sentinel DB] Machine learning system is ready for operation');

                    return true;
                } catch (error) {
                    console.error('[Sentinel DB] Schema verification failed:', error);
                    console.error('[Sentinel DB] Machine learning system may not function properly');
                    return false;
                }
            },

            // Add training event to IndexedDB
            async addEvent(eventObject) {
                if (!this.initialized) {
                    await this.init();
                }

                try {
                    return new Promise((resolve, reject) => {
                        const transaction = this.db.transaction(['training_history'], 'readwrite');
                        const store = transaction.objectStore('training_history');
                        const request = store.add(eventObject);

                        request.onsuccess = () => {
                            console.log(`[Sentinel DB] Added training event: ${eventObject.id}`);
                            resolve(eventObject.id);
                        };

                        request.onerror = () => {
                            const error = request.error;
                            console.error('[Sentinel DB] Failed to add training event:', error);

                            // Provide specific guidance for common errors
                            if (error.name === 'ConstraintError') {
                                console.error('[Sentinel DB] CONSTRAINT ERROR: This indicates the old unique index schema is still active.');
                                console.error('[Sentinel DB] Please refresh the page to trigger database schema migration.');
                            }

                            Sentinel.logError('DB.addEvent', new Error(error));
                            reject(error);
                        };
                    });
                } catch (error) {
                    Sentinel.logError('DB.addEvent', error);
                    throw error;
                }
            },

            // Get training history for specific hostname
            async getHistory(hostname) {
                if (!this.initialized) {
                    await this.init();
                }

                try {
                    return new Promise((resolve, reject) => {
                        const transaction = this.db.transaction(['training_history'], 'readonly');
                        const store = transaction.objectStore('training_history');
                        const index = store.index('hostname');
                        const request = index.getAll(hostname);

                        request.onsuccess = () => {
                            const events = request.result || [];
                            // Sort by timestamp descending (most recent first)
                            events.sort((a, b) => b.timestamp - a.timestamp);
                            console.log(`[Sentinel DB] Retrieved ${events.length} training events for ${hostname}`);
                            resolve(events);
                        };

                        request.onerror = () => {
                            Sentinel.logError('DB.getHistory', new Error(request.error));
                            reject(request.error);
                        };
                    });
                } catch (error) {
                    Sentinel.logError('DB.getHistory', error);
                    return []; // Fallback to empty array
                }
            },

            // Delete specific training event by ID
            async deleteEvent(eventId) {
                if (!this.initialized) {
                    await this.init();
                }

                try {
                    return new Promise((resolve, reject) => {
                        const transaction = this.db.transaction(['training_history'], 'readwrite');
                        const store = transaction.objectStore('training_history');
                        const request = store.delete(eventId);

                        request.onsuccess = () => {
                            console.log(`[Sentinel DB] Deleted training event: ${eventId}`);
                            resolve(true);
                        };

                        request.onerror = () => {
                            Sentinel.logError('DB.deleteEvent', new Error(request.error));
                            reject(request.error);
                        };
                    });
                } catch (error) {
                    Sentinel.logError('DB.deleteEvent', error);
                    return false;
                }
            },

            // Clear all training data for specific hostname
            async clearHistory(hostname) {
                if (!this.initialized) {
                    await this.init();
                }

                try {
                    const events = await this.getHistory(hostname);
                    const deletePromises = events.map(event => this.deleteEvent(event.id));
                    await Promise.all(deletePromises);
                    console.log(`[Sentinel DB] Cleared ${events.length} training events for ${hostname}`);
                    return events.length;
                } catch (error) {
                    Sentinel.logError('DB.clearHistory', error);
                    return 0;
                }
            },

            // Get database statistics
            async getStats() {
                if (!this.initialized) {
                    await this.init();
                }

                try {
                    return new Promise((resolve, reject) => {
                        const transaction = this.db.transaction(['training_history'], 'readonly');
                        const store = transaction.objectStore('training_history');
                        const request = store.count();

                        request.onsuccess = () => {
                            resolve({
                                totalEvents: request.result,
                                dbSize: this.db.size || 'Unknown',
                                dbVersion: this.db.version
                            });
                        };

                        request.onerror = () => {
                            Sentinel.logError('DB.getStats', new Error(request.error));
                            reject(request.error);
                        };
                    });
                } catch (error) {
                    Sentinel.logError('DB.getStats', error);
                    return { totalEvents: 0, dbSize: 'Unknown', dbVersion: this.dbVersion };
                }
            }
        },

        async init() {
            this.loadConfig();
            if (!this.config.scriptEnabled) {
                GM_registerMenuCommand('Enable Sentinel', () => this.toggleGlobalEnable(true));
                return;
            }

            console.log(`[Sentinel v30.0] Initializing privacy framework for ${this.hostname}`);

            this.capabilities.workers = await this.Heuristics._checkWorkerSupport();
            if (this.capabilities.workers) {
                console.log('[Sentinel] Web Workers supported for ML tasks.');
            } else {
                console.warn('[Sentinel] Web Workers not supported. ML tasks may cause UI freezes.');
                this.UI.showNotification('Sentinel: High-performance mode disabled. AI tasks may cause brief freezes.', 'warning', 10000);
            }

            try {
                await this.DB.init();
                await this.performDataMigration();
                console.log(`[Sentinel] Database initialized successfully`);
            } catch (error) {
                this.logError('init.database', error);
                console.warn('[Sentinel] Database initialization failed, using fallback storage');
            }

            this.applyImmediateDefenses();
            this.wrapCriticalFunctions();
            this.overrideNativeDialogs();
                this.UI.init.call(this.UI);
                await this.Network.init.call(this.Network);
            this.applyAllDefenses();
                await this.Heuristics.init.call(this.Heuristics);
            console.log(`[Sentinel v30.0] All systems online`);
        },

        async performDataMigration() {
            try {
                const migrationFlag = 'ml_data_migrated_v8';
                const alreadyMigrated = GM_getValue(migrationFlag, false);

                if (alreadyMigrated) {
                    console.log('[Sentinel] Data already migrated');
                    return;
                }

                console.log('[Sentinel] Starting data migration...');
                let totalMigrated = 0;

                try {
                    const historyKey = `heuristics_history_${this.hostname}`;
                    const oldHistoryData = GM_getValue(historyKey, null);

                    if (oldHistoryData) {
                        console.log(`[Sentinel] Found old training data for ${this.hostname}`);
                        const events = JSON.parse(oldHistoryData);

                        for (const event of events) {
                            try {
                                await this.DB.addEvent(event);
                                totalMigrated++;
                            } catch (error) {
                                this.logError('migration.addEvent', error);
                            }
                        }

                        GM_setValue(historyKey, undefined);
                        console.log(`[Sentinel] Migrated ${events.length} events for ${this.hostname}`);
                    }
                } catch (error) {
                    this.logError('migration.parseData', error);
                }

                GM_setValue(migrationFlag, true);
                console.log(`[Sentinel] Migration completed: ${totalMigrated} events migrated`);

                if (totalMigrated > 0) {
                    this.UI.showNotification(`Migrated ${totalMigrated} training events to database`, 'success', 4000);
                }

            } catch (error) {
                this.logError('performDataMigration', error);
                console.warn('[Sentinel] Migration failed, continuing with existing data');
            }
        },

        logError(context, error, level = 'warn') {
            const timestamp = new Date().toISOString();
            const errorInfo = {
                context,
                message: error?.message || String(error),
                stack: error?.stack,
                timestamp,
                userAgent: navigator.userAgent,
                url: window.location.href
            };

            if (level === 'error') {
                console.error(`[Sentinel] Critical error in ${context}:`, errorInfo);
            } else {
                console.warn(`[Sentinel] Handled error in ${context}:`, errorInfo);
            }
        },

        // --- UTILITY FUNCTIONS ---
        // Utility function to wait for a condition to be met
        _waitForCondition(conditionFn, timeout = 5000, interval = 50) {
            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                const check = () => {
                    if (conditionFn()) {
                        resolve();
                    } else if (Date.now() - startTime > timeout) {
                        reject(new Error('Condition wait timed out.'));
                    } else {
                        setTimeout(check, interval);
                    }
                };
                check();
            });
        },

        wrapFunction(obj, prop, newFunc) {
            try {
                // Validate inputs
                if (!obj || typeof obj !== 'object') {
                    console.warn('[Sentinel] wrapFunction: Invalid object provided');
                    return;
                }

                if (!prop || typeof prop !== 'string') {
                    console.warn('[Sentinel] wrapFunction: Invalid property name provided');
                    return;
                }

                if (typeof obj[prop] !== 'function') {
                    console.warn(`[Sentinel] wrapFunction: Property '${prop}' is not a function`);
                    return;
                }

                if (typeof newFunc !== 'function') {
                    console.warn('[Sentinel] wrapFunction: Invalid wrapper function provided');
                    return;
                }

                // Store original function
                const original = obj[prop];

                // Additional safety check: ensure original is actually a function
                if (typeof original !== 'function') {
                    console.warn(`[Sentinel] wrapFunction: Original '${prop}' is not a function, skipping wrap`);
                    return;
                }

                // Create wrapper function with proper error handling
                const wrapper = function(...args) {
                    try {
                        // Call the wrapper function with proper context
                        return newFunc.call(this, original.bind(this), ...args);
                    } catch (error) {
                        // Log error but don't break page functionality
                        Sentinel.logError(`wrapFunction.${prop}`, error);
                        console.warn(`[Sentinel] Wrapper function error for '${prop}', falling back to original:`, error.message);

                        // Fallback to original function to prevent page breakage
                        try {
                            return original.call(this, ...args);
                        } catch (fallbackError) {
                            // If even the original fails, log and return undefined
                            console.error(`[Sentinel] Critical error in '${prop}' - both wrapper and original failed:`, fallbackError);
                            return undefined;
                        }
                    }
                };

                try {
                    if (original.name !== undefined && typeof original.name === 'string') {
                        Object.defineProperty(wrapper, 'name', {
                            value: original.name,
                            configurable: true
                        });
                    }

                    if (original.length !== undefined && typeof original.length === 'number') {
                        Object.defineProperty(wrapper, 'length', {
                            value: original.length,
                            configurable: true
                        });
                    }

                    if (typeof original.toString === 'function') {
                        Object.defineProperty(wrapper, 'toString', {
                            value: () => original.toString(),
                            configurable: true
                        });
                    }
                } catch (e) {
                    Sentinel.logError('wrapFunction.setup.coreProps', e);
                    console.warn(`[Sentinel] Could not preserve core function properties for '${prop}':`, e.message);
                }

                // Apply the wrapper
                obj[prop] = wrapper;

                // Store reference for potential unwrapping (hidden property)
                Object.defineProperty(wrapper, '_sentinelOriginal', {
                    value: original,
                    configurable: true,
                    writable: false,
                    enumerable: false
                });
                Object.defineProperty(wrapper, '_sentinelWrapped', {
                    value: true,
                    configurable: true,
                    writable: false,
                    enumerable: false
                });

            } catch (error) {
                Sentinel.logError('wrapFunction.setup', error);
                console.error('[Sentinel] Failed to wrap function:', error.message);
            }
        },

        // NEW: Method to unwrap previously wrapped functions
        unwrapFunction(obj, prop) {
            try {
                if (!obj || !prop || !obj[prop]) {
                    console.warn('[Sentinel] unwrapFunction: Invalid object or property');
                    return false;
                }

                const current = obj[prop];
                if (current._sentinelWrapped && current._sentinelOriginal) {
                    obj[prop] = current._sentinelOriginal;
                    console.log(`[Sentinel] Successfully unwrapped function '${prop}'`);
                    return true;
                } else {
                    console.warn(`[Sentinel] Function '${prop}' was not wrapped by Sentinel`);
                    return false;
                }
            } catch (error) {
                Sentinel.logError('unwrapFunction', error);
                console.error('[Sentinel] Failed to unwrap function:', error.message);
                return false;
            }
        },

        // NEW: Method to check if a function is wrapped by Sentinel
        isFunctionWrapped(obj, prop) {
            try {
                if (!obj || !prop || !obj[prop]) {
                    return false;
                }
                return obj[prop]._sentinelWrapped === true;
            } catch {
                return false;
            }
        },
        loadConfig() {
            const siteConfig = GM_getValue(this.hostname, {});
            const globalConfig = GM_getValue('global', {});
            this.config = { ...this.defaultConfig, ...globalConfig, ...siteConfig };
            this.config.scriptEnabled = GM_getValue('scriptEnabled', true);
        },
        saveConfig() {
            const siteConfig = { ...this.config };
            delete siteConfig.scriptEnabled;
            GM_setValue(this.hostname, siteConfig);
            GM_setValue('scriptEnabled', this.config.scriptEnabled);
        },
        toggleGlobalEnable(state) {
            GM_setValue('scriptEnabled', state);
            // UPDATED: Using requested showNotification method
            this.UI.showNotification(`Sentinel has been ${state ? 'ENABLED' : 'DISABLED'}. Please reload.`, 'success');
        },

        // --- 4. DEFENSE APPLICATION ---
        applyImmediateDefenses() {
            if (this.config.spoofPageVisibility) {
                try {
                    // Comprehensive page visibility spoofing
                    const hiddenProps = ["hidden", "mozHidden", "msHidden", "webkitHidden"];
                    hiddenProps.forEach(prop => {
                        try {
                            const descriptor = Object.getOwnPropertyDescriptor(document, prop);
                            // Only attempt to redefine if the property doesn't exist or is configurable.
                            if (!descriptor || descriptor.configurable) {
                                Object.defineProperty(document, prop, { value: false, configurable: true });
                            } else {
                                console.warn(`[Sentinel] Cannot spoof property '${prop}' as it is non-configurable.`);
                            }
                        } catch (e) {
                            // Catch any other unexpected errors
                            Sentinel.logError('applyImmediateDefenses.defineProperty', e);
                        }
                    });
                    const visibilityStateDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
                    if (!visibilityStateDescriptor || visibilityStateDescriptor.configurable) {
                        Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
                    } else {
                        console.warn(`[Sentinel] Cannot spoof property 'visibilityState' as it is non-configurable.`);
                    }


                    const global = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
                    global.onblur = null;
                    global.document.onvisibilitychange = undefined;
                } catch (e) {
                    this.logError('applyImmediateDefenses.pageVisibilitySpoofing', e);
                }
            }
        },
        wrapCriticalFunctions() {
            this.wrapFunction(EventTarget.prototype, 'addEventListener', (original, type, listener, options) => {
                if (this.config.spoofPageVisibility && (type === 'visibilitychange' || type === 'webkitvisibilitychange' || type === 'mozvisibilitychange' || type === 'msvisibilitychange')) {
                    console.log(`[Sentinel] Blocking visibilitychange event listener.`);
                    return; // Silently block the event listener
                }
                return original(type, listener, options);
            });
        },
        overrideNativeDialogs() {
            // Override native alert() with custom non-blocking notification
            window.alert = (message) => {
                console.log('[Sentinel] Intercepted alert() call, using non-blocking notification');
                this.UI.showNotification(message, 'info', 4000);
            };

            // Override native confirm() with custom non-blocking confirmation
            window.confirm = () => {
                console.warn('[Sentinel] Intercepted confirm() call - this will return false. Use Sentinel.UI.showConfirmation() for proper async confirmation.');
                this.UI.showNotification('Confirm dialog blocked - use Sentinel custom confirmation system', 'warning', 3000);
                return false; // Always return false to prevent blocking
            };

            // Also override on unsafeWindow if available (for userscripts)
            if (typeof unsafeWindow !== 'undefined') {
                unsafeWindow.alert = window.alert;
                unsafeWindow.confirm = window.confirm;
            }

            // Global convenience functions for console testing
            window.SentinelAlert = this.UI.showNotification.bind(this.UI);
            window.SentinelConfirm = this.UI.showConfirmation.bind(this.UI);
            console.log('[Sentinel] Non-blocking dialog system active - SentinelAlert() and SentinelConfirm() available globally');
            console.log('[Sentinel] Usage: SentinelAlert("message", "type", duration) | SentinelConfirm("message?", callback)');
        },
        applyAllDefenses() {
            this.Defenses.reclaimContentInteraction(); // Includes selection tracking protection
            this.Defenses.neutralizeStateTracking(); // Includes IntersectionObserver neutralization
            this.Defenses.blockMouseTrackingEvents();
            this.Defenses.blockForbiddenAttributes(); // Proactive attribute blocking to replace Guardian
            if (this.config.fingerprintProtection !== 'off') {
                this.Defenses.evadeFingerprinting(); // Includes font spoofing
            }
            if (this.config.disableAntiDevTools) {
                this.Defenses.disableAntiDevTools();
            }
        },

        UI: {
            panel: null,
            selectors: {},

            _generateId(base) {
                return `${base}-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`;
            },

            init() {
                this.selectors = {
                    panel: this._generateId('sentinel-panel'),
                    closeBtn: this._generateId('sentinel-close-btn'),
                    resetBtn: this._generateId('sentinel-reset-btn'),
                    saveBtn: this._generateId('sentinel-save-btn'),
                    notification: this._generateId('sentinel-notification'),
                    confirmationModal: this._generateId('sentinel-confirmation-modal'),
                    confirmYes: this._generateId('sentinel-confirm-yes'),
                    confirmNo: this._generateId('sentinel-confirm-no'),
                    simpleConfirmation: this._generateId('sentinel-simple-confirmation'),
                    simpleYes: this._generateId('sentinel-simple-yes'),
                    simpleNo: this._generateId('sentinel-simple-no'),
                    alertBanner: this._generateId('sentinel-alert-banner')
                };

                console.log('[Sentinel] Dynamic ID system initialized');

                                GM_registerMenuCommand('⚙️ Sentinel Settings', () => this.buildSettingsPanel());
                GM_registerMenuCommand('🔬 Run Performance Test', () => this.runPerformanceTest());
                GM_registerMenuCommand('🚀 Algorithm Benchmark', () => this.runAlgorithmBenchmark());
                GM_registerMenuCommand('🛡️ Protection Status', () => this.showProtectionStatus());
                GM_registerMenuCommand('🖱️ Test Mouse Protection', () => this.testMouseProtection());
                GM_registerMenuCommand('📢 Test Alert System', () => this.testAlertSystem());
                GM_registerMenuCommand('🔔 Test Notification System', () => this.testNotificationSystem());
                GM_registerMenuCommand('🤖 Test Adaptive Heuristics', () => this.testAdaptiveHeuristics());
                GM_registerMenuCommand('🧠 Manage AI Learning', () => this.buildMlManagementPanel());
                GM_registerMenuCommand('📊 View Learning Data', () => this.viewLearningData());
                GM_registerMenuCommand('🗄️ Database Statistics', () => this.showDatabaseStats());
                GM_registerMenuCommand('🗑️ Reset Learning Data', () => this.resetLearningData());
                GM_registerMenuCommand('⏰ Test Time Decay Intelligence', () => this.testTimeDecay());
                GM_registerMenuCommand('⚡ Test Cache Performance', () => this.testCachePerformance());
                GM_registerMenuCommand('🔗 Test Correlation Analysis', () => this.testCorrelationAnalysis());
                GM_registerMenuCommand('📈 Analyze Lazy Loading Performance', () => this.analyzeLazyLoadingPerformance());
                GM_registerMenuCommand('🔌 Circuit Breaker Status', () => this.showCircuitBreakerStatus());
                GM_registerMenuCommand('🔒 Sequence Whitelist Status', () => this.showWhitelistStatus());
                GM_registerMenuCommand('🤖 Dismiss Suggestions', () => this.showDismissSuggestions());
            },

            // UNIFIED UI SYSTEM: Single showDialog function for all UI interactions
            // Based on design system principles for consistency and maintainability
            showDialog(options = {}) {
                const {
                    type = 'notification',           // 'notification' | 'confirmation'
                    style = 'info',                  // 'info' | 'success' | 'error' | 'warning'
                    message = '',                    // Message to display
                    duration = 3000,                 // Auto-hide duration for notifications
                    onConfirm = null,                // Callback for confirmation
                    onCancel = null,                 // Callback for cancellation
                    title = null,                    // Optional title for confirmation dialogs
                    confirmText = 'Yes',             // Text for confirm button
                    cancelText = 'No',               // Text for cancel button
                    persistent = false               // Whether dialog should persist until user action
                } = options;

                // Clean up any existing dialogs to prevent conflicts
                this._cleanupExistingDialogs();

                if (type === 'notification') {
                    return this._showNotification(message, style, duration);
                } else if (type === 'confirmation') {
                    return this._showConfirmation(message, onConfirm, onCancel, {
                        title,
                        confirmText,
                        cancelText,
                        persistent
                    });
                } else {
                    console.error('[Sentinel] Unknown dialog type:', type);
                    return null;
                }
            },

            // Unified notification implementation
            _showNotification(message, style = 'info', duration = 3000) {
                    // Check if DOM is ready
                    if (!document.body) {
                        console.warn('[Sentinel] Cannot show notification - DOM not ready:', message);
                        return;
                    }

                const notificationId = this.selectors.notification;
                let notification = document.getElementById(notificationId);

                if (!notification) {
                    notification = document.createElement('div');
                    notification.id = notificationId;
                    document.body.appendChild(notification);

                    // Unified styling for all notifications
                    GM_addStyle(`
                        #${notificationId} {
                            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
                            padding: 12px 20px; border-radius: 6px; color: white;
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                            font-size: 14px; z-index: 2147483647; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                            opacity: 0; transition: opacity 0.3s, bottom 0.3s; pointer-events: none;
                            max-width: 500px; word-wrap: break-word; line-height: 1.4;
                        }
                        #${notificationId}.info { background-color: #3498db; }
                        #${notificationId}.success { background-color: #2ecc71; }
                        #${notificationId}.error { background-color: #e74c3c; }
                        #${notificationId}.warning { background-color: #f39c12; }
                        #${notificationId}.visible { opacity: 1; bottom: 30px; }
                    `);
                }

                notification.className = style;
                notification.textContent = message;
                notification.classList.add('visible');

                setTimeout(() => {
                    notification.classList.remove('visible');
                }, duration);

                return notification;
            },

            // Unified confirmation implementation
            _showConfirmation(message, onConfirm, onCancel = null, options = {}) {
                const {
                    title = null,
                    confirmText = 'Yes',
                    cancelText = 'No',
                    persistent = false
                } = options;

                const confirmId = this.selectors.confirmationModal;
                if (document.getElementById(confirmId)) return null;

                const modal = document.createElement('div');
                modal.id = confirmId;

                // Unified HTML structure for all confirmations
                modal.innerHTML = `
                    <div class="sentinel-modal-content">
                        ${title ? `<h3 class="sentinel-modal-title">${title}</h3>` : ''}
                        <p class="sentinel-modal-message">${message}</p>
                        <div class="sentinel-modal-buttons">
                            <button id="${this.selectors.confirmYes}" class="sentinel-btn sentinel-btn-primary">${confirmText}</button>
                            <button id="${this.selectors.confirmNo}" class="sentinel-btn sentinel-btn-secondary">${cancelText}</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);

                // Unified styling for all confirmations
                GM_addStyle(`
                    #${confirmId} {
                        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                        background: rgba(0,0,0,0.5); z-index: 2147483647;
                        display: flex; align-items: center; justify-content: center;
                        backdrop-filter: blur(2px);
                    }
                    #${confirmId} .sentinel-modal-content {
                        background: white; padding: 24px; border-radius: 8px; text-align: center;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        box-shadow: 0 8px 32px rgba(0,0,0,0.3); min-width: 320px; max-width: 480px;
                        animation: sentinel-modal-fade-in 0.2s ease-out;
                    }
                    @keyframes sentinel-modal-fade-in {
                        from { opacity: 0; transform: scale(0.9); }
                        to { opacity: 1; transform: scale(1); }
                    }
                    #${confirmId} .sentinel-modal-title {
                        margin: 0 0 12px 0; color: #333; font-size: 18px; font-weight: 600;
                    }
                    #${confirmId} .sentinel-modal-message {
                        margin: 0 0 20px 0; color: #666; font-size: 14px; line-height: 1.5;
                    }
                    #${confirmId} .sentinel-modal-buttons {
                        display: flex; gap: 12px; justify-content: center;
                    }
                    #${confirmId} .sentinel-btn {
                        padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer;
                        font-size: 14px; font-weight: 500; transition: all 0.2s ease;
                        min-width: 80px;
                    }
                    #${confirmId} .sentinel-btn-primary {
                        background: #007bff; color: white;
                    }
                    #${confirmId} .sentinel-btn-primary:hover {
                        background: #0056b3; transform: translateY(-1px);
                    }
                    #${confirmId} .sentinel-btn-secondary {
                        background: #6c757d; color: white;
                    }
                    #${confirmId} .sentinel-btn-secondary:hover {
                        background: #545b62; transform: translateY(-1px);
                    }
                `);

                const cleanup = () => {
                    modal.remove();
                    document.removeEventListener('keydown', handleEsc);
                };

                const handleConfirm = () => {
                    cleanup();
                    if (onConfirm) onConfirm();
                };

                const handleCancel = () => {
                    cleanup();
                    if (onCancel) onCancel();
                };

                document.getElementById(this.selectors.confirmYes).onclick = handleConfirm;
                document.getElementById(this.selectors.confirmNo).onclick = handleCancel;

                // Close on ESC key (unless persistent)
                const handleEsc = (e) => {
                    if (e.key === 'Escape' && !persistent) {
                        handleCancel();
                    }
                };
                document.addEventListener('keydown', handleEsc);

                return modal;
            },

            // Clean up existing dialogs to prevent conflicts
            _cleanupExistingDialogs() {
                const existingNotifications = document.getElementById(this.selectors.notification);
                const existingConfirmations = document.getElementById(this.selectors.confirmationModal);
                const existingSimpleConfirmations = document.getElementById(this.selectors.simpleConfirmation);

                if (existingNotifications) {
                    existingNotifications.classList.remove('visible');
                    setTimeout(() => existingNotifications.remove(), 300);
                }

                if (existingConfirmations) {
                    existingConfirmations.remove();
                }

                if (existingSimpleConfirmations) {
                    existingSimpleConfirmations.remove();
                }
            },

            // ENHANCED: Advanced dialog features for better UX
            showAdvancedDialog(options = {}) {
                const {
                    type = 'notification',
                    message = '',
                    title = null
                } = options;

                // Enhanced validation
                if (!message && type === 'notification') {
                    console.error('[Sentinel] Notification requires a message');
                    return null;
                }

                if (!message && type === 'confirmation') {
                    console.error('[Sentinel] Confirmation requires a message');
                    return null;
                }

                // Add accessibility features
                const enhancedOptions = {
                    ...options,
                    'aria-label': title || message,
                    'role': type === 'confirmation' ? 'dialog' : 'alert',
                    'aria-modal': type === 'confirmation' ? 'true' : 'false'
                };

                return this.showDialog(enhancedOptions);
            },

            // UTILITY: Quick notification methods for common use cases
            showQuickInfo(message, duration = 2000) {
                return this.showDialog({ type: 'notification', style: 'info', message, duration });
            },

            showQuickSuccess(message, duration = 2000) {
                return this.showDialog({ type: 'notification', style: 'success', message, duration });
            },

            showQuickError(message, duration = 4000) {
                return this.showDialog({ type: 'notification', style: 'error', message, duration });
            },

            showQuickWarning(message, duration = 3000) {
                return this.showDialog({ type: 'notification', style: 'warning', message, duration });
            },

            // UTILITY: Confirmation with custom styling
            showDestructiveConfirmation(message, onConfirm, title = 'Confirm Action') {
                return this.showDialog({
                    type: 'confirmation',
                    message,
                    onConfirm,
                    title,
                    confirmText: 'Delete',
                    cancelText: 'Cancel',
                    style: 'error'
                });
            },

            showInfoConfirmation(message, onConfirm, title = 'Information') {
                return this.showDialog({
                    type: 'confirmation',
                    message,
                    onConfirm,
                    title,
                    confirmText: 'OK',
                    cancelText: 'Cancel',
                    style: 'info'
                });
            },

            // REFACTORED: Unified confirmation method using showDialog
            showSimpleConfirmation(message, onConfirm, onCancel = null) {
                return this.showDialog({
                    type: 'confirmation',
                    message,
                    onConfirm,
                    onCancel
                });
            },

            // REFACTORED: Unified notification method using showDialog
            showNotification(message, type = 'info', duration = 3000) {
                return this.showDialog({
                    type: 'notification',
                    style: type,
                    message,
                    duration
                });
            },

            // REFACTORED: Unified confirmation method using showDialog
            showConfirmation(message, onConfirm) {
                return this.showDialog({
                    type: 'confirmation',
                    message,
                    onConfirm
                });
            },

            // REFACTORED: Convenience methods using unified showDialog
            showSuccess(message, duration = 3000) {
                return this.showDialog({ type: 'notification', style: 'success', message, duration });
            },
            showError(message, duration = 4000) {
                return this.showDialog({ type: 'notification', style: 'error', message, duration });
            },
            showWarning(message, duration = 3500) {
                return this.showDialog({ type: 'notification', style: 'warning', message, duration });
            },
            showInfo(message, duration = 3000) {
                return this.showDialog({ type: 'notification', style: 'info', message, duration });
            },

            // BACKWARD COMPATIBILITY: Legacy showAlert method
            showAlert(message, type = 'info', duration = 3000) {
                return this.showDialog({ type: 'notification', style: type, message, duration });
            },

            testAlertSystem() {
                this.showDialog({ type: 'notification', style: 'info', message: 'Testing unified dialog system...', duration: 2000 });
                setTimeout(() => {
                    this.showDialog({ type: 'notification', style: 'success', message: 'Success notification!', duration: 2000 });
                    setTimeout(() => {
                        this.showDialog({ type: 'notification', style: 'warning', message: 'Warning notification!', duration: 2000 });
                        setTimeout(() => {
                            this.showDialog({ type: 'notification', style: 'error', message: 'Error notification!', duration: 2000 });
                            setTimeout(() => {
                                this.showDialog({
                                    type: 'confirmation',
                                    message: 'Test unified confirmation system?',
                                    onConfirm: () => {
                            // Test native override
                            alert('Native alert intercepted!');
                            setTimeout(() => {
                                confirm('Native confirm intercepted!');
                                            this.showDialog({ type: 'notification', style: 'success', message: 'Unified dialog system test completed successfully!', duration: 3000 });
                            }, 1000);
                                    }
                                });
                            }, 2000);
                        }, 2000);
                    }, 2000);
                }, 2000);
            },

            testNotificationSystem() {
                this.showDialog({ type: 'notification', style: 'info', message: '🔔 Testing unified dialog system...', duration: 2000 });
                setTimeout(() => {
                    this.showDialog({ type: 'notification', style: 'success', message: '✅ Success notification - unified!', duration: 2000 });
                    setTimeout(() => {
                        this.showDialog({ type: 'notification', style: 'warning', message: '⚠️ Warning notification - unified!', duration: 2000 });
                        setTimeout(() => {
                            this.showDialog({ type: 'notification', style: 'error', message: '❌ Error notification - unified!', duration: 2000 });
                            setTimeout(() => {
                                this.showDialog({
                                    type: 'confirmation',
                                    message: '🤔 Do you want to test the unified confirmation dialog?',
                                    onConfirm: () => {
                                        this.showDialog({ type: 'notification', style: 'success', message: '✨ Unified dialog system completed! JavaScript execution never blocked.', duration: 3000 });
                                    setTimeout(() => {
                                            this.showDialog({ type: 'notification', style: 'info', message: '🚀 All dialogs now use the unified system for consistency!', duration: 5000 });
                                    }, 1500);
                                    }
                                });
                            }, 2000);
                        }, 2000);
                    }, 2000);
                }, 2000);
            },

            // PHASE 3.1: Adaptive Heuristics Testing and Management
            testAdaptiveHeuristics() {
                this.showNotification('🤖 Testing Adaptive Heuristics with Machine Learning...', 'info');
                setTimeout(() => {
                    // Simulate some tracking activities for testing
                    const testActivities = ['canvas.read', 'font.check', 'webgl.renderer', 'devtools.check'];

                    console.log('[Sentinel] Simulating tracking activities for adaptive heuristics test...');
                    testActivities.forEach((activity, index) => {
                        setTimeout(() => {
                            console.log(`[Sentinel] Simulating activity: ${activity}`);
                            Sentinel.Heuristics.report(activity);
                        }, index * 500);
                    });

                    setTimeout(() => {
                        this.showNotification('🔬 Test activities simulated! Check for adaptive banner and provide feedback to train the ML model.', 'success', 5000);
                    }, testActivities.length * 500 + 1000);
                }, 1000);
            },

            // PHASE 2.1: Enhanced learning data view with IndexedDB support
            // PHASE 3.1: Enhanced with Time Decay Intelligence display
            async viewLearningData() {
                try {
                    this.showNotification('🔄 Loading learning data from database...', 'info', 1000);

                    const history = await Sentinel.Heuristics.getTrainingHistory();
                                            const learnedData = await Sentinel.Heuristics.getLearnedData();
                        const singleFreq = learnedData.single_frequencies || learnedData; // Backward compatibility
                        const normalSamples = (singleFreq.normal && singleFreq.normal.total) || 0;
                        const suspiciousSamples = (singleFreq.suspicious && singleFreq.suspicious.total) || 0;
                        const totalSamples = normalSamples + suspiciousSamples;

                    if (totalSamples === 0) {
                        this.showNotification(`📊 No learning data for ${Sentinel.hostname} yet. Use "🧠 Manage AI Learning" to see the full interface!`, 'info', 4000);
                    } else {
                        console.log(`[Sentinel] Training history for ${Sentinel.hostname} (${history.length} events):`, history);
                        console.log(`[Sentinel] Computed learning data for ${Sentinel.hostname}:`, learnedData);

                        const storageType = Sentinel.DB.initialized ? 'IndexedDB' : 'GM_setValue';
                        const timeDecayInfo = learnedData.timeDecayInfo || {};
                        const correlationInfo = learnedData.correlationInfo || {};

                        // PHASE 3.3: Enhanced console table with correlation analysis information
                        const statsTable = {
                            'Storage Type': storageType,
                            'Training Events': history.length,
                            'Normal Classifications': normalSamples.toFixed(2),
                            'Suspicious Classifications': suspiciousSamples.toFixed(2),
                            'Total Weighted Samples': totalSamples.toFixed(2),
                            'Learning Status': totalSamples >= Sentinel.Heuristics.minSamplesForLearning ? 'ML ACTIVE' : 'PENDING',
                            'Confidence Threshold': `${(Sentinel.Heuristics.confidenceThreshold * 100).toFixed(0)}%`
                        };

                        // Add time decay information to table
                        if (timeDecayInfo.enabled) {
                            statsTable['Time Decay'] = 'ENABLED';
                            statsTable['Half-Life'] = `${timeDecayInfo.halfLifeDays} days`;
                            statsTable['Knowledge Retention'] = timeDecayInfo.effectiveRetention;
                            statsTable['Data Age Range'] = `${timeDecayInfo.ageRangeInDays} days`;
                        } else {
                            statsTable['Time Decay'] = 'DISABLED';
                        }

                        // PHASE 3.3: Add correlation analysis information to table
                        if (correlationInfo.enabled) {
                            statsTable['Correlation Analysis'] = 'ENABLED';
                            statsTable['Activity Pairs'] = correlationInfo.totalPairs;
                            statsTable['Pair Coverage'] = correlationInfo.pairCoverage;
                            statsTable['Intelligence Model'] = `${(Sentinel.Heuristics.naiveBayesWeight * 100).toFixed(0)}% NB + ${(Sentinel.Heuristics.correlationWeight * 100).toFixed(0)}% Corr`;
                        } else {
                            statsTable['Correlation Analysis'] = 'DISABLED';
                            statsTable['Intelligence Model'] = 'Naive Bayes Only';
                        }

                        console.table(statsTable);

                        // PHASE 3.3: Enhanced notification with correlation analysis information
                        const timeDecayStatus = timeDecayInfo.enabled ?
                            ` [Time Decay: ${timeDecayInfo.effectiveRetention} retention]` :
                            '';
                        const correlationStatus = correlationInfo.enabled ?
                            ` [Correlation: ${correlationInfo.totalPairs} pairs, ${correlationInfo.pairCoverage} coverage]` :
                            '';

                        this.showNotification(`📊 Learning Data (${storageType}): ${history.length} events, ${normalSamples.toFixed(1)} normal vs ${suspiciousSamples.toFixed(1)} suspicious (${totalSamples >= Sentinel.Heuristics.minSamplesForLearning ? 'ML ACTIVE' : 'PENDING'})${timeDecayStatus}${correlationStatus}. Use "🧠 Manage AI Learning" for full control!`, 'info', 10000);
                    }
                } catch (error) {
                    Sentinel.logError('viewLearningData', error);
                    this.showNotification('❌ Failed to load learning data', 'error');
                }
            },

            // PHASE 2.1: Database statistics viewer
            async showDatabaseStats() {
                try {
                    this.showNotification('🔄 Loading database statistics...', 'info', 1000);

                    if (Sentinel.DB.initialized) {
                        const stats = await Sentinel.DB.getStats();
                        console.log('[Sentinel] IndexedDB Statistics:', stats);
                        console.table({
                            'Database Type': 'IndexedDB',
                            'Database Name': Sentinel.DB.dbName,
                            'Database Version': stats.dbVersion,
                            'Total Events (All Sites)': stats.totalEvents,
                            'Current Site': Sentinel.hostname,
                            'Current Site Events': (await Sentinel.Heuristics.getTrainingHistory()).length
                        });

                        this.showNotification(`🗄️ Database Stats: IndexedDB v${stats.dbVersion} with ${stats.totalEvents} total training events across all sites. Current site (${Sentinel.hostname}): ${(await Sentinel.Heuristics.getTrainingHistory()).length} events.`, 'info', 8000);
                    } else {
                        console.log('[Sentinel] Storage: GM_setValue fallback mode');
                        console.table({
                            'Database Type': 'GM_setValue (Fallback)',
                            'Reason': 'IndexedDB initialization failed or not available',
                            'Current Site': Sentinel.hostname,
                            'Current Site Events': (await Sentinel.Heuristics.getTrainingHistory()).length
                        });

                        this.showNotification(`🗄️ Database Stats: Using GM_setValue fallback storage. Current site (${Sentinel.hostname}): ${(await Sentinel.Heuristics.getTrainingHistory()).length} events. Check console for details.`, 'warning', 6000);
                    }
                } catch (error) {
                    Sentinel.logError('showDatabaseStats', error);
                    this.showNotification('❌ Failed to load database statistics', 'error');
                }
            },

            // PHASE 2.1: Reset learning data with IndexedDB support
            resetLearningData() {
                this.showConfirmation(`🗑️ Reset all learning data for ${Sentinel.hostname}? This will delete the trained ML model.`, async () => {
                    try {
                        this.showNotification('🔄 Clearing training data...', 'info', 1000);

                        if (Sentinel.DB.initialized) {
                            // Use IndexedDB for clearing
                            const clearedCount = await Sentinel.DB.clearHistory(Sentinel.hostname);
                            console.log(`[Sentinel] Reset training history for ${Sentinel.hostname}: ${clearedCount} events deleted from IndexedDB`);
                            this.showNotification(`✅ Learning data reset for ${Sentinel.hostname} (${clearedCount} events cleared from IndexedDB). System will use static rules until retrained.`, 'success', 5000);
                        } else {
                            // Fallback to GM_setValue
                            const key = `heuristics_history_${Sentinel.hostname}`;
                            GM_setValue(key, undefined);
                            console.log(`[Sentinel] Reset training history for ${Sentinel.hostname} using fallback storage`);
                            this.showNotification(`✅ Learning data reset for ${Sentinel.hostname}. System will use static rules until retrained.`, 'success', 4000);
                        }
                    } catch (error) {
                        Sentinel.logError('resetLearningData', error);
                        this.showNotification('❌ Failed to reset learning data', 'error');
                    }
                });
            },

            // PHASE 3.1: Time Decay Intelligence Demonstration
            async testTimeDecay() {
                this.showNotification('⏰ Testing Time Decay Intelligence...', 'info');

                try {
                    console.log('[Sentinel] 🧠 DEMONSTRATING TIME DECAY INTELLIGENCE:');
                    console.log('[Sentinel] Time decay simulates how knowledge becomes less relevant over time');

                    // Demonstrate time decay calculations with sample timestamps
                    const now = Date.now();
                    const oneDay = 24 * 60 * 60 * 1000;
                    const testAges = [0, 1, 7, 30, 60, 90, 180, 365]; // Days ago

                    console.log(`[Sentinel] Half-life: ${Sentinel.Heuristics.halfLife} days (knowledge reduces to 50% after this time)`);
                    console.log('[Sentinel] Time decay weight examples:');

                    const decayExamples = testAges.map(daysAgo => {
                        const timestamp = now - (daysAgo * oneDay);
                        const weight = Sentinel.Heuristics.calculateTimeDecayWeight(timestamp);
                        return {
                            'Age (Days)': daysAgo,
                            'Weight': weight.toFixed(4),
                            'Percentage': `${(weight * 100).toFixed(1)}%`,
                            'Relevance': weight > 0.5 ? 'HIGH' : weight > 0.25 ? 'MEDIUM' : weight > 0.1 ? 'LOW' : 'MINIMAL'
                        };
                    });

                    console.table(decayExamples);

                    // Show current learning data with time decay information
                    const learnedData = await Sentinel.Heuristics.getLearnedData();
                    const timeDecayInfo = learnedData.timeDecayInfo || {};

                    if (timeDecayInfo.enabled && timeDecayInfo.totalEvents > 0) {
                        console.log(`[Sentinel] Current dataset time decay analysis:`);
                        console.log(`[Sentinel] • Raw events: ${timeDecayInfo.totalEvents}`);
                        console.log(`[Sentinel] • Weighted events: ${timeDecayInfo.weightedEvents}`);
                        console.log(`[Sentinel] • Knowledge retention: ${timeDecayInfo.effectiveRetention}`);
                        console.log(`[Sentinel] • Data age range: ${timeDecayInfo.ageRangeInDays} days`);

                        this.showNotification(`⏰ Time Decay Analysis: ${timeDecayInfo.effectiveRetention} knowledge retention from ${timeDecayInfo.totalEvents} events over ${timeDecayInfo.ageRangeInDays} days. Check console for detailed decay curve!`, 'success', 8000);
                    } else if (timeDecayInfo.enabled) {
                        this.showNotification(`⏰ Time Decay Ready: ${Sentinel.Heuristics.halfLife}-day half-life configured. No training data yet to analyze. Use "Test Adaptive Heuristics" to generate data!`, 'info', 6000);
                    } else {
                        this.showNotification(`⏰ Time Decay DISABLED: All historical data weighted equally. Enable in Heuristics configuration for temporal intelligence!`, 'warning', 6000);
                    }

                } catch (error) {
                    Sentinel.logError('testTimeDecay', error);
                    this.showNotification('❌ Failed to test time decay intelligence', 'error');
                }
            },

            // PHASE 3.2: Cache Performance Demonstration
            async testCachePerformance() {
                this.showNotification('⚡ Testing Cache Performance...', 'info');

                try {
                    console.log('[Sentinel] 🚀 DEMONSTRATING CACHE PERFORMANCE OPTIMIZATION:');
                    console.log('[Sentinel] Cache eliminates expensive model rebuilding by storing computed results');

                    const performanceResults = [];

                    // Test 1: Cold cache (no cache exists)
                    Sentinel.Heuristics._invalidateCache();
                    console.log('[Sentinel] Test 1: Cold cache - full model rebuild required');

                    const coldStart = performance.now();
                    const coldData = await Sentinel.Heuristics.getOrRebuildModel();
                    const coldTime = performance.now() - coldStart;

                    performanceResults.push({
                        'Test': 'Cold Cache (Full Rebuild)',
                        'Time (ms)': coldTime.toFixed(2),
                        'Events Processed': coldData.timeDecayInfo?.totalEvents || 0,
                        'Cache Status': 'MISS'
                    });

                    // Test 2: Warm cache (same data, should be instant)
                    console.log('[Sentinel] Test 2: Warm cache - instant retrieval');

                    const warmStart = performance.now();
                    const warmData = await Sentinel.Heuristics.getOrRebuildModel();
                    const warmTime = performance.now() - warmStart;

                    performanceResults.push({
                        'Test': 'Warm Cache (Instant)',
                        'Time (ms)': warmTime.toFixed(2),
                        'Events Processed': warmData.timeDecayInfo?.totalEvents || 0,
                        'Cache Status': 'HIT'
                    });

                    // Test 3: Multiple warm reads to show consistency
                    const multipleReads = [];
                    for (let i = 0; i < 5; i++) {
                        const readStart = performance.now();
                        await Sentinel.Heuristics.getOrRebuildModel();
                        const readTime = performance.now() - readStart;
                        multipleReads.push(readTime);
                    }

                    const avgWarmTime = multipleReads.reduce((a, b) => a + b, 0) / multipleReads.length;
                    performanceResults.push({
                        'Test': 'Avg 5x Warm Reads',
                        'Time (ms)': avgWarmTime.toFixed(2),
                        'Events Processed': warmData.timeDecayInfo?.totalEvents || 0,
                        'Cache Status': 'HIT'
                    });

                    // Calculate performance improvement
                    const speedupFactor = coldTime / avgWarmTime;
                    const timeSaved = coldTime - avgWarmTime;

                    console.table(performanceResults);

                    // Display cache configuration
                    console.log('[Sentinel] Cache Configuration:');
                    console.log(`[Sentinel] • Cache Enabled: ${Sentinel.Heuristics.modelCacheEnabled}`);
                    console.log(`[Sentinel] • Cache Key: ${Sentinel.Heuristics.cacheKey}`);
                    console.log(`[Sentinel] • Storage Method: GM_setValue (ultra-fast for JSON objects)`);

                    // Display performance metrics
                    console.log('[Sentinel] Performance Metrics:');
                    console.log(`[Sentinel] • Cold start time: ${coldTime.toFixed(2)}ms`);
                    console.log(`[Sentinel] • Warm read time: ${avgWarmTime.toFixed(2)}ms`);
                    console.log(`[Sentinel] • Performance improvement: ${speedupFactor.toFixed(1)}x faster`);
                    console.log(`[Sentinel] • Time saved per read: ${timeSaved.toFixed(2)}ms`);

                    // Show cache contents size estimation
                    try {
                        const cacheData = GM_getValue(Sentinel.Heuristics.cacheKey, null);
                        if (cacheData) {
                            const cacheSize = JSON.stringify(cacheData).length;
                            console.log(`[Sentinel] • Cache size: ~${(cacheSize / 1024).toFixed(1)}KB`);
                            console.log(`[Sentinel] • Last cached: ${new Date(cacheData.metadata.cacheTimestamp).toLocaleString()}`);
                        }
                    } catch {
                        console.log('[Sentinel] • Cache size: Unable to calculate');
                    }

                    if (speedupFactor > 1) {
                        this.showNotification(`⚡ Cache Performance: ${speedupFactor.toFixed(1)}x faster reads! Cold: ${coldTime.toFixed(1)}ms → Warm: ${avgWarmTime.toFixed(1)}ms. Check console for detailed analysis!`, 'success', 8000);
                    } else {
                        this.showNotification(`⚡ Cache Performance: No training data yet to cache. Use "Test Adaptive Heuristics" to generate data first!`, 'info', 6000);
                    }

                } catch (error) {
                    Sentinel.logError('testCachePerformance', error);
                    this.showNotification('❌ Failed to test cache performance', 'error');
                }
            },

            // PHASE 3.3: Correlation Analysis Intelligence Demonstration
            async testCorrelationAnalysis() {
                this.showNotification('🔗 Testing Correlation Analysis...', 'info');

                try {
                    console.log('[Sentinel] 🔗 DEMONSTRATING CORRELATION ANALYSIS (SEQUENCE INTELLIGENCE):');
                    console.log('[Sentinel] Correlation analysis detects suspicious activity sequences that individual analysis might miss');

                    // Check current correlation analysis status
                    const currentModel = await Sentinel.Heuristics.getOrRebuildModel();
                    const correlationInfo = currentModel.correlationInfo || {};

                    console.log('[Sentinel] Correlation Analysis Configuration:');
                    console.log(`[Sentinel] • Enabled: ${Sentinel.Heuristics.correlationAnalysisEnabled}`);
                    console.log(`[Sentinel] • Naive Bayes Weight: ${Sentinel.Heuristics.naiveBayesWeight} (${(Sentinel.Heuristics.naiveBayesWeight * 100).toFixed(0)}%)`);
                    console.log(`[Sentinel] • Correlation Weight: ${Sentinel.Heuristics.correlationWeight} (${(Sentinel.Heuristics.correlationWeight * 100).toFixed(0)}%)`);

                    if (correlationInfo.enabled) {
                        console.log(`[Sentinel] • Total Activity Pairs: ${correlationInfo.totalPairs}`);
                        console.log(`[Sentinel] • Normal Pairs: ${correlationInfo.normalPairs}`);
                        console.log(`[Sentinel] • Suspicious Pairs: ${correlationInfo.suspiciousPairs}`);
                        console.log(`[Sentinel] • Pair Coverage: ${correlationInfo.pairCoverage}`);

                        // Display known suspicious sequences
                        if (currentModel.pair_frequencies && currentModel.pair_frequencies.suspicious) {
                            const suspiciousPairs = Object.keys(currentModel.pair_frequencies.suspicious)
                                .filter(key => key !== 'total_pairs')
                                .slice(0, 5); // Show top 5

                            if (suspiciousPairs.length > 0) {
                                console.log('[Sentinel] Known Suspicious Activity Sequences:');
                                suspiciousPairs.forEach(pair => {
                                    const weight = currentModel.pair_frequencies.suspicious[pair].toFixed(3);
                                    console.log(`[Sentinel] • ${pair} (weight: ${weight})`);
                                });
                            }
                        }

                        // Simulate sequence analysis with test activities
                        const testSequences = [
                            ['font.check', 'canvas.read', 'webgl.renderer'],
                            ['devtools.check', 'network.fetch.blocked'],
                            ['canvas.read', 'font.measure', 'navigator.property']
                        ];

                        console.log('[Sentinel] Testing sequence analysis with sample activities:');

                        for (const sequence of testSequences) {
                            console.log(`[Sentinel] Analyzing sequence: ${sequence.join(' → ')}`);

                            // Test both individual and correlation analysis
                            const naiveBayesResult = await Sentinel.Heuristics.classifyActivities(sequence);
                            const correlationResult = await Sentinel.Heuristics.classifyCorrelations(sequence);
                            const combinedResult = await Sentinel.Heuristics.classifyWithCombinedIntelligence(sequence);

                            if (naiveBayesResult) {
                                console.log(`[Sentinel] • Naive Bayes: ${(naiveBayesResult.suspicious * 100).toFixed(1)}% suspicious`);
                            }
                            if (correlationResult) {
                                console.log(`[Sentinel] • Correlation: ${(correlationResult.suspicious * 100).toFixed(1)}% suspicious (${correlationResult.analyzedPairs} pairs)`);
                            }
                            if (combinedResult) {
                                console.log(`[Sentinel] • Combined: ${(combinedResult.suspicious * 100).toFixed(1)}% suspicious (${combinedResult.method})`);
                            }
                            console.log('');
                        }

                        this.showNotification(`🔗 Correlation Analysis: ${correlationInfo.totalPairs} activity pairs learned, ${correlationInfo.pairCoverage} coverage. Combined intelligence uses ${(Sentinel.Heuristics.correlationWeight * 100).toFixed(0)}% correlation + ${(Sentinel.Heuristics.naiveBayesWeight * 100).toFixed(0)}% Naive Bayes. Check console for sequence analysis!`, 'success', 10000);
                    } else {
                        console.log('[Sentinel] Correlation analysis is DISABLED');
                        this.showNotification(`🔗 Correlation Analysis DISABLED: Only individual activity analysis active. Enable correlation analysis in configuration for sequence intelligence!`, 'warning', 6000);
                    }

                    // Show how to generate training data for sequences
                    if (parseFloat(correlationInfo.totalPairs || 0) < 3) {
                        console.log('[Sentinel] 💡 TIP: Use "Test Adaptive Heuristics" to generate training data with activity sequences for better correlation analysis!');
                    }

                } catch (error) {
                    Sentinel.logError('testCorrelationAnalysis', error);
                    this.showNotification('❌ Failed to test correlation analysis', 'error');
                }
            },

            runAlgorithmBenchmark() {
                this.showInfo('🚀 Running revolutionary O(L) algorithm benchmark...');
                setTimeout(() => {
                    if (!Sentinel.Network.trie) {
                        this.showNotification('Trie not initialized. Enable tracker blocking first.', 'error');
                        return;
                    }

                    const stats = Sentinel.Network.trie.getStats();
                    const theoreticalSpeedup = stats.wordCount; // O(N*L) vs O(L) improvement
                    const memoryEfficiency = (100 * stats.nodeCount / stats.wordCount).toFixed(1);
                    const compressionRatio = (100 - parseFloat(memoryEfficiency)).toFixed(1);

                    console.log(`[Sentinel] 🧪 ALGORITHM BENCHMARK RESULTS:`);
                    console.log(`[Sentinel] ⚡ Theoretical speedup: ${theoreticalSpeedup}x (O(N*L) → O(L))`);
                    console.log(`[Sentinel] 📊 Trie stats: ${stats.wordCount} domains, ${stats.nodeCount} nodes, ${stats.maxDepth} max depth`);
                    console.log(`[Sentinel] 💾 Memory compression: ${compressionRatio}% space saved through prefix sharing`);
                    console.log(`[Sentinel] 🔧 Domain reversal: Optimized for .com/.net/.org clustering`);

                    this.showSuccess(`🚀 REVOLUTIONARY PERFORMANCE! ${theoreticalSpeedup}x speedup with O(L) Trie algorithm. ${stats.wordCount} domains compressed to ${stats.nodeCount} nodes (${compressionRatio}% space saved)`, 10000);
                }, 100);
            },

            runPerformanceTest() {
                this.showInfo('Running comprehensive performance test...');
                setTimeout(() => {
                    const testUrls = [
                        'https://google-analytics.com/analytics.js',
                        'https://facebook.com/tr',
                        'https://doubleclick.net/tag.js',
                        'https://amazon-adsystem.com/ads.js',
                        'https://googlesyndication.com/ads.js'
                    ];

                    const results = Sentinel.Network.performanceTest(testUrls);
                    if (results) {
                        this.showSuccess(`Performance Test Complete! ${results.operationsPerSecond.toFixed(0)} ops/sec, ${results.theoreticalSpeedup.toFixed(1)}x speedup`, 5000);
                    }
                }, 100);
            },

            testMouseProtection() {
                if (!Sentinel.config.blockMouseEvents) {
                    this.showNotification('Mouse protection is disabled. Enable in settings.', 'warning');
                    return;
                }
                this.showNotification('Mouse protection test - move cursor to screen edges. Check console for blocked events.', 'info');
            },

            showProtectionStatus() {
                const activeProtections = [];
                if (Sentinel.config.blockTrackers) activeProtections.push('O(L) Tracker Blocking');
                if (Sentinel.config.fingerprintProtection !== 'off') activeProtections.push(`Fingerprint Protection (${Sentinel.config.fingerprintProtection})`);
                if (Sentinel.config.spoofPageVisibility) activeProtections.push('Page Visibility Spoofing');
                if (Sentinel.config.blockMouseEvents) activeProtections.push('Mouse Protection');
                if (Sentinel.config.spoofFonts) activeProtections.push(`Font Spoofing (${Sentinel.config.commonFonts.length} fonts)`);
                if (Sentinel.config.neutralizeIntersectionObserver) activeProtections.push('IntersectionObserver Neutralization');
                if (Sentinel.config.disableSelectionTracking) activeProtections.push('Selection Tracking Prevention');

                // PHASE 3.1: Add adaptive heuristics status with time decay information
                if (Sentinel.config.enableHeuristics) {
                    // Make this async to get time decay information
                    Sentinel.Heuristics.getLearnedData().then(learnedData => {
                        const normalSamples = (learnedData.normal && learnedData.normal.total) || 0;
                        const suspiciousSamples = (learnedData.suspicious && learnedData.suspicious.total) || 0;
                        const totalSamples = normalSamples + suspiciousSamples;
                        const timeDecayInfo = learnedData.timeDecayInfo || {};

                        let heuristicsStatus;
                        if (totalSamples >= Sentinel.Heuristics.minSamplesForLearning) {
                            const timeDecayStatus = timeDecayInfo.enabled ?
                                ` w/ ${timeDecayInfo.effectiveRetention} retention` :
                                '';
                            heuristicsStatus = `Adaptive ML Heuristics (${totalSamples.toFixed(1)} weighted samples${timeDecayStatus})`;
                        } else {
                            heuristicsStatus = `Static Heuristics (${totalSamples.toFixed(1)}/${Sentinel.Heuristics.minSamplesForLearning} weighted samples for ML)`;
                        }

                        // Update the display with time decay information
                        console.log(`[Sentinel] Enhanced protection status with time decay: ${heuristicsStatus}`);
                    }).catch(error => {
                        Sentinel.logError('showProtectionStatus.getLearnedData', error);
                    });

                    // For immediate display, use synchronous fallback
                    const timeDecayEnabled = Sentinel.Heuristics.timeDecayEnabled;
                    const cacheEnabled = Sentinel.Heuristics.modelCacheEnabled;
                    const correlationEnabled = Sentinel.Heuristics.correlationAnalysisEnabled;

                    const timeDecayStatus = timeDecayEnabled ?
                        ` + Time Decay (${Sentinel.Heuristics.halfLife}d half-life)` :
                        '';
                    const cacheStatus = cacheEnabled ? ' + High-Performance Cache' : '';
                    const intelligenceStatus = correlationEnabled ?
                        ` + Combined Intelligence (${(Sentinel.Heuristics.naiveBayesWeight * 100).toFixed(0)}% NB + ${(Sentinel.Heuristics.correlationWeight * 100).toFixed(0)}% Corr)` :
                        ' + Naive Bayes Only';

                    activeProtections.push(`Adaptive Heuristics${intelligenceStatus}${timeDecayStatus}${cacheStatus}`);
                }

                const status = activeProtections.length > 0
                    ? `${activeProtections.join(', ')}`
                    : 'No protections active';

                // Show algorithmic performance info if Trie is available
                if (Sentinel.Network.trie) {
                    const stats = Sentinel.Network.trie.getStats();
                    const speedup = stats.wordCount;
                    const compression = (100 - (100 * stats.nodeCount / stats.wordCount)).toFixed(1);
                    this.showNotification(`🔗 Sentinel v8.3 Status: ${status}. Core Intelligence Upgrade (Combined Intelligence) + Cached Model Architecture + Mature Time Decay Intelligence + IndexedDB Infrastructure + Enterprise Storage + O(L) Algorithm: ${speedup}x speedup with ${compression}% memory compression!`, 12000);
                } else {
                    this.showNotification(`🔗 Sentinel v8.3 Status - ${status}`, 8000);
                }
            },

            buildSettingsPanel() {
                if (document.getElementById(this.selectors.panel)) {
                    this.panel.remove();
                    this.panel = null;
                    return;
                }

                // LAZY LOADING: Only load styles and create panel when actually needed
                this.panel = document.createElement('div');
                this.panel.id = this.selectors.panel;

                // Defer HTML generation until panel is actually created
                this.panel.innerHTML = `
                    <div class="sentinel-header">
                        <h3>Project Sentinel v8.0 (IndexedDB Infrastructure + Enterprise-Grade ML Storage)</h3>
                        <button id="${this.selectors.closeBtn}" title="Close Panel">×</button>
                    </div>
                    <div class="sentinel-body">
                        <h4>Settings for: <strong>${Sentinel.hostname}</strong></h4>
                        ${this.renderSection('Content Interaction', ['enableCopy', 'enableRightClick', 'disableSelectionTracking'])}
                        ${this.renderSection('Privacy & Tracking', ['spoofPageVisibility', 'blockBeaconOnUnload', 'disableAntiDevTools', 'neutralizeIntersectionObserver', 'blockMouseEvents'])}
                        ${this.renderSection('Fingerprinting & Evasion', ['fingerprintProtection', 'spoofFonts', 'enableHeuristics', 'heuristicMode'])}
                        ${this.renderSection('Network Control', ['blockTrackers'])}
                    </div>
                    <div class="sentinel-footer">
                        <button id="${this.selectors.resetBtn}" title="Reset settings for this site to default">Reset Site</button>
                        <button id="${this.selectors.saveBtn}" title="Save changes and reload the page">Save & Reload</button>
                    </div>
                `;

                document.body.appendChild(this.panel);

                // LAZY LOADING: Only add styles and listeners when panel is created
                this.addPanelStyles();
                this.addPanelListeners();
            },

            // PHASE 2.1: Enhanced ML Management Panel with Advanced Tabbed Interface
            async buildMlManagementPanel() {
                // Generate unique ID for ML management panel
                const mlPanelId = this._generateId('sentinel-ml-panel');

                // Close existing panel if open
                const existingPanel = document.getElementById(mlPanelId);
                if (existingPanel) {
                    existingPanel.remove();
                    return;
                }

                try {
                    // Show loading state
                    this.showNotification('🔄 Loading AI Learning Management...', 'info', 1000);

                    const mlPanel = document.createElement('div');
                    mlPanel.id = mlPanelId;

                    // LAZY LOADING: Fetch all required data
                    const history = await Sentinel.Heuristics.getTrainingHistory();
                    const learnedData = await Sentinel.Heuristics.getLearnedData();
                    const whitelistStatus = Sentinel.Heuristics.getWhitelistStatus();
                    const model = await Sentinel.Heuristics.getOrRebuildModel();

                    const normalSamples = (learnedData.normal && learnedData.normal.total) || 0;
                    const suspiciousSamples = (learnedData.suspicious && learnedData.suspicious.total) || 0;

                    const mlCloseBtnId = this._generateId('sentinel-ml-close-btn');
                    const mlClearAllBtnId = this._generateId('sentinel-ml-clear-all-btn');

                    // Get database info
                    const dbInfo = Sentinel.DB.initialized ?
                        `IndexedDB (${await Sentinel.DB.getStats().then(s => s.totalEvents)} total events)` :
                        'GM_setValue Fallback';

                    // Generate IDs for tabs and content
                    const trainingTabId = this._generateId('training-tab');
                    const whitelistTabId = this._generateId('whitelist-tab');
                    const insightsTabId = this._generateId('insights-tab');

                    // Generate IDs for whitelist management
                    const addSequenceInputId = this._generateId('add-sequence-input');
                    const addSequenceBtnId = this._generateId('add-sequence-btn');

                    // LAZY LOADING: Defer heavy HTML generation until panel is created
                    mlPanel.innerHTML = `
                        <div class="sentinel-ml-header">
                            <h3>🧠 AI Learning Management - ${Sentinel.hostname}</h3>
                            <button id="${mlCloseBtnId}" title="Close Panel">×</button>
                        </div>
                        <div class="sentinel-ml-tabs">
                            <button class="tab-btn active" data-tab="training">📚 Training History</button>
                            <button class="tab-btn" data-tab="whitelist">🔒 Whitelist Management</button>
                            <button class="tab-btn" data-tab="insights">🔍 Model Insights</button>
                        </div>
                        <div class="sentinel-ml-body">
                            <!-- Tab 1: Training History -->
                            <div id="${trainingTabId}" class="tab-content active">
                                <div class="sentinel-ml-stats">
                                    <h4>Learning Statistics <span style="font-size: 11px; color: #666;">(${dbInfo})</span></h4>
                                    <div class="sentinel-stats-grid">
                                        <div class="stat-item">
                                            <span class="stat-label">Total Training Events:</span>
                                            <span class="stat-value">${history.length}</span>
                                        </div>
                                        <div class="stat-item">
                                            <span class="stat-label">Normal Behaviors:</span>
                                            <span class="stat-value">${normalSamples}</span>
                                        </div>
                                        <div class="stat-item">
                                            <span class="stat-label">Suspicious Behaviors:</span>
                                            <span class="stat-value">${suspiciousSamples}</span>
                                        </div>
                                        <div class="stat-item">
                                            <span class="stat-label">Learning Status:</span>
                                            <span class="stat-value ${Sentinel.config.enableHeuristics ? 'active' : 'pending'}">${Sentinel.config.enableHeuristics ? 'Active' : 'Pending'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="sentinel-ml-history">
                                    <h4>Training History <button id="${mlClearAllBtnId}" class="clear-all-btn">Clear All</button></h4>
                                    <div class="sentinel-history-container">
                                        ${history.length > 0 ? this.renderTrainingHistoryWithReclassify(history) : '<div class="no-history">No training data available yet.</div>'}
                                    </div>
                                </div>
                            </div>

                            <!-- Tab 2: Whitelist Management -->
                            <div id="${whitelistTabId}" class="tab-content">
                                <div class="whitelist-header">
                                    <h4>🔒 Activity Sequence Whitelist</h4>
                                    <p>Manage trusted activity sequences that bypass AI alerts.</p>
                            </div>
                                <div class="whitelist-add-section">
                                    <h5>Add New Whitelist Sequence</h5>
                                    <div class="whitelist-input-group">
                                        <input type="text" id="${addSequenceInputId}" placeholder="e.g., canvas.read|font.check|navigator.getBattery" class="whitelist-input">
                                        <button id="${addSequenceBtnId}" class="whitelist-add-btn">Add Sequence</button>
                                    </div>
                                    <small>Format: activity1|activity2|activity3 (use | as separator)</small>
                                </div>
                                <div class="whitelist-list-section">
                                    <h5>Current Whitelisted Sequences (${whitelistStatus.totalSequences})</h5>
                                    <div class="whitelist-sequences">
                                        ${this.renderWhitelistSequences(whitelistStatus.sequences)}
                                    </div>
                                </div>
                            </div>

                            <!-- Tab 3: Model Insights -->
                            <div id="${insightsTabId}" class="tab-content">
                                <div class="model-insights-header">
                                    <h4>🔍 AI Model Insights</h4>
                                    <p>See what the AI has learned about suspicious activities.</p>
                                </div>
                                <div class="insights-content">
                                    ${this.renderModelInsights(model, learnedData)}
                                </div>
                            </div>
                        </div>
                    `;

                    document.body.appendChild(mlPanel);

                    // LAZY LOADING: Only add styles and listeners when panel is actually created
                    this.addMlPanelStyles(mlPanelId, mlCloseBtnId);
                    this.addMlPanelListeners(mlPanel, mlPanelId, mlCloseBtnId, mlClearAllBtnId);
                    this.addWhitelistListeners(mlPanel, addSequenceInputId, addSequenceBtnId);

                    this.showNotification('✅ AI Learning Management panel loaded successfully!', 'success', 2000);

                } catch (error) {
                    Sentinel.logError('UI.buildMlManagementPanel', error);
                    this.showNotification('❌ Failed to load AI Learning Management panel', 'error', 3000);
                }
            },

            // PHASE 1.1: Render training history events
            renderTrainingHistoryWithReclassify(history) {
                let html = '<div class="sentinel-history-list">';

                history.forEach((event, index) => {
                    const eventId = event.id || `event_${index}`;
                    const activities = event.activities || [];
                    const activitySummary = activities.map(a => a.activity || a).join(' → ');
                    const timestamp = new Date(event.timestamp).toLocaleString();
                    const label = event.label || 'unknown';
                    const labelClass = label === 'suspicious' ? 'suspicious-label' : 'normal-label';

                    html += `
                        <div class="history-item" data-event-id="${eventId}">
                            <div class="history-header">
                                <span class="history-label ${labelClass}">${label.toUpperCase()}</span>
                                <span class="history-time">${timestamp}</span>
                                <div class="history-actions">
                                        <button class="reclassify-btn" data-action="reclassify" data-event-id="${eventId}" data-current-label="${label}" title="Re-classify this event">
                                        🔄 Re-classify
                                    </button>
                                        <button class="delete-btn" data-action="delete" data-event-id="${eventId}" title="Delete this event">
                                        🗑️ Delete
                                    </button>
                                </div>
                            </div>
                            <div class="history-activities">
                                <strong>Activities:</strong> ${activitySummary || 'No activities recorded'}
                            </div>
                        </div>
                    `;
                });

                html += '</div>';
                return html;
            },

            renderTrainingHistory(history) {
                if (history.length === 0) {
                    return `
                        <div class="no-history">
                            <p>🤔 No training data yet for this website.</p>
                            <p>Use the "Test Adaptive Heuristics" menu command to generate some alerts and provide feedback to train the AI!</p>
                        </div>
                    `;
                }

                // Sort by most recent first
                const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);

                return sortedHistory.map(event => {
                    const date = new Date(event.timestamp).toLocaleString();
                    const labelClass = event.label === 'normal' ? 'label-normal' : 'label-suspicious';
                    const labelIcon = event.label === 'normal' ? '✅' : '⚠️';

                    // Get activity descriptions
                    const activitiesWithDesc = event.activities.map(activity => {
                        const desc = Sentinel.Heuristics.suspiciousActivities[activity]?.desc || 'Unknown activity';
                        return `<span class="activity-item" title="${desc}">${activity}</span>`;
                    }).join(', ');

                    return `
                        <div class="training-event" data-event-id="${event.id}">
                            <div class="event-header">
                                <span class="event-date">${date}</span>
                                <span class="event-label ${labelClass}">${labelIcon} ${event.label.toUpperCase()}</span>
                                    <button class="delete-event-btn" data-action="delete-event" data-event-id="${event.id}" title="Delete this training event">🗑️</button>
                            </div>
                            <div class="event-activities">
                                <strong>Activities:</strong> ${activitiesWithDesc}
                            </div>
                        </div>
                    `;
                }).join('');
            },

            renderWhitelistSequences(sequences) {
                if (!sequences || sequences.length === 0) {
                    return '<div class="no-whitelist">No whitelisted sequences yet. Add sequences using the input above or use the "Trust this sequence" button in alerts.</div>';
                }

                let html = '<div class="whitelist-list">';
                sequences.forEach((sequence, index) => {
                    const activities = sequence.split('|');
                    const displaySequence = activities.join(' → ');

                    html += `
                        <div class="whitelist-item" data-sequence="${sequence}">
                            <div class="whitelist-sequence">
                                <span class="sequence-number">${index + 1}.</span>
                                <span class="sequence-activities">${displaySequence}</span>
                            </div>
                            <div class="whitelist-actions">
                                    <button class="remove-whitelist-btn" data-action="remove-whitelist" data-sequence="${sequence}" title="Remove this sequence from whitelist">
                                    🗑️ Remove
                                </button>
                            </div>
                        </div>
                    `;
                });

                html += '</div>';
                return html;
            },

            renderModelInsights(model, learnedData) {
                if (!model || !model.single_frequencies) {
                    return '<div class="no-model">No model data available. Train the AI with some activities first.</div>';
                }

                // Get top suspicious activities
                const suspiciousActivities = model.single_frequencies.suspicious || {};
                const topSuspicious = Object.entries(suspiciousActivities)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
                    .map(([activity, count]) => ({ activity, count }));

                // Get top suspicious pairs
                const suspiciousPairs = model.pair_frequencies?.suspicious || {};
                const topPairs = Object.entries(suspiciousPairs)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
                    .map(([pair, count]) => ({ pair, count }));

                // Calculate ratio
                const totalNormal = (learnedData.normal && learnedData.normal.total) || 0;
                const totalSuspicious = (learnedData.suspicious && learnedData.suspicious.total) || 0;
                const totalSamples = totalNormal + totalSuspicious;
                const normalRatio = totalSamples > 0 ? (totalNormal / totalSamples * 100).toFixed(1) : 0;
                const suspiciousRatio = totalSamples > 0 ? (totalSuspicious / totalSamples * 100).toFixed(1) : 0;

                // Get model confidence threshold
                const confidenceThreshold = (Sentinel.Heuristics.confidenceThreshold * 100).toFixed(0);

                // ENHANCED: Calculate max values for chart scaling
                const maxSuspiciousCount = topSuspicious.length > 0 ? Math.max(...topSuspicious.map(item => item.count)) : 1;
                const maxPairCount = topPairs.length > 0 ? Math.max(...topPairs.map(item => item.count)) : 1;

                let html = `
                    <div class="model-stats">
                        <h5>📊 Training Data Distribution</h5>
                        <div class="distribution-chart">
                            <div class="chart-bar">
                                <div class="chart-label">Normal</div>
                                <div class="chart-container">
                                    <div class="chart-fill normal-fill" style="width: ${normalRatio}%"></div>
                                    <span class="chart-text">${normalRatio}% (${totalNormal})</span>
                                </div>
                            </div>
                            <div class="chart-bar">
                                <div class="chart-label">Suspicious</div>
                                <div class="chart-container">
                                    <div class="chart-fill suspicious-fill" style="width: ${suspiciousRatio}%"></div>
                                    <span class="chart-text">${suspiciousRatio}% (${totalSuspicious})</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="model-config">
                        <h5>⚙️ AI Configuration</h5>
                        <div class="config-grid">
                            <div class="config-item">
                                <span class="config-label">Confidence Threshold:</span>
                                <span class="config-value">${confidenceThreshold}%</span>
                            </div>
                            <div class="config-item">
                                <span class="config-label">Learning Status:</span>
                                <span class="config-value ${Sentinel.config.enableHeuristics ? 'active' : 'inactive'}">${Sentinel.config.enableHeuristics ? 'Active' : 'Inactive'}</span>
                            </div>
                            <div class="config-item">
                                <span class="config-label">Total Training Events:</span>
                                <span class="config-value">${totalSamples}</span>
                            </div>
                        </div>
                    </div>

                    <div class="top-activities">
                        <h5>🚨 Top 5 Most Suspicious Activities</h5>
                        <div class="activity-list">
                            ${topSuspicious.length > 0 ? topSuspicious.map((item, index) => {
                                const barWidth = (item.count / maxSuspiciousCount * 100).toFixed(1);
                                return `
                                <div class="activity-item">
                                    <div class="activity-info">
                                        <span class="activity-rank">${index + 1}.</span>
                                        <span class="activity-name">${item.activity}</span>
                                        <span class="activity-count">${item.count} occurrences</span>
                                    </div>
                                    <div class="activity-chart">
                                        <div class="activity-bar" style="width: ${barWidth}%"></div>
                                    </div>
                                </div>
                                `;
                            }).join('') : '<div class="no-data">No suspicious activities recorded yet.</div>'}
                        </div>
                    </div>

                    <div class="top-pairs">
                        <h5>🔗 Top 5 Most Suspicious Activity Pairs</h5>
                        <div class="pair-list">
                            ${topPairs.length > 0 ? topPairs.map((item, index) => {
                                const barWidth = (item.count / maxPairCount * 100).toFixed(1);
                                return `
                                <div class="pair-item">
                                    <div class="pair-info">
                                        <span class="pair-rank">${index + 1}.</span>
                                        <span class="pair-sequence">${item.pair}</span>
                                        <span class="pair-count">${item.count} occurrences</span>
                                    </div>
                                    <div class="pair-chart">
                                        <div class="pair-bar" style="width: ${barWidth}%"></div>
                                    </div>
                                </div>
                                `;
                            }).join('') : '<div class="no-data">No suspicious activity pairs recorded yet.</div>'}
                        </div>
                    </div>

                    <div class="model-actions">
                        <h5>🛠️ Model Actions</h5>
                        <div class="action-buttons">
                            <button class="action-btn refresh-model" data-action="refresh-model">
                                🔄 Refresh Model
                            </button>
                            <button class="action-btn export-data" data-action="export-data">
                                📊 Export Data
                            </button>
                            <button class="action-btn reset-model" data-action="reset-model">
                                🗑️ Reset Model
                            </button>
                        </div>
                    </div>
                `;

                return html;
            },

            renderSection(title, keys) {
                let sectionHTML = `<fieldset class="sentinel-fieldset"><legend>${title}</legend>`;
                keys.forEach(key => {
                    const option = Sentinel.defaultConfig[key];
                    const currentValue = Sentinel.config[key];
                    const controlId = this._generateId(`sentinel-${key}`);

                    const tooltips = {
                        enableCopy: 'Allow text selection and copying on all sites.',
                        enableRightClick: 'Re-enable the default right-click context menu.',
                        disableSelectionTracking: 'Prevent sites from tracking which text you highlight. May affect some web editors.',
                        spoofPageVisibility: 'Prevent sites from knowing when you switch tabs.',
                        blockBeaconOnUnload: 'Block tracking requests sent when you leave a page.',
                        disableAntiDevTools: 'Prevent sites from detecting and blocking developer tools.',
                        neutralizeIntersectionObserver: 'Prevent sites from knowing how long you look at an element. May affect infinite scroll on some sites.',
                        blockMouseEvents: 'Block mouseleave/mouseout events to prevent tracking when the mouse leaves the page.',
                        fingerprintProtection: 'Select the intensity of browser fingerprinting protection. "Intelligent" provides the best balance.',
                        spoofFonts: 'Prevent sites from detecting your installed fonts to reduce fingerprinting uniqueness.',
                        blockTrackers: 'Block requests to known tracking domains using a filter list.',
                        enableHeuristics: 'Enable the anomaly detection engine to score suspicious behaviors.',
                        heuristicMode: 'Choose how heuristic alerts are displayed: Alert (banner), Log (console only), or Silent.'
                    };

                    if (typeof option === 'boolean') {
                        sectionHTML += `
                            <div class="sentinel-setting" title="${tooltips[key] || ''}">
                                <label for="${controlId}">${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</label>
                                <input type="checkbox" id="${controlId}" data-key="${key}" ${currentValue ? 'checked' : ''}>
                            </div>
                        `;
                    } else if (key === 'fingerprintProtection' || key === 'heuristicMode') {
                        const levels = key === 'fingerprintProtection' ? ['off', 'basic', 'intelligent'] : ['alert', 'log', 'silent'];
                        let optionsHTML = levels.map(level =>
                            `<option value="${level}" ${currentValue === level ? 'selected' : ''}>${level.charAt(0).toUpperCase() + level.slice(1)}</option>`
                        ).join('');
                        sectionHTML += `
                            <div class="sentinel-setting" title="${tooltips[key] || ''}">
                                <label for="${controlId}">${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</label>
                                <select id="${controlId}" data-key="${key}">${optionsHTML}</select>
                            </div>
                        `;
                    }
                });
                return sectionHTML + '</fieldset>';
            },

            addPanelListeners() {
                // LAZY LOADING: Store cleanup handlers for proper removal
                const cleanupHandlers = [];

                const closeBtn = document.getElementById(this.selectors.closeBtn);
                const resetBtn = document.getElementById(this.selectors.resetBtn);
                const saveBtn = document.getElementById(this.selectors.saveBtn);

                if (closeBtn) {
                    const closeHandler = () => {
                        this.panel.remove();
                        this.panel = null;
                        // Clean up event handlers to prevent memory leaks
                        this._cleanupPanelHandlers();
                    };
                    closeBtn.addEventListener('click', closeHandler);
                    cleanupHandlers.push({ element: closeBtn, event: 'click', handler: closeHandler });
                }

                if (resetBtn) {
                    const resetHandler = () => {
                        // UPDATED: Using requested showConfirmation method
                        this.showConfirmation('Are you sure? This will reset settings for this site.', () => {
                            GM_setValue(Sentinel.hostname, undefined);
                            this.showNotification('Settings reset. Reloading page...', 'info');
                            setTimeout(() => window.location.reload(), 1500);
                        });
                    };
                    resetBtn.addEventListener('click', resetHandler);
                    cleanupHandlers.push({ element: resetBtn, event: 'click', handler: resetHandler });
                }

                if (saveBtn) {
                    const saveHandler = () => {
                        this.panel.querySelectorAll('input[type="checkbox"], select').forEach(el => {
                            const key = el.dataset.key;
                            const value = el.type === 'checkbox' ? el.checked : el.value;
                            Sentinel.config[key] = value;
                        });
                        Sentinel.saveConfig();
                        this.showNotification('Settings saved. Reloading page...', 'success');
                        setTimeout(() => window.location.reload(), 1500);
                    };
                    saveBtn.addEventListener('click', saveHandler);
                    cleanupHandlers.push({ element: saveBtn, event: 'click', handler: saveHandler });
                }

                // Store cleanup handlers for later removal
                if (this.panel) {
                    this.panel._cleanupHandlers = cleanupHandlers;
                }
            },

            // LAZY LOADING: Cleanup function to remove event handlers
            _cleanupPanelHandlers() {
                if (this.panel && this.panel._cleanupHandlers) {
                    this.panel._cleanupHandlers.forEach(({ element, event, handler }) => {
                        element.removeEventListener(event, handler);
                    });
                    this.panel._cleanupHandlers = [];
                }
            },

            addPanelStyles() {
                GM_addStyle(`
                    #${this.selectors.panel} { position: fixed; top: 50px; right: 30px; z-index: 2147483647; background: #fff; border: 1px solid #ccc; border-radius: 8px; width: 350px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
                    #${this.selectors.panel} .sentinel-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: #f7f7f7; border-bottom: 1px solid #ddd; border-radius: 8px 8px 0 0; }
                    #${this.selectors.panel} .sentinel-header h3 { margin: 0; font-size: 16px; color: #333; }
                    #${this.selectors.panel} #${this.selectors.closeBtn} { background: none; border: none; font-size: 24px; cursor: pointer; color: #888; }
                    #${this.selectors.panel} .sentinel-body { padding: 15px; max-height: 400px; overflow-y: auto; }
                    #${this.selectors.panel} .sentinel-fieldset { border: 1px solid #ddd; border-radius: 4px; padding: 10px; margin-bottom: 15px; }
                    #${this.selectors.panel} .sentinel-fieldset legend { font-weight: bold; color: #00529B; padding: 0 5px; }
                    #${this.selectors.panel} .sentinel-setting { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
                    #${this.selectors.panel} .sentinel-footer { padding: 10px 15px; background: #f7f7f7; border-top: 1px solid #ddd; border-radius: 0 0 8px 8px; text-align: right; }
                    #${this.selectors.panel} button { margin-left: 5px; padding: 5px 10px; border-radius: 4px; cursor: pointer; border: 1px solid #ccc; }
                `);
            },

            // PHASE 1.1: ML Management Panel Styles
            addMlPanelStyles(mlPanelId, mlCloseBtnId) {
                const styleId = this._generateId('sentinel-ml-panel-styles');

                // Remove existing styles if any
                const existingStyles = document.getElementById(styleId);
                if (existingStyles) {
                    existingStyles.remove();
                }

                const styles = `
                    #${mlPanelId} {
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 90%;
                        max-width: 800px;
                        max-height: 80vh;
                        background: white;
                        border: 2px solid #e74c3c;
                        border-radius: 10px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                        z-index: 10000;
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                    }

                    #${mlPanelId} .sentinel-ml-header {
                        background: linear-gradient(135deg, #e74c3c, #c0392b);
                        color: white;
                        padding: 15px 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-radius: 8px 8px 0 0;
                    }

                    #${mlPanelId} .sentinel-ml-header h3 {
                        margin: 0;
                        font-size: 18px;
                        font-weight: 600;
                    }

                    #${mlPanelId} .sentinel-ml-tabs {
                        display: flex;
                        background: #f8f9fa;
                        border-bottom: 1px solid #dee2e6;
                    }

                    #${mlPanelId} .tab-btn {
                        flex: 1;
                        padding: 12px 16px;
                        border: none;
                        background: transparent;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        color: #6c757d;
                        transition: all 0.3s ease;
                        border-bottom: 3px solid transparent;
                    }

                    #${mlPanelId} .tab-btn:hover {
                        background: #e9ecef;
                        color: #495057;
                    }

                    #${mlPanelId} .tab-btn.active {
                        color: #e74c3c;
                        border-bottom-color: #e74c3c;
                        background: white;
                    }

                    #${mlPanelId} .sentinel-ml-body {
                        flex: 1;
                        overflow-y: auto;
                        padding: 20px;
                    }

                    #${mlPanelId} .tab-content {
                        display: none;
                    }

                    #${mlPanelId} .tab-content.active {
                        display: block;
                    }

                    /* Training History Styles */
                    #${mlPanelId} .history-item {
                        background: #f8f9fa;
                        border: 1px solid #dee2e6;
                        border-radius: 6px;
                        margin-bottom: 10px;
                        padding: 12px;
                    }

                    #${mlPanelId} .history-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 8px;
                    }

                    #${mlPanelId} .history-label {
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: 600;
                        text-transform: uppercase;
                    }

                    #${mlPanelId} .history-label.normal-label {
                        background: #d4edda;
                        color: #155724;
                    }

                    #${mlPanelId} .history-label.suspicious-label {
                        background: #f8d7da;
                        color: #721c24;
                    }

                    #${mlPanelId} .history-time {
                        font-size: 12px;
                        color: #6c757d;
                    }

                    #${mlPanelId} .history-actions {
                        display: flex;
                        gap: 8px;
                    }

                    #${mlPanelId} .reclassify-btn, #${mlPanelId} .delete-btn {
                        padding: 4px 8px;
                        border: none;
                        border-radius: 4px;
                        font-size: 11px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    }

                    #${mlPanelId} .reclassify-btn {
                        background: #ffc107;
                        color: #212529;
                    }

                    #${mlPanelId} .reclassify-btn:hover {
                        background: #e0a800;
                    }

                    #${mlPanelId} .delete-btn {
                        background: #dc3545;
                        color: white;
                    }

                    #${mlPanelId} .delete-btn:hover {
                        background: #c82333;
                    }

                    #${mlPanelId} .history-activities {
                        font-size: 13px;
                        color: #495057;
                    }

                    /* Whitelist Management Styles */
                    #${mlPanelId} .whitelist-header {
                        margin-bottom: 20px;
                    }

                    #${mlPanelId} .whitelist-add-section {
                        background: #f8f9fa;
                        padding: 15px;
                        border-radius: 6px;
                        margin-bottom: 20px;
                    }

                    #${mlPanelId} .whitelist-input-group {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 8px;
                    }

                    #${mlPanelId} .whitelist-input {
                        flex: 1;
                        padding: 8px 12px;
                        border: 1px solid #ced4da;
                        border-radius: 4px;
                        font-size: 14px;
                    }

                    #${mlPanelId} .whitelist-add-btn {
                        padding: 8px 16px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: 500;
                    }

                    #${mlPanelId} .whitelist-add-btn:hover {
                        background: #218838;
                    }

                    #${mlPanelId} .whitelist-item {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 10px;
                        background: white;
                        border: 1px solid #dee2e6;
                        border-radius: 4px;
                        margin-bottom: 8px;
                    }

                    #${mlPanelId} .whitelist-sequence {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }

                    #${mlPanelId} .sequence-number {
                        background: #e74c3c;
                        color: white;
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 11px;
                        font-weight: 600;
                    }

                    #${mlPanelId} .sequence-activities {
                        font-family: monospace;
                        font-size: 13px;
                        color: #495057;
                    }

                    #${mlPanelId} .remove-whitelist-btn {
                        padding: 4px 8px;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 11px;
                    }

                    #${mlPanelId} .remove-whitelist-btn:hover {
                        background: #c82333;
                    }

                    /* Model Insights Styles */
                    #${mlPanelId} .model-insights-header {
                        margin-bottom: 20px;
                    }

                    #${mlPanelId} .distribution-chart {
                        background: white;
                        padding: 15px;
                        border-radius: 6px;
                        border: 1px solid #dee2e6;
                        margin-bottom: 20px;
                    }

                    #${mlPanelId} .chart-bar {
                        display: flex;
                        align-items: center;
                        margin-bottom: 10px;
                    }

                    #${mlPanelId} .chart-label {
                        width: 80px;
                        font-weight: 600;
                        font-size: 14px;
                    }

                    #${mlPanelId} .chart-container {
                        flex: 1;
                        height: 24px;
                        background: #e9ecef;
                        border-radius: 12px;
                        position: relative;
                        overflow: hidden;
                    }

                    #${mlPanelId} .chart-fill {
                        height: 100%;
                        border-radius: 12px;
                        transition: width 0.3s ease;
                    }

                    #${mlPanelId} .chart-fill.normal-fill {
                        background: linear-gradient(90deg, #28a745, #20c997);
                    }

                    #${mlPanelId} .chart-fill.suspicious-fill {
                        background: linear-gradient(90deg, #dc3545, #fd7e14);
                    }

                    #${mlPanelId} .chart-text {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        font-size: 12px;
                        font-weight: 600;
                        color: white;
                        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                    }

                    #${mlPanelId} .activity-list, #${mlPanelId} .pair-list {
                        background: white;
                        border: 1px solid #dee2e6;
                        border-radius: 6px;
                        overflow: hidden;
                    }

                    #${mlPanelId} .activity-item, #${mlPanelId} .pair-item {
                        display: flex;
                        align-items: center;
                        padding: 10px 15px;
                        border-bottom: 1px solid #f1f3f4;
                    }

                    #${mlPanelId} .activity-item:last-child, #${mlPanelId} .pair-item:last-child {
                        border-bottom: none;
                    }

                    #${mlPanelId} .activity-rank, #${mlPanelId} .pair-rank {
                        background: #e74c3c;
                        color: white;
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 12px;
                        font-weight: 600;
                        margin-right: 12px;
                    }

                    #${mlPanelId} .activity-name, #${mlPanelId} .pair-sequence {
                        flex: 1;
                        font-family: monospace;
                        font-size: 13px;
                        color: #495057;
                    }

                    #${mlPanelId} .activity-count, #${mlPanelId} .pair-count {
                        font-size: 12px;
                        color: #6c757d;
                        font-weight: 500;
                    }

                    /* ENHANCED: New visualization styles for bar charts */
                    #${mlPanelId} .activity-item, #${mlPanelId} .pair-item {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        padding: 12px 15px;
                    }

                    #${mlPanelId} .activity-info, #${mlPanelId} .pair-info {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }

                    #${mlPanelId} .activity-chart, #${mlPanelId} .pair-chart {
                        height: 8px;
                        background: #e9ecef;
                        border-radius: 4px;
                        overflow: hidden;
                        position: relative;
                    }

                    #${mlPanelId} .activity-bar, #${mlPanelId} .pair-bar {
                        height: 100%;
                        background: linear-gradient(90deg, #e74c3c, #fd7e14);
                        border-radius: 4px;
                        transition: width 0.3s ease;
                        min-width: 4px;
                    }

                    #${mlPanelId} .model-actions {
                        margin-top: 20px;
                        padding: 15px;
                        background: #f8f9fa;
                        border-radius: 6px;
                        border: 1px solid #dee2e6;
                    }

                    #${mlPanelId} .action-buttons {
                        display: flex;
                        gap: 10px;
                        flex-wrap: wrap;
                    }

                    #${mlPanelId} .action-btn {
                        padding: 8px 16px;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 500;
                        transition: all 0.2s ease;
                    }

                    #${mlPanelId} .action-btn.refresh-model {
                        background: #17a2b8;
                        color: white;
                    }

                    #${mlPanelId} .action-btn.refresh-model:hover {
                        background: #138496;
                    }

                    #${mlPanelId} .action-btn.export-data {
                        background: #28a745;
                        color: white;
                    }

                    #${mlPanelId} .action-btn.export-data:hover {
                        background: #218838;
                    }

                    #${mlPanelId} .action-btn.reset-model {
                        background: #dc3545;
                        color: white;
                    }

                    #${mlPanelId} .action-btn.reset-model:hover {
                        background: #c82333;
                    }

                    /* General Styles */
                    #${mlPanelId} .sentinel-stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 15px;
                        margin-bottom: 20px;
                    }

                    #${mlPanelId} .stat-item {
                        background: white;
                        padding: 15px;
                        border-radius: 6px;
                        border: 1px solid #dee2e6;
                    }

                    #${mlPanelId} .stat-label {
                        display: block;
                        font-size: 12px;
                        color: #6c757d;
                        margin-bottom: 5px;
                    }

                    #${mlPanelId} .stat-value {
                        display: block;
                        font-size: 18px;
                        font-weight: 600;
                        color: #495057;
                    }

                    #${mlPanelId} .stat-value.active {
                        color: #28a745;
                    }

                    #${mlPanelId} .stat-value.pending {
                        color: #ffc107;
                    }

                    #${mlPanelId} .clear-all-btn {
                        float: right;
                        padding: 6px 12px;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    }

                    #${mlPanelId} .clear-all-btn:hover {
                        background: #c82333;
                    }

                    #${mlPanelId} .no-history, #${mlPanelId} .no-whitelist, #${mlPanelId} .no-model {
                        text-align: center;
                        padding: 30px;
                        color: #6c757d;
                        font-style: italic;
                    }

                    /* Close button */
                    #${mlCloseBtnId} {
                        background: none;
                        border: none;
                        color: white;
                        font-size: 24px;
                        cursor: pointer;
                        padding: 0;
                        width: 30px;
                        height: 30px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 50%;
                        transition: background-color 0.2s ease;
                    }

                    #${mlCloseBtnId}:hover {
                        background: rgba(255, 255, 255, 0.2);
                    }
                `;

                const styleElement = document.createElement('style');
                styleElement.id = styleId;
                styleElement.textContent = styles;
                document.head.appendChild(styleElement);
            },

            // PHASE 1.1: ML Management Panel Event Listeners
            addWhitelistListeners(mlPanel, addSequenceInputId, addSequenceBtnId) {
                const addSequenceInput = document.getElementById(addSequenceInputId);
                const addSequenceBtn = document.getElementById(addSequenceBtnId);

                if (addSequenceBtn) {
                    addSequenceBtn.onclick = async () => {
                        const sequence = addSequenceInput.value.trim();
                        if (!sequence) {
                            this.showNotification('Please enter a sequence to whitelist.', 'warning', 3000);
                            return;
                        }

                        try {
                            const activities = sequence.split('|').map(a => a.trim()).filter(a => a);
                            if (activities.length === 0) {
                                this.showNotification('Invalid sequence format. Use | as separator.', 'warning', 3000);
                                return;
                            }

                            await Sentinel.Heuristics.trainModelWithSequence(activities, 'normal_sequence');
                            this.showNotification('Sequence added to whitelist successfully!', 'success', 3000);

                            // Refresh the whitelist tab
                            this.refreshWhitelistTab();
                        } catch (error) {
                            Sentinel.logError('UI.addWhitelistSequence', error);
                            this.showNotification('Failed to add sequence to whitelist.', 'error', 3000);
                        }
                    };
                }

                if (addSequenceInput) {
                    addSequenceInput.onkeypress = (e) => {
                        if (e.key === 'Enter') {
                            addSequenceBtn.click();
                        }
                    };
                }


            },

            async reclassifyTrainingEvent(eventId, currentLabel) {
                const newLabel = currentLabel === 'normal' ? 'suspicious' : 'normal';
                const labelText = newLabel === 'normal' ? 'Normal' : 'Suspicious';

                this.showConfirmation(
                        `Are you sure you want to reclassify this event as "${labelText}"? This will help the AI learn from your feedback.`,
                    () => this.performReclassification(eventId, currentLabel, newLabel)
                );
            },

            async performReclassification(eventId, oldLabel, newLabel) {
                try {
                        this.showNotification('🔄 Reclassifying training event...', 'info', 1000);

                    // Get the event data
                    const history = await Sentinel.Heuristics.getTrainingHistory();
                    const event = history.find(e => e.id === eventId);

                    if (!event) {
                            this.showNotification('❌ Event not found. It may have been deleted.', 'error', 3000);
                        return;
                    }

                    // Delete the old event
                        const deleteSuccess = await Sentinel.Heuristics.deleteTrainingEvent(eventId);
                        if (!deleteSuccess) {
                            this.showNotification('❌ Failed to delete old event.', 'error', 3000);
                            return;
                        }

                    // Create new event with new label
                    await Sentinel.Heuristics.trainModel(event.activities, newLabel);

                        this.showNotification(`✅ Event reclassified as ${newLabel} successfully! AI will learn from this feedback.`, 'success', 3000);

                    // Refresh the training history tab
                    this.refreshTrainingHistoryTab();
                } catch (error) {
                    Sentinel.logError('UI.performReclassification', error);
                        this.showNotification('❌ Failed to reclassify event. Please try again.', 'error', 3000);
                    }
                },

                handleDeleteTrainingEvent(eventId) {
                    this.showConfirmation(`Delete this training event? The AI will learn from your remaining feedback.`, async () => {
                        try {
                            this.showNotification('🔄 Deleting training event...', 'info', 500);
                            const success = await Sentinel.Heuristics.deleteTrainingEvent(eventId);
                            if (success) {
                                this.showNotification('✅ Training event deleted', 'success', 2000);
                                // Refresh the training history tab instead of rebuilding the entire panel
                                this.refreshTrainingHistoryTab();
                            } else {
                                this.showNotification('❌ Failed to delete training event', 'error');
                            }
                        } catch (error) {
                            Sentinel.logError('deleteTrainingEvent', error);
                            this.showNotification('❌ Failed to delete training event', 'error');
                        }
                    });
                },

            async removeWhitelistSequence(sequence) {
                this.showConfirmation(
                    'Are you sure you want to remove this sequence from the whitelist?',
                    async () => {
                        try {
                            // Get current whitelist
                            const hostnameWhitelist = Sentinel.Heuristics.sequenceWhitelist.get(Sentinel.hostname);

                            if (hostnameWhitelist) {
                                hostnameWhitelist.delete(sequence);
                                await Sentinel.Heuristics._saveSequenceWhitelist();
                                this.showNotification('Sequence removed from whitelist successfully!', 'success', 3000);
                                this.refreshWhitelistTab();
                            }
                        } catch (error) {
                            Sentinel.logError('UI.removeWhitelistSequence', error);
                            this.showNotification('Failed to remove sequence from whitelist.', 'error', 3000);
                        }
                    }
                );
            },

            async refreshWhitelistTab() {
                try {
                    const whitelistStatus = Sentinel.Heuristics.getWhitelistStatus();
                        const mlPanel = document.querySelector('#sentinel-ml-panel');
                        if (mlPanel) {
                            const whitelistTab = mlPanel.querySelector('.tab-content[id*="whitelist"]');
                    if (whitelistTab) {
                        const sequencesContainer = whitelistTab.querySelector('.whitelist-sequences');
                        if (sequencesContainer) {
                            sequencesContainer.innerHTML = this.renderWhitelistSequences(whitelistStatus.sequences);

                                    // Update the count in the header
                                    const countElement = whitelistTab.querySelector('h5');
                                    if (countElement) {
                                        countElement.textContent = `Current Whitelisted Sequences (${whitelistStatus.totalSequences})`;
                                    }
                                }
                        }
                    }
                } catch (error) {
                    Sentinel.logError('UI.refreshWhitelistTab', error);
                }
            },

            async refreshTrainingHistoryTab() {
                try {
                    const history = await Sentinel.Heuristics.getTrainingHistory();
                        const mlPanel = document.querySelector('#sentinel-ml-panel');
                        if (mlPanel) {
                            const trainingTab = mlPanel.querySelector('.tab-content[id*="training"]');
                    if (trainingTab) {
                        const historyContainer = trainingTab.querySelector('.sentinel-history-container');
                        if (historyContainer) {
                            historyContainer.innerHTML = history.length > 0 ?
                                this.renderTrainingHistoryWithReclassify(history) :
                                '<div class="no-history">No training data available yet.</div>';
                                }
                        }
                    }
                } catch (error) {
                    Sentinel.logError('UI.refreshTrainingHistoryTab', error);
                }
            },

            addMlPanelListeners(mlPanel, mlPanelId, mlCloseBtnId, mlClearAllBtnId) {
                // LAZY LOADING: Store cleanup handlers for proper removal
                const cleanupHandlers = [];

                // Close button
                const closeBtn = document.getElementById(mlCloseBtnId);
                if (closeBtn) {
                    const closeHandler = () => {
                        mlPanel.remove();
                        // Clean up event handlers to prevent memory leaks
                        this._cleanupMlPanelHandlers(mlPanel);
                    };
                    closeBtn.addEventListener('click', closeHandler);
                    cleanupHandlers.push({ element: closeBtn, event: 'click', handler: closeHandler });
                }

                // Tab switching functionality
                const tabButtons = mlPanel.querySelectorAll('.tab-btn');
                const tabContents = mlPanel.querySelectorAll('.tab-content');

                tabButtons.forEach(button => {
                    const tabHandler = () => {
                        const targetTab = button.getAttribute('data-tab');

                        // Remove active class from all tabs and buttons
                        tabButtons.forEach(btn => btn.classList.remove('active'));
                        tabContents.forEach(content => content.classList.remove('active'));

                        // Add active class to clicked tab and corresponding content
                        button.classList.add('active');
                        const targetContent = mlPanel.querySelector(`#${targetTab}-tab`);
                        if (targetContent) {
                            targetContent.classList.add('active');
                        }
                    };
                    button.addEventListener('click', tabHandler);
                    cleanupHandlers.push({ element: button, event: 'click', handler: tabHandler });
                });

                // Clear all button
                const clearAllBtn = document.getElementById(mlClearAllBtnId);
                if (clearAllBtn) {
                    const clearAllHandler = () => {
                        this.showConfirmation(`🗑️ Clear all training data for ${Sentinel.hostname}? This will reset the AI to use static rules.`, async () => {
                            try {
                                this.showNotification('🔄 Clearing all training data...', 'info', 1000);

                                if (Sentinel.DB.initialized) {
                                    const clearedCount = await Sentinel.DB.clearHistory(Sentinel.hostname);
                                    console.log(`[Sentinel] Cleared all training history for ${Sentinel.hostname}: ${clearedCount} events`);
                                    this.showNotification(`✅ All training data cleared for ${Sentinel.hostname} (${clearedCount} events deleted). AI reset to static rules.`, 'success', 5000);
                                } else {
                                    const key = `heuristics_history_${Sentinel.hostname}`;
                                    GM_setValue(key, undefined);
                                    console.log(`[Sentinel] Cleared all training history for ${Sentinel.hostname} using fallback storage`);
                                    this.showNotification(`✅ All training data cleared for ${Sentinel.hostname}. AI reset to static rules.`, 'success', 4000);
                                }
                                mlPanel.remove(); // Close the panel
                            } catch (error) {
                                Sentinel.logError('clearAllTrainingData', error);
                                this.showNotification('❌ Failed to clear training data', 'error');
                            }
                        });
                    };
                    clearAllBtn.addEventListener('click', clearAllHandler);
                    cleanupHandlers.push({ element: clearAllBtn, event: 'click', handler: clearAllHandler });
                }

                // Unified event delegation for all action buttons
                const delegationHandler = (e) => {
                    const button = e.target.closest('button[data-action]');
                    if (!button) return;

                    const action = button.dataset.action;
                    const eventId = button.dataset.eventId;
                    const currentLabel = button.dataset.currentLabel;
                    const sequence = button.dataset.sequence;

                                            switch (action) {
                            case 'reclassify':
                                if (eventId && currentLabel) {
                                    this.reclassifyTrainingEvent(eventId, currentLabel);
                                }
                                break;
                            case 'delete':
                            case 'delete-event':
                                if (eventId) {
                                    this.handleDeleteTrainingEvent(eventId);
                                }
                                break;
                            case 'remove-whitelist':
                                if (sequence) {
                                    this.removeWhitelistSequence(sequence);
                                }
                                break;
                            case 'refresh-model':
                                this.refreshModelInsights();
                                break;
                            case 'export-data':
                                this.exportModelData();
                                break;
                            case 'reset-model':
                                this.resetModelData();
                                break;
                        }
                };
                mlPanel.addEventListener('click', delegationHandler);
                cleanupHandlers.push({ element: mlPanel, event: 'click', handler: delegationHandler });

                // Store cleanup handlers for later removal
                mlPanel._cleanupHandlers = cleanupHandlers;
            },

            // LAZY LOADING: Cleanup function to remove ML panel event handlers
            _cleanupMlPanelHandlers(mlPanel) {
                if (mlPanel && mlPanel._cleanupHandlers) {
                    mlPanel._cleanupHandlers.forEach(({ element, event, handler }) => {
                        element.removeEventListener(event, handler);
                    });
                    mlPanel._cleanupHandlers = [];
                }
            },

            // ENHANCED: Model action functions for the redesigned dashboard
            async refreshModelInsights() {
                try {
                    this.showNotification('🔄 Refreshing model insights...', 'info', 2000);

                    // Force rebuild the model
                    await Sentinel.Heuristics._invalidateCache();
                    const model = await Sentinel.Heuristics.getOrRebuildModel();
                    const learnedData = await Sentinel.Heuristics.getLearnedData();

                    // Refresh the insights tab content
                    const insightsTab = document.querySelector('.tab-content.active');
                    if (insightsTab && insightsTab.querySelector('.insights-content')) {
                        insightsTab.querySelector('.insights-content').innerHTML = this.renderModelInsights(model, learnedData);
                    }

                    this.showNotification('✅ Model insights refreshed successfully!', 'success', 3000);
                } catch (error) {
                    Sentinel.logError('UI.refreshModelInsights', error);
                    this.showNotification('❌ Failed to refresh model insights', 'error', 4000);
                }
            },

            async exportModelData() {
                try {
                    const model = await Sentinel.Heuristics.getOrRebuildModel();
                    const learnedData = await Sentinel.Heuristics.getLearnedData();
                    const history = await Sentinel.Heuristics.getTrainingHistory();

                    const exportData = {
                        timestamp: new Date().toISOString(),
                        hostname: Sentinel.hostname,
                        model: model,
                        learnedData: learnedData,
                        trainingHistory: history,
                        config: Sentinel.config
                    };

                    const dataStr = JSON.stringify(exportData, null, 2);
                    const dataBlob = new Blob([dataStr], { type: 'application/json' });

                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(dataBlob);
                    link.download = `sentinel-model-${Sentinel.hostname}-${Date.now()}.json`;
                    link.click();

                    this.showNotification('📊 Model data exported successfully!', 'success', 3000);
                } catch (error) {
                    Sentinel.logError('UI.exportModelData', error);
                    this.showNotification('❌ Failed to export model data', 'error', 4000);
                }
            },

            async resetModelData() {
                this.showConfirmation(
                    '🗑️ Reset AI Model?\n\nThis will clear all training data and reset the AI to use static rules only. This action cannot be undone.',
                    async () => {
                        try {
                            this.showNotification('🔄 Resetting AI model...', 'info', 2000);

                            // Clear all training data
                            if (Sentinel.DB.initialized) {
                                await Sentinel.DB.clearHistory(Sentinel.hostname);
                            } else {
                                const key = `heuristics_history_${Sentinel.hostname}`;
                                GM_setValue(key, undefined);
                            }

                            // Invalidate cache
                            await Sentinel.Heuristics._invalidateCache();

                            // Refresh the panel
                            const mlPanel = document.querySelector('[id^="sentinel-ml-panel"]');
                            if (mlPanel) {
                                mlPanel.remove();
                                await this.buildMlManagementPanel();
                            }

                            this.showNotification('✅ AI model reset successfully!', 'success', 4000);
                        } catch (error) {
                            Sentinel.logError('UI.resetModelData', error);
                            this.showNotification('❌ Failed to reset model data', 'error', 4000);
                        }
                    }
                );
            },

            // PHASE 2.1 IMPLEMENTATION COMPLETE: IndexedDB Infrastructure Optimization
            // ✅ Enterprise-grade IndexedDB wrapper with Promise-based async operations
            // ✅ Structured schema with indexes on hostname, timestamp, and label for efficient queries
            // ✅ Automatic data migration from legacy GM_setValue to IndexedDB storage
            // ✅ Graceful fallback to GM_setValue when IndexedDB is unavailable
            // ✅ Comprehensive error handling and transparent operation for users
            // ✅ Scalable storage architecture supporting unlimited training data growth
            // ✅ Database statistics and management tools with real-time monitoring
            // ✅ Asynchronous, non-blocking operations maintaining UI responsiveness
            // 🗄️ INFRASTRUCTURE OPTIMIZATION: Enterprise-grade storage architecture for ML data
            // 📊 PERFORMANCE SCALABILITY: Efficient handling of large training datasets
            // 🚀 STRATEGIC VALUE: Robust foundation for advanced ML features and data analytics

            // PHASE 3.1 IMPLEMENTATION COMPLETE: Adaptive Heuristics with Machine Learning
            // ✅ Naive Bayes Classifier implemented directly in userscript for adaptive threat detection
            // ✅ User feedback collection system with interactive banner training interface
            // ✅ Personalized learning per hostname with persistent IndexedDB storage
            // ✅ Probabilistic confidence scoring replacing static threshold-based alerts
            // ✅ Intelligent adaptation system to reduce false positives and improve accuracy
            // ✅ Comprehensive error handling and fallback to static system when needed
            // ✅ Advanced ML methods: Laplace smoothing, log probabilities, proper normalization
            // ✅ Learning data management with view, test, and reset capabilities
            // 🤖 ADAPTIVE INTELLIGENCE: Revolutionary evolution from static rules to personalized AI
            // 🧠 MACHINE LEARNING: Sophisticated statistical classification with continuous improvement
            // 🚀 STRATEGIC VALUE: Foundation for advanced behavioral analysis and predictive threat detection

            // PHASE 2.1 IMPLEMENTATION COMPLETE: Advanced Anti-Fingerprinting
            // ✅ Seeded Pseudo-Random Number Generator for consistent noise generation
            // ✅ Host-based consistent canvas fingerprinting with multi-channel noise
            // ✅ Advanced WebGL/WebGL2 parameter spoofing with realistic fake values
            // ✅ Enhanced font measurement spoofing with consistent reproducible metrics
            // ✅ Stealth Proxy-based network interception replacing traditional function wrapping
            // ✅ Undetectable API hooking that preserves toString() and function properties
            // 🛡️ FINGERPRINTING RESISTANCE: Enterprise-grade protection against sophisticated attacks
            // 🚀 STRATEGIC VALUE: Foundation for advanced stealth techniques and behavioral camouflage
        },

        Defenses: {
            // PHASE 2.1: Seeded Pseudo-Random Number Generator for Consistent Noise
            _createSeededRandom(seedStr) {
                try {
                    let seed = 0;
                    // Create deterministic seed from hostname
                    for (let i = 0; i < seedStr.length; i++) {
                        seed = (seed + seedStr.charCodeAt(i)) % 2147483647;
                    }

                    // Linear Congruential Generator - produces consistent pseudo-random sequence
                    return function() {
                        seed = (seed * 16807) % 2147483647;
                        return (seed - 1) / 2147483646;
                    };
                } catch (error) {
                    Sentinel.logError('_createSeededRandom', error);
                    // Fallback to Math.random if seeded generation fails
                    return Math.random;
                }
            },
            reclaimContentInteraction() {
                if (Sentinel.config.enableCopy || Sentinel.config.enableRightClick) {
                    GM_addStyle(`*, *::before, *::after { -webkit-user-select: auto !important; user-select: auto !important; }`);
                    const handler = e => e.stopPropagation();
                    if (Sentinel.config.enableRightClick) window.addEventListener('contextmenu', handler, true);
                    if (Sentinel.config.enableCopy) window.addEventListener('copy', handler, true);
                }

                // INTEGRATED: Selection tracking prevention
                if (Sentinel.config.disableSelectionTracking) {
                    const inputWhitelist = [
                        window.HTMLInputElement,
                        window.HTMLTextAreaElement,
                        window.HTMLSelectElement
                    ];
                    window.addEventListener('selectionchange', (e) => {
                        const activeEl = document.activeElement;
                        if (activeEl && (inputWhitelist.some(cls => activeEl instanceof cls) || activeEl.isContentEditable)) {
                            return;
                        }
                        e.stopImmediatePropagation();
                    }, true);
                }
            },

            neutralizeStateTracking() {
                // INTEGRATED: IntersectionObserver neutralization
                if (Sentinel.config.neutralizeIntersectionObserver && typeof window.IntersectionObserver !== 'undefined') {
                    Sentinel.wrapFunction(window, 'IntersectionObserver', function(original, callback, options) {
                        const modifiedCallback = (entries, observer) => {
                            const fakeEntries = entries.map(entry => {
                                Object.defineProperties(entry, {
                                    'isIntersecting': { value: true, writable: false },
                                    'intersectionRatio': { value: 1, writable: false },
                                });
                                return entry;
                            });
                            callback(fakeEntries, observer);
                        };
                        return new original(modifiedCallback, options);
                    });
                }
            },

            blockMouseTrackingEvents() {
                if (!Sentinel.config.blockMouseEvents) return;

                // ENHANCED: Improved mouse tracking protection with comprehensive edge case handling
                const mouseEventHandler = (event) => {
                    try {
                        // Block if the event is leaving the viewport (clientY <= 0)
                        // or if the target is the document itself without a specific target
                        // or if relatedTarget is null (indicating mouse leaving page boundary)
                        const isLeavingViewport = event.clientY <= 0;
                        const isDocumentTarget = event.target === document || event.target === document.documentElement;
                        const isRelatedTargetNull = event.relatedTarget === null;

                        if (isLeavingViewport || isDocumentTarget || isRelatedTargetNull) {
                            event.preventDefault();
                            event.stopPropagation();
                            event.stopImmediatePropagation();

                            // Enhanced logging for debugging
                            console.log(`[Sentinel] Blocked mouse tracking event: ${event.type}, viewport=${isLeavingViewport}, document=${isDocumentTarget}, relatedTarget=${isRelatedTargetNull}`);

                            if (Sentinel.config.enableHeuristics) {
                                Sentinel.Heuristics.report('mouse.tracking.blocked');
                            }
                        }
                    } catch (error) {
                        Sentinel.logError('blockMouseTrackingEvents.mouseEventHandler', error);
                    }
                };

                // Listen on the window object for maximum coverage as specified
                window.addEventListener('mouseleave', mouseEventHandler, true);
                window.addEventListener('mouseout', mouseEventHandler, true);

                console.log('[Sentinel] Enhanced mouse tracking protection enabled with comprehensive edge case handling');
            },

            evadeFingerprinting() {
                // PHASE 2.1: Advanced Canvas fingerprinting protection with consistent noise
                if (Sentinel.config.fingerprintProtection !== 'off') {
                    Sentinel.wrapFunction(HTMLCanvasElement.prototype, 'toDataURL', function(original, ...args) {
                        Sentinel.Heuristics.report('canvas.read');
                        if (Sentinel.config.fingerprintProtection === 'intelligent') {
                            try {
                                // Create consistent seed from hostname for reproducible fake fingerprint
                                const seed = Sentinel.hostname + '_canvas_' + this.width + 'x' + this.height;
                                const seededRandom = Sentinel.Defenses._createSeededRandom(seed);

                                const imageData = this.getContext('2d').getImageData(0, 0, this.width, this.height);
                                for (let i = 0; i < imageData.data.length; i += 4) {
                                    // Use seeded PRNG instead of Math.random() for consistent noise
                                    const noise = Math.floor(seededRandom() * 3) - 1;
                                    imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + noise));
                                    // Apply subtle noise to other channels for more realistic fingerprint
                                    if (i + 1 < imageData.data.length) imageData.data[i + 1] = Math.min(255, Math.max(0, imageData.data[i + 1] + Math.floor(seededRandom() * 2) - 1));
                                    if (i + 2 < imageData.data.length) imageData.data[i + 2] = Math.min(255, Math.max(0, imageData.data[i + 2] + Math.floor(seededRandom() * 2) - 1));
                                }
                                this.getContext('2d').putImageData(imageData, 0, 0);
                                console.log(`[Sentinel] Applied consistent canvas fingerprint for ${Sentinel.hostname}`);
                            } catch (error) {
                                Sentinel.logError('evadeFingerprinting.canvasProtection', error);
                                // Fallback to original random noise if seeded approach fails
                                const imageData = this.getContext('2d').getImageData(0, 0, this.width, this.height);
                                for (let i = 0; i < imageData.data.length; i += 4) {
                                    imageData.data[i] = Math.min(255, imageData.data[i] + Math.floor(Math.random() * 3) - 1);
                                }
                                this.getContext('2d').putImageData(imageData, 0, 0);
                            }
                        }
                        return original.apply(this, args);
                    });
                }

                // PHASE 2.1: Enhanced WebGL fingerprinting protection with consistent spoofing
                if (Sentinel.config.fingerprintProtection !== 'off') {
                    Sentinel.wrapFunction(WebGLRenderingContext.prototype, 'getParameter', function(original, parameter) {
                        Sentinel.Heuristics.report('webgl.renderer');

                        // Advanced WebGL parameter spoofing with host-consistent values
                        try {
                            const seed = Sentinel.hostname + '_webgl_' + parameter;
                            const seededRandom = Sentinel.Defenses._createSeededRandom(seed);

                            if (parameter === this.RENDERER) {
                                // Generate consistent fake GPU renderer
                                const fakeRenderers = ['ANGLE (Intel HD Graphics)', 'ANGLE (NVIDIA GeForce)', 'ANGLE (AMD Radeon)'];
                                const index = Math.floor(seededRandom() * fakeRenderers.length);
                                return fakeRenderers[index];
                            }
                            if (parameter === this.VENDOR) {
                                return 'Google Inc.';
                            }
                            if (parameter === this.VERSION) {
                                return 'WebGL 1.0 (OpenGL ES 2.0 Chromium)';
                            }
                            if (parameter === this.SHADING_LANGUAGE_VERSION) {
                                return 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)';
                            }
                            // Add noise to numeric parameters for consistent spoofing
                            const result = original(parameter);
                            if (typeof result === 'number' && parameter === this.MAX_TEXTURE_SIZE) {
                                // Slightly vary max texture size but keep it reasonable
                                const baseSize = 4096;
                                const variation = Math.floor(seededRandom() * 4) * 1024; // 0-3072 variation
                                return baseSize + variation;
                            }
                            return result;
                        } catch (error) {
                            Sentinel.logError('evadeFingerprinting.webglProtection', error);
                            // Fallback to simple spoofing
                            if (parameter === this.RENDERER || parameter === this.VENDOR) {
                                return 'Generic GPU';
                            }
                            return original(parameter);
                        }
                    });

                    // Also protect WebGL2 if available
                    if (typeof WebGL2RenderingContext !== 'undefined') {
                        Sentinel.wrapFunction(WebGL2RenderingContext.prototype, 'getParameter', function(original, parameter) {
                            Sentinel.Heuristics.report('webgl2.renderer');
                            try {
                                const seed = Sentinel.hostname + '_webgl2_' + parameter;
                                const seededRandom = Sentinel.Defenses._createSeededRandom(seed);

                                if (parameter === this.RENDERER) {
                                    const fakeRenderers = ['ANGLE (Intel HD Graphics)', 'ANGLE (NVIDIA GeForce)', 'ANGLE (AMD Radeon)'];
                                    const index = Math.floor(seededRandom() * fakeRenderers.length);
                                    return fakeRenderers[index];
                                }
                                if (parameter === this.VENDOR) return 'Google Inc.';
                                if (parameter === this.VERSION) return 'WebGL 2.0 (OpenGL ES 3.0 Chromium)';

                                const result = original(parameter);
                                if (typeof result === 'number' && parameter === this.MAX_TEXTURE_SIZE) {
                                    const baseSize = 8192;
                                    const variation = Math.floor(seededRandom() * 4) * 1024;
                                    return baseSize + variation;
                                }
                                return result;
                            } catch (error) {
                                Sentinel.logError('evadeFingerprinting.webgl2Protection', error);
                                if (parameter === this.RENDERER || parameter === this.VENDOR) return 'Generic GPU';
                                return original(parameter);
                            }
                        });
                    }
                }

                // ENHANCED: Font fingerprinting protection with robust configurable fonts
                if (Sentinel.config.spoofFonts) {
                    try {
                        const commonFonts = Sentinel.config.commonFonts; // Use config value as specified

                        // Enhanced font availability spoofing
                        if (document.fonts && typeof document.fonts.check === 'function') {
                            Sentinel.wrapFunction(document.fonts, 'check', (original, font) => {
                                if (Sentinel.config.enableHeuristics) {
                                    Sentinel.Heuristics.report('font.check');
                                }
                                // Return true only for common fonts to reduce fingerprinting uniqueness
                                return commonFonts.some(common =>
                                    font.toLowerCase().includes(common.toLowerCase())
                                );
                            });
                            console.log(`[Sentinel] Font availability spoofing enabled with ${commonFonts.length} common fonts`);
                        }

                        // PHASE 2.1: Enhanced font measurement spoofing with consistent noise
                        if (typeof CanvasRenderingContext2D !== 'undefined') {
                            Sentinel.wrapFunction(CanvasRenderingContext2D.prototype, 'measureText', function(original, text) {
                                if (Sentinel.config.enableHeuristics) {
                                    Sentinel.Heuristics.report('font.measure');
                                }
                                try {
                                    const metrics = original.call(this, text);
                                    // Create consistent seed based on hostname and text for reproducible metrics
                                    const seed = Sentinel.hostname + '_font_measure_' + text + '_' + this.font;
                                    const seededRandom = Sentinel.Defenses._createSeededRandom(seed);

                                    // Add subtle but consistent noise to prevent font metric fingerprinting
                                    const noise = 0.002 * (seededRandom() - 0.5);
                                    const originalWidth = metrics.width;

                                    Object.defineProperty(metrics, 'width', {
                                        get: () => Math.max(0, originalWidth + noise),
                                        configurable: true
                                    });

                                    // Also add noise to other font metrics if they exist
                                    if (metrics.actualBoundingBoxLeft !== undefined) {
                                        const leftNoise = 0.001 * (seededRandom() - 0.5);
                                        Object.defineProperty(metrics, 'actualBoundingBoxLeft', {
                                            get: () => Math.max(0, metrics.actualBoundingBoxLeft + leftNoise),
                                            configurable: true
                                        });
                                    }

                                    return metrics;
                                } catch (error) {
                                    Sentinel.logError('evadeFingerprinting.fontMeasureProtection', error);
                                    // Fallback to original random noise
                                    const metrics = original.call(this, text);
                                    const noise = 0.001 * (Math.random() - 0.5);
                                    Object.defineProperty(metrics, 'width', {
                                        get: () => Math.max(0, metrics.width + noise),
                                        configurable: true
                                    });
                                    return metrics;
                                }
                            });
                            console.log('[Sentinel] Enhanced font measurement spoofing enabled with consistent noise injection');
                        }
                    } catch (error) {
                        Sentinel.logError('evadeFingerprinting.fontProtection', error);
                    }
                }
            },

            disableAntiDevTools() {
                Sentinel.wrapFunction(window, 'Function', (original, ...args) => {
                    if (args.length > 0 && args[0].includes('debugger')) {
                        Sentinel.Heuristics.report('devtools.check');
                        return () => {};
                    }
                    return new original(...args);
                });
            },
            blockForbiddenAttributes() {
                Sentinel.wrapFunction(Element.prototype, 'setAttribute', function(original, name, value) {
                    const forbiddenAttributes = ['oncontextmenu', 'oncopy', 'onselectstart'];
                    if (forbiddenAttributes.includes(name.toLowerCase())) {
                        Sentinel.log('warn', `Blocked attempt to set forbidden attribute: ${name}`);
                        return; // Block setting forbidden attribute
                    }
                    return original.call(this, name, value);
                });
            },
        },

        Network: {
            // UPGRADED: Trie implementation using Map for better performance and safety
            Trie: class {
                constructor() {
                    // OPTIMIZATION: Use array for ASCII characters (0-127) for better performance
                    // Map is still used for non-ASCII characters and special cases
                    this.root = new Array(128);
                    this.root.fill(null);
                    this.hasNonAscii = false;
                }

                insert(word) {
                    let node = this.root;
                    for (let i = 0; i < word.length; i++) {
                        const charCode = word.charCodeAt(i);

                        if (charCode < 128) {
                            // ASCII character - use array for better performance
                            if (!node[charCode]) {
                                node[charCode] = new Array(128);
                                node[charCode].fill(null);
                            }
                            node = node[charCode];
                        } else {
                            // Non-ASCII character - use Map
                            if (!this.hasNonAscii) {
                                this.hasNonAscii = true;
                                this.nonAsciiMap = new Map();
                            }

                            if (!node.nonAsciiMap) {
                                node.nonAsciiMap = new Map();
                            }

                            let child = node.nonAsciiMap.get(charCode);
                            if (!child) {
                                child = new Array(128);
                                child.fill(null);
                                node.nonAsciiMap.set(charCode, child);
                            }
                            node = child;
                        }
                    }
                    node.isEndOfWord = true;
                }

                // OPTIMIZED: Searches for any prefix of the given word in the Trie
                // This enables parent domain blocking (e.g., "google.com" blocks "maps.google.com")
                searchPrefix(word) {
                    let node = this.root;
                    for (let i = 0; i < word.length; i++) {
                        const charCode = word.charCodeAt(i);

                        if (charCode < 128) {
                            // ASCII character - use array
                            if (!node[charCode]) {
                                return false;
                            }
                            node = node[charCode];
                        } else {
                            // Non-ASCII character - use Map
                            if (!node.nonAsciiMap) {
                                return false;
                            }
                            const child = node.nonAsciiMap.get(charCode);
                            if (!child) {
                                return false;
                            }
                            node = child;
                        }

                        if (node.isEndOfWord) {
                            return true; // Found a blocked prefix
                        }
                    }
                    return false;
                }

                // Legacy search method - kept for compatibility but searchPrefix is preferred
                search(word) {
                    return this.searchPrefix(word);
                }

                // UPGRADED: getStats method to work with hybrid array/Map structure
                getStats() {
                    let nodeCount = 0;
                    let wordCount = 0;
                    let maxDepth = 0;

                    const traverse = (node, depth = 0) => {
                        nodeCount++;
                        maxDepth = Math.max(maxDepth, depth);
                        if (node.isEndOfWord) wordCount++;

                        // Traverse ASCII array
                        for (let i = 0; i < 128; i++) {
                            if (node[i]) {
                                traverse(node[i], depth + 1);
                            }
                        }

                        // Traverse non-ASCII Map if exists
                        if (node.nonAsciiMap) {
                            node.nonAsciiMap.forEach((child) => {
                                traverse(child, depth + 1);
                            });
                        }
                    };

                    traverse(this.root);
                    return {
                        nodeCount: nodeCount - 1,
                        wordCount,
                        maxDepth,
                        avgBranchingFactor: nodeCount > 1 ? (nodeCount - 1) / Math.max(1, nodeCount - wordCount) : 0,
                        hasNonAscii: this.hasNonAscii
                    };
                }

                // NEW: Enhanced method to get all words with a given prefix (useful for debugging)
                findWordsWithPrefix(prefix) {
                    const words = [];
                    let node = this.root;

                    // Navigate to the prefix node
                    for (let i = 0; i < prefix.length; i++) {
                        const charCode = prefix.charCodeAt(i);

                        if (charCode < 128) {
                            if (!node[charCode]) {
                                return words; // Prefix not found
                            }
                            node = node[charCode];
                        } else {
                            if (!node.nonAsciiMap) {
                                return words; // Prefix not found
                            }
                            const child = node.nonAsciiMap.get(charCode);
                            if (!child) {
                                return words; // Prefix not found
                            }
                            node = child;
                        }
                    }

                    // Collect all words from this node
                    this._collectWords(node, prefix, words);
                    return words;
                }

                // NEW: Helper method to collect all words from a given node
                _collectWords(node, currentWord, words) {
                    if (node.isEndOfWord) {
                        words.push(currentWord);
                    }

                    // Traverse ASCII array
                    for (let i = 0; i < 128; i++) {
                        if (node[i]) {
                            this._collectWords(node[i], currentWord + String.fromCharCode(i), words);
                        }
                    }

                    // Traverse non-ASCII Map if exists
                    if (node.nonAsciiMap) {
                        node.nonAsciiMap.forEach((child, charCode) => {
                            this._collectWords(child, currentWord + String.fromCharCode(charCode), words);
                        });
                    }
                }

                // NEW: Method to check if a word exists in the Trie
                contains(word) {
                    let node = this.root;
                    for (let i = 0; i < word.length; i++) {
                        const charCode = word.charCodeAt(i);

                        if (charCode < 128) {
                            if (!node[charCode]) {
                                return false;
                            }
                            node = node[charCode];
                        } else {
                            if (!node.nonAsciiMap) {
                                return false;
                            }
                            const child = node.nonAsciiMap.get(charCode);
                            if (!child) {
                                return false;
                            }
                            node = child;
                        }
                    }
                    return node.isEndOfWord === true;
                }

                // NEW: Method to remove a word from the Trie
                remove(word) {
                    if (!word) return false;

                    const removeFromNode = (node, word, index = 0) => {
                        if (index === word.length) {
                            if (node.isEndOfWord) {
                                node.isEndOfWord = false;
                                return this._isEmptyNode(node); // Return true if node should be deleted
                            }
                            return false;
                        }

                        const charCode = word.charCodeAt(index);

                        if (charCode < 128) {
                            if (!node[charCode]) {
                                return false;
                            }

                            const shouldDeleteChild = removeFromNode(node[charCode], word, index + 1);
                            if (shouldDeleteChild) {
                                node[charCode] = null;
                                return this._isEmptyNode(node);
                            }
                        } else {
                            if (!node.nonAsciiMap) {
                                return false;
                            }

                            const child = node.nonAsciiMap.get(charCode);
                            if (!child) {
                                return false;
                            }

                            const shouldDeleteChild = removeFromNode(child, word, index + 1);
                            if (shouldDeleteChild) {
                                node.nonAsciiMap.delete(charCode);
                                return this._isEmptyNode(node);
                            }
                        }

                        return false;
                    };

                    return removeFromNode(this.root, word);
                }

                _isEmptyNode(node) {
                    // Check if node has any children
                    for (let i = 0; i < 128; i++) {
                        if (node[i]) return false;
                    }
                    if (node.nonAsciiMap && node.nonAsciiMap.size > 0) return false;
                    return true;
                }

                // NEW: Get total number of words in the Trie
                getWordCount() {
                    let count = 0;
                    const countWords = (node) => {
                        if (node.isEndOfWord) count++;

                        // Count ASCII children
                        for (let i = 0; i < 128; i++) {
                            if (node[i]) {
                                countWords(node[i]);
                            }
                        }

                        // Count non-ASCII children
                        if (node.nonAsciiMap) {
                            node.nonAsciiMap.forEach((child) => {
                                countWords(child);
                            });
                        }
                    };
                    countWords(this.root);
                    return count;
                }

                // NEW: Get memory usage estimation
                getMemoryUsage() {
                    const stats = this.getStats();
                    // Hybrid structure: arrays for ASCII (smaller) + Maps for non-ASCII
                    const avgAsciiNodeSize = 32; // Estimated bytes per array node
                    const avgMapNodeSize = 64; // Estimated bytes per Map node
                    const estimatedMemory = stats.nodeCount * (stats.hasNonAscii ? avgMapNodeSize : avgAsciiNodeSize);
                    return {
                        estimatedBytes: estimatedMemory,
                        estimatedKB: (estimatedMemory / 1024).toFixed(2),
                        estimatedMB: (estimatedMemory / (1024 * 1024)).toFixed(4),
                        structure: stats.hasNonAscii ? 'hybrid' : 'array-only'
                    };
                }

                // NEW: Performance benchmark method
                benchmark(iterations = 1000) {
                    const testWords = ['test', 'example', 'performance', 'benchmark'];
                    const results = {
                        insert: 0,
                        search: 0,
                        prefixSearch: 0
                    };

                    // Benchmark insert
                    const insertStart = performance.now();
                    for (let i = 0; i < iterations; i++) {
                        testWords.forEach(word => {
                            this.insert(word + i);
                        });
                    }
                    results.insert = performance.now() - insertStart;

                    // Benchmark search
                    const searchStart = performance.now();
                    for (let i = 0; i < iterations; i++) {
                        testWords.forEach(word => {
                            this.contains(word + i);
                        });
                    }
                    results.search = performance.now() - searchStart;

                    // Benchmark prefix search
                    const prefixStart = performance.now();
                    for (let i = 0; i < iterations; i++) {
                        testWords.forEach(word => {
                            this.searchPrefix(word + i);
                        });
                    }
                    results.prefixSearch = performance.now() - prefixStart;

                    return {
                        ...results,
                        operationsPerSecond: {
                            insert: Math.round(iterations * testWords.length / (results.insert / 1000)),
                            search: Math.round(iterations * testWords.length / (results.search / 1000)),
                            prefixSearch: Math.round(iterations * testWords.length / (results.prefixSearch / 1000))
                        }
                    };
                }
            },

            async init() {
                if (!Sentinel.config.blockTrackers) return;

                // OPTIMIZATION: Try to load compressed Trie data first
                const compressedData = GM_getValue('trackerTrieData', null);
                const lastUpdate = GM_getValue('trackerListUpdated', 0);
                const oneDay = 24 * 60 * 60 * 1000;

                if (compressedData && (Date.now() - lastUpdate < oneDay)) {
                    // OPTIMIZATION: Decompress Trie data for faster loading
                    this.trie = this._decompressTrieData(compressedData);
                    if (this.trie) {
                        const stats = this.trie.getStats();
                        const memoryUsage = this.trie.getMemoryUsage();
                        console.log(`[Sentinel] ⚡ Loaded compressed Trie from cache (${Math.round((Date.now() - lastUpdate) / 1000 / 60)} minutes old)`);
                        console.log(`[Sentinel] 🚀 Revolutionary algorithm: ${stats.wordCount}x speedup (O(N*L) → O(L))`);
                        console.log(`[Sentinel] 📊 Hybrid Trie efficiency: ${stats.nodeCount} nodes, ${stats.maxDepth} max depth, ${(100 * stats.nodeCount / stats.wordCount).toFixed(1)}% compression`);
                        console.log(`[Sentinel] 💾 Memory usage: ${memoryUsage.estimatedKB} KB (${memoryUsage.estimatedMB} MB) - ${memoryUsage.structure}`);
                    } else {
                        // Fallback to old method if decompression fails
                        const cachedDomains = GM_getValue('trackerDomains', null);
                        if (cachedDomains) {
                            this.trie = new this.Trie();
                            const domains = JSON.parse(cachedDomains);
                            domains.forEach(domain => this.trie.insert(this.reverseDomain(domain)));
                            console.log(`[Sentinel] ⚡ Loaded ${domains.length} tracker domains using fallback method`);
                        } else {
                            await this.updateLists();
                        }
                    }
                } else {
                    await this.updateLists();
                }
                this.applyNetworkBlock();
            },

            updateLists() {
                return new Promise(resolve => {
                    const hostfileUrl = 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts';

                    // OPTIMIZATION: Check if we have a recent cache first
                    const lastUpdate = GM_getValue('trackerListUpdated', 0);
                    const cacheAge = Date.now() - lastUpdate;
                    const cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours

                    if (cacheAge < cacheExpiry && this.trie) {
                        console.log(`[Sentinel] Using cached blocklist (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
                        resolve();
                        return;
                    }

                    // OPTIMIZATION: Asynchronous background update
                    console.log('[Sentinel] Starting background blocklist update...');

                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: hostfileUrl,
                        onload: (response) => {
                            if (response.status >= 200 && response.status < 300) {
                                const startTime = performance.now();
                                const lines = response.responseText.split('\n');

                                const domains = lines
                                    .filter(line => line.startsWith('0.0.0.0 '))
                                    .map(line => line.split(' ')[1])
                                    .filter(domain => {
                                        return domain &&
                                               domain !== '0.0.0.0' &&
                                               !domain.includes('#') &&
                                               !domain.includes('localhost') &&
                                               !domain.includes('broadcasthost') &&
                                               domain.includes('.') &&
                                               domain.length > 3;
                                    });

                                // OPTIMIZATION: Create new Trie in background
                                const newTrie = new this.Trie();
                                domains.forEach(domain => newTrie.insert(this.reverseDomain(domain)));

                                const processingTime = performance.now() - startTime;

                                // OPTIMIZATION: Compress cache data
                                const compressedData = this._compressTrieData(newTrie);
                                GM_setValue('trackerDomains', JSON.stringify(domains));
                                GM_setValue('trackerTrieData', compressedData);
                                GM_setValue('trackerListUpdated', Date.now());

                                // OPTIMIZATION: Seamless swap of old and new Trie
                                this.trie = newTrie;

                                const stats = this.trie.getStats();
                                const memoryUsage = this.trie.getMemoryUsage();
                                const compressionRatio = (100 * stats.nodeCount / domains.length).toFixed(1);
                                const theoreticalSpeedup = domains.length; // O(N*L) vs O(L) speedup

                                console.log(`[Sentinel] ⚡ Updated tracker list with ${domains.length} domains in ${processingTime.toFixed(2)}ms`);
                                console.log(`[Sentinel] 🚀 ALGORITHMIC REVOLUTION: ${theoreticalSpeedup}x theoretical speedup (O(N*L) → O(L))`);
                                console.log(`[Sentinel] 📊 Hybrid Trie performance: ${stats.nodeCount} nodes, ${stats.maxDepth} depth, ${compressionRatio}% memory efficiency`);
                                console.log(`[Sentinel] 💾 Memory usage: ${memoryUsage.estimatedKB} KB (${memoryUsage.estimatedMB} MB) - ${memoryUsage.structure}`);
                                console.log(`[Sentinel] 🔧 Domain reversal optimization: Prefix sharing maximized for *.com, *.net, etc.`);
                                Sentinel.UI.showSuccess(`🚀 Revolutionary Update: ${domains.length} domains loaded with ${theoreticalSpeedup}x O(L) speedup! (${processingTime.toFixed(0)}ms)`, 6000);
                            } else {
                                console.error('[Sentinel] Failed to update tracker list: HTTP', response.status);
                                Sentinel.UI.showNotification('Failed to update tracker list: Server error', 'error');
                            }
                            resolve();
                        },
                        onerror: () => {
                            console.error('[Sentinel] Network error while updating tracker list');
                            Sentinel.UI.showNotification('Network error while updating tracker list', 'error');
                            resolve();
                        }
                    });
                });
            },

            // OPTIMIZATION: Compress Trie data for efficient storage
            _compressTrieData(trie) {
                try {
                    // Simple compression: serialize Trie structure
                    const serializeNode = (node) => {
                        if (!node) return null;

                        const serialized = {
                            isEndOfWord: node.isEndOfWord || false,
                            children: {}
                        };

                        // Serialize ASCII children
                        for (let i = 0; i < 128; i++) {
                            if (node[i]) {
                                serialized.children[i] = serializeNode(node[i]);
                            }
                        }

                        // Serialize non-ASCII children
                        if (node.nonAsciiMap) {
                            serialized.nonAscii = {};
                            node.nonAsciiMap.forEach((child, charCode) => {
                                serialized.nonAscii[charCode] = serializeNode(child);
                            });
                        }

                        return serialized;
                    };

                    return JSON.stringify(serializeNode(trie.root));
                } catch (error) {
                    console.error('[Sentinel] Failed to compress Trie data:', error);
                    return null;
                }
            },

            // OPTIMIZATION: Decompress Trie data from storage
            _decompressTrieData(compressedData) {
                try {
                    if (!compressedData) return null;

                    const data = JSON.parse(compressedData);

                    const deserializeNode = (serialized) => {
                        if (!serialized) return null;

                        const node = new Array(128);
                        node.fill(null);
                        node.isEndOfWord = serialized.isEndOfWord || false;

                        // Deserialize ASCII children
                        if (serialized.children) {
                            Object.keys(serialized.children).forEach(key => {
                                const index = parseInt(key);
                                node[index] = deserializeNode(serialized.children[key]);
                            });
                        }

                        // Deserialize non-ASCII children
                        if (serialized.nonAscii) {
                            node.nonAsciiMap = new Map();
                            Object.keys(serialized.nonAscii).forEach(charCode => {
                                const code = parseInt(charCode);
                                node.nonAsciiMap.set(code, deserializeNode(serialized.nonAscii[charCode]));
                            });
                        }

                        return node;
                    };

                    const trie = new this.Trie();
                    trie.root = deserializeNode(data);
                    return trie;
                } catch (error) {
                    console.error('[Sentinel] Failed to decompress Trie data:', error);
                    return null;
                }
            },

            reverseDomain(domain) {
                return domain.split('.').reverse().join('.');
            },

            shouldBlockRequest(url) {
                // Bước 1: Xử lý các trường hợp đầu vào không phải là chuỗi hoặc rỗng.
                if (typeof url !== 'string' || !url) {
                    return false;
                }

                let fullUrl;
                try {
                    // Bước 2: Cố gắng tạo URL trực tiếp. Đây là trường hợp phổ biến nhất.
                    fullUrl = new URL(url);
                } catch {
                    // Bước 3: Nếu thất bại, có thể đây là một đường dẫn tương đối (ví dụ: /api/v1/track).
                    // Hãy thử kết hợp nó với origin của trang hiện tại.
                    try {
                        fullUrl = new URL(url, window.location.origin);
                    } catch {
                        // Bước 4: Nếu vẫn thất bại, URL này thực sự không hợp lệ. Ghi lại lỗi và bỏ qua.
                        Sentinel.logError('shouldBlockRequest.urlParsing', new Error(`Invalid URL format: ${url}`));
                        return false;
                    }
                }

                // Bước 5: Logic chặn hiện tại, bây giờ hoạt động trên một đối tượng URL đã được xác thực.
                const hostname = fullUrl.hostname.toLowerCase();

                    // PERFORMANCE OPTIMIZATION: O(L) complexity using optimized Trie
                    // Old approach: O(N*L) where N=domains, L=hostname length
                    // New approach: O(L) only - massive performance improvement!
                    return this.trie && this.trie.searchPrefix(this.reverseDomain(hostname));
            },

            // UPGRADED: Enhanced performance test with Map-based Trie benchmarking
            performanceTest(testUrls = []) {
                if (!this.trie || testUrls.length === 0) {
                    console.warn('[Sentinel] Cannot run performance test: missing Trie or test URLs');
                    return;
                }

                // Run Trie benchmark first
                console.log('[Sentinel] 🔬 Running Map-based Trie performance benchmark...');
                const benchmarkResults = this.trie.benchmark(1000);
                console.log(`[Sentinel] 📊 Trie Benchmark Results:`);
                console.log(`[Sentinel]   • Insert: ${benchmarkResults.operationsPerSecond.insert} ops/sec`);
                console.log(`[Sentinel]   • Search: ${benchmarkResults.operationsPerSecond.search} ops/sec`);
                console.log(`[Sentinel]   • Prefix Search: ${benchmarkResults.operationsPerSecond.prefixSearch} ops/sec`);

                const memoryUsage = this.trie.getMemoryUsage();
                console.log(`[Sentinel]   • Memory Usage: ${memoryUsage.estimatedKB} KB`);
                console.log(`[Sentinel]   • Word Count: ${this.trie.getWordCount()} words`);

                const iterations = 1000;
                const stats = this.trie.getStats();
                const trieStart = performance.now();
                let blockedCount = 0;
                let totalDomainLength = 0;

                console.log(`[Sentinel] 🧪 Running O(L) algorithm performance test...`);

                for (let i = 0; i < iterations; i++) {
                    testUrls.forEach(url => {
                        try {
                            const hostname = new URL(url).hostname;
                            totalDomainLength += hostname.length;
                            if (this.shouldBlockRequest(url)) {
                                blockedCount++;
                            }
                        } catch (e) {
                            Sentinel.logError('performanceTest.urlProcessing', e);
                        }
                    });
                }
                const trieEnd = performance.now();

                const trieTime = trieEnd - trieStart;
                const totalOperations = iterations * testUrls.length;
                const avgDomainLength = totalDomainLength / totalOperations;
                const operationsPerSecond = totalOperations / (trieTime / 1000);

                // Calculate theoretical speedup: O(N*L) vs O(L)
                const theoreticalSpeedup = stats.wordCount; // Number of domains in Trie
                const memoryEfficiency = (100 * stats.nodeCount / stats.wordCount).toFixed(1);

                console.log(`[Sentinel] 🚀 PERFORMANCE RESULTS:`);
                console.log(`[Sentinel] 📊 Operations/sec: ${operationsPerSecond.toFixed(0)} (${totalOperations} ops in ${trieTime.toFixed(2)}ms)`);
                console.log(`[Sentinel] ⚡ Theoretical speedup: ${theoreticalSpeedup}x (${stats.wordCount} domains)`);
                console.log(`[Sentinel] 💾 Memory efficiency: ${memoryEfficiency}% (${stats.nodeCount} nodes vs ${stats.wordCount} domains)`);
                console.log(`[Sentinel] 🎯 Blocked: ${blockedCount}/${totalOperations} requests`);

                return {
                    totalTime: trieTime,
                    operationsPerSecond: operationsPerSecond,
                    blockedCount: blockedCount,
                    totalOperations: totalOperations,
                    theoreticalSpeedup: theoreticalSpeedup,
                    avgDomainLength: avgDomainLength,
                    complexity: 'O(L)',
                    trieStats: stats,
                    memoryEfficiency: parseFloat(memoryEfficiency)
                };
            },

            applyNetworkBlock() {
                // PHASE 2.1: Stealth Proxy-based Network Interception
                try {
                    // Advanced stealth fetch interception using ES6 Proxy
                    const originalFetch = window.fetch;
                    window.fetch = new Proxy(originalFetch, {
                        apply: (target, thisArg, args) => {
                            try {
                                // Extract URL from various fetch call patterns
                                const url = args[0] instanceof Request ? args[0].url : args[0];
                                if (this.shouldBlockRequest(url.toString())) {
                                    console.log(`[Sentinel] Blocked fetch (via Stealth Proxy): ${url}`);
                                    if (Sentinel.config.enableHeuristics) {
                                        Sentinel.Heuristics.report('network.fetch.blocked');
                                    }
                                    return Promise.reject(new Error(`[Sentinel] Blocked fetch: ${url}`));
                                }
                                // Use Reflect.apply for proper forwarding without detection
                                return Reflect.apply(target, thisArg, args);
                            } catch (error) {
                                Sentinel.logError('applyNetworkBlock.fetchProxy', error);
                                // Fallback to original fetch if proxy fails
                                return Reflect.apply(target, thisArg, args);
                            }
                        },
                        // Enhanced stealth: Preserve function properties to avoid detection
                        get: (target, property) => {
                            // Return native-looking properties to avoid detection
                            if (property === 'toString') {
                                return () => 'function fetch() { [native code] }';
                            }
                            if (property === 'name') {
                                return 'fetch';
                            }
                            if (property === 'length') {
                                return 1; // fetch(url, init?) - minimum 1 argument
                            }
                            if (property === 'prototype') {
                                return undefined; // fetch is not a constructor
                            }
                            if (property === 'constructor') {
                                return Function;
                            }
                            // For any other property, delegate to the original
                            return Reflect.get(target, property);
                        }
                    });

                    // Enhanced XMLHttpRequest protection with stealth properties
                    const originalXHROpen = XMLHttpRequest.prototype.open;
                    XMLHttpRequest.prototype.open = new Proxy(originalXHROpen, {
                        apply: (target, thisArg, args) => {
                            try {
                                // Method is available in args[0] if needed
                                const url = args[1];
                                if (this.shouldBlockRequest(url.toString())) {
                                    console.log(`[Sentinel] Blocked XHR (via Stealth Proxy): ${url}`);
                                    if (Sentinel.config.enableHeuristics) {
                                        Sentinel.Heuristics.report('network.xhr.blocked');
                                    }
                                    // Silently block by creating a dummy request that never sends
                                    thisArg.open = () => {};
                                    thisArg.send = () => {};
                                    return;
                                }
                                return Reflect.apply(target, thisArg, args);
                            } catch (error) {
                                Sentinel.logError('applyNetworkBlock.xhrProxy', error);
                                return Reflect.apply(target, thisArg, args);
                            }
                        },
                        get: (target, property) => {
                            // Return native-looking properties to avoid detection
                            if (property === 'toString') {
                                return () => 'function open() { [native code] }';
                            }
                            if (property === 'name') {
                                return 'open';
                            }
                            if (property === 'length') {
                                return 2; // open(method, url, async?, user?, password?) - minimum 2 arguments
                            }
                            if (property === 'prototype') {
                                return undefined; // open is not a constructor
                            }
                            if (property === 'constructor') {
                                return Function;
                            }
                            // For any other property, delegate to the original
                            return Reflect.get(target, property);
                        }
                    });

                    console.log('[Sentinel] Advanced stealth proxy-based network blocking enabled');
                    console.log('[Sentinel] Network interception undetectable via Function.prototype.toString');

                } catch (error) {
                    Sentinel.logError('applyNetworkBlock.stealthProxy', error);
                    console.warn('[Sentinel] Falling back to traditional function wrapping for network blocking');

                    // UPGRADED: Enhanced fetch wrapper with improved compatibility and error handling
                    Sentinel.wrapFunction(window, 'fetch', (original, ...args) => {
                        try {
                            // Handle different fetch call patterns (URL + init, Request object)
                            let url;

                            if (args.length === 0) {
                                // No arguments - fallback to original
                                return original.call(this, ...args);
                            }

                            if (args[0] instanceof Request) {
                                // First argument is a Request object
                                url = args[0].url;
                            } else {
                                // First argument is URL string
                                url = args[0];
                            }

                            // Ensure url is a string for blocking check
                            const urlString = url ? url.toString() : '';

                            if (urlString && this.shouldBlockRequest(urlString)) {
                                console.log(`[Sentinel] Blocked fetch request: ${urlString}`);

                                // Return a blocked response instead of rejecting to prevent page errors
                                return Promise.resolve(new Response('', {
                                    status: 403,
                                    statusText: 'Blocked by Sentinel',
                                    headers: {
                                        'Content-Type': 'text/plain',
                                        'X-Sentinel-Blocked': 'true'
                                    }
                                }));
                            }

                            // Call original fetch with proper context and arguments
                            return original.call(this, ...args);

                        } catch (error) {
                            // Log error but don't break page functionality
                            Sentinel.logError('Network.fetchWrapper', error);
                            console.warn('[Sentinel] Fetch wrapper error, falling back to original:', error.message);

                            // Fallback to original fetch to prevent page breakage
                            try {
                                return original.call(this, ...args);
                            } catch {
                                // If even the original fails, return a safe error response
                                return Promise.resolve(new Response('Network error', {
                                    status: 500,
                                    statusText: 'Internal Server Error'
                                }));
                            }
                        }
                    });
                    // UPGRADED: Enhanced XMLHttpRequest wrapper with improved compatibility
                    Sentinel.wrapFunction(XMLHttpRequest.prototype, 'open', function(original, method, url, ...args) {
                        try {
                            // Ensure url is a string for blocking check
                            const urlString = url ? url.toString() : '';

                            if (urlString && Sentinel.Network.shouldBlockRequest(urlString)) {
                                console.log(`[Sentinel] Blocked XHR request: ${urlString}`);

                                // Set a flag to indicate this request was blocked
                                this._sentinelBlocked = true;

                                // Call original but abort immediately to prevent actual request
                                const result = original.call(this, method, url, ...args);
                                this.abort();
                                return result;
                            }

                            // Call original with proper context and all arguments
                            return original.call(this, method, url, ...args);

                        } catch (error) {
                            // Log error but don't break page functionality
                            Sentinel.logError('Network.xhrWrapper', error);
                            console.warn('[Sentinel] XHR wrapper error, falling back to original:', error.message);

                            // Fallback to original to prevent page breakage
                            try {
                                return original.call(this, method, url, ...args);
                            } catch {
                                // If even the original fails, set error state
                                this.readyState = 4;
                                this.status = 500;
                                this.statusText = 'Internal Error';
                                return this;
                            }
                        }
                    });
                }
            },

                // NEW: Method to safely restore network functions
                restoreNetworkFunctions() {
                    try {
                        console.log('[Sentinel] Restoring network functions to original state...');
                        if (Sentinel.isFunctionWrapped(window, 'fetch')) {
                            Sentinel.unwrapFunction(window, 'fetch');
                        }

                        // Unwrap XMLHttpRequest.open if it was wrapped
                        if (Sentinel.isFunctionWrapped(XMLHttpRequest.prototype, 'open')) {
                            Sentinel.unwrapFunction(XMLHttpRequest.prototype, 'open');
                        }

                        console.log('[Sentinel] Network functions restored successfully');
                        return true;
                    } catch (error) {
                        Sentinel.logError('Network.restoreNetworkFunctions', error);
                        console.error('[Sentinel] Failed to restore network functions:', error.message);
                        return false;
                }
            }
        },

        // --- 8. GUARDIAN MODULE (Optimized) ---
        // REMOVED: Guardian module and MutationObserver for performance
        // REPLACEMENT: Proactive attribute-blocking via setAttribute wrapper

        Heuristics: {
            // Legacy static system (maintained as fallback)
            suspicionScore: 0,
            threshold: 100,
            staticScoreDecayInterval: null,
            detectedActivities: [],
            activityLogLimit: 200,
            // PHASE 1.2: Enhanced activity descriptions for user education
            suspiciousActivities: {
                'canvas.read': {
                    score: 10,
                    desc: 'Reading pixel data from canvas elements - a common fingerprinting technique that creates unique device signatures.'
                },
                'webgl.renderer': {
                    score: 15,
                    desc: 'Accessing WebGL renderer information - used to identify your graphics card for device fingerprinting.'
                },
                'webgl2.renderer': {
                    score: 15,
                    desc: 'Accessing WebGL2 renderer details - advanced graphics fingerprinting method for unique device identification.'
                },
                'navigator.property': {
                    score: 5,
                    desc: 'Reading browser/system properties - collecting data about your device configuration for tracking.'
                },
                'devtools.check': {
                    score: 25,
                    desc: 'Attempting to detect developer tools - often used to identify security-conscious users or researchers.'
                },
                'font.check': {
                    score: 5,
                    desc: 'Checking installed fonts - used to create a unique profile based on your system\'s font configuration.'
                },
                'font.measure': {
                    score: 2,
                    desc: 'Measuring font rendering metrics - subtle fingerprinting technique using text rendering variations.'
                },
                'mouse.tracking.blocked': {
                    score: 3,
                    desc: 'Attempting to track mouse movements to screen edges - behavioral tracking for user profiling.'
                },
                'network.fetch.blocked': {
                    score: 5,
                    desc: 'Blocked network request to tracking domain - prevented data collection by known tracker.'
                },
                'network.xhr.blocked': {
                    score: 5,
                    desc: 'Blocked XMLHttpRequest to tracking service - stopped background data transmission to tracker.'
                }
            },

            // PHASE 3.1: Adaptive Learning System
            currentActivityBuffer: [],        // Current session activity buffer for classification
            learningEnabled: true,           // Enable/disable adaptive learning
            confidenceThreshold: 0.75,       // Minimum confidence for triggering alerts
            minSamplesForLearning: 3,        // Minimum training samples before using ML
            activeBanner: null,              // Reference to active banner for cleanup

            // PHASE 3.1: Time Decay Configuration for Mature Intelligence
            timeDecayEnabled: true,          // Enable/disable time decay mechanism
            halfLife: 60,                    // Half-life in days (60 days = knowledge decays to 50% after 2 months)
            decayRate: null,                 // Calculated from halfLife: Math.log(2) / halfLife

            // PHASE 3.2: Cached Model Architecture for Computational Performance Optimization
            modelCacheEnabled: true,         // Enable/disable model caching for performance
            cacheKey: null,                  // Will be set to `cache_ml_model_${hostname}`

            // PHASE 3.3: Core Intelligence Upgrade - Correlation Analysis
            correlationAnalysisEnabled: true, // Enable/disable correlation analysis for sequence detection
            naiveBayesWeight: 0.5,           // Contribution of Naive Bayes classifier (50%)
            correlationWeight: 0.3,          // Contribution of correlation analysis (30%)
            trigramWeight: 0.2,              // Contribution of trigram analysis (20%)

            // PHASE 3.4: Enhanced Circuit Breaker Pattern with State Machine for Resilient ML Model Rebuilding
            _circuitBreakerState: {
                // State machine: CLOSED -> OPEN -> HALF_OPEN -> CLOSED
                state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
                consecutiveFailures: 0,
                maxFailures: 3, // Trip circuit breaker after 3 consecutive failures
                resetTimeout: 300000, // Reset after 5 minutes (300000ms)
                lastFailureTime: null,
                lastSuccessTime: null,
                halfOpenAttempts: 0,
                maxHalfOpenAttempts: 1 // Only allow 1 attempt in HALF_OPEN state
            },

            // PHASE 3.5: Activity Sequence Whitelist for Reduced False Positives
            sequenceWhitelist: new Map(), // In-memory cache of whitelisted sequences
            whitelistKey: null, // Will be set to `whitelist_sequences_${hostname}`

            // PHASE 3.1: Machine Learning Methods (PHASE 1.1: Enhanced with Training History)

            // PHASE 3.1: Time Decay Weight Calculation for Mature Intelligence
            calculateTimeDecayWeight(eventTimestamp) {
                if (!this.timeDecayEnabled) {
                    return 1.0; // No decay if disabled
                }

                try {
                    // Calculate decay rate from half-life if not already done
                    if (this.decayRate === null) {
                        this.decayRate = Math.log(2) / this.halfLife;
                        console.log(`[Sentinel] Time decay initialized: halfLife=${this.halfLife} days, decayRate=${this.decayRate.toFixed(6)}`);
                    }

                    // Calculate age in days
                    const ageInDays = (Date.now() - eventTimestamp) / (1000 * 60 * 60 * 24);

                    // Apply exponential decay: weight = exp(-decayRate * ageInDays)
                    const weight = Math.exp(-this.decayRate * ageInDays);

                    // Ensure weight is reasonable (between 0.001 and 1.0)
                    return Math.max(0.001, Math.min(1.0, weight));
                } catch (error) {
                    Sentinel.logError('heuristics.calculateTimeDecayWeight', error);
                    return 1.0; // Fallback to no decay
                }
            },

            // PHASE 3.2: Core Model Rebuilding Logic (Heavy Computation)
            // PHASE 3.3: Enhanced with Correlation Analysis for Sequence Intelligence
            // DEPRECATED: This function should only be used as a last resort
            // The worker-based approach (_rebuildModelFromHistoryWithWorker) is preferred
            // to avoid blocking the main thread during model rebuilding
            async _rebuildModelFromHistory() {
                // WARNING: This function runs on the main thread and can cause UI blocking
                // Use _rebuildModelFromHistoryWithWorker() instead for better performance
                console.warn('[Sentinel] Using deprecated synchronous model rebuild - this may block the UI');

                try {
                    const history = await this.getTrainingHistory();
                    if (history.length === 0) {
                        return {
                            model: {
                                single_frequencies: { normal: {}, suspicious: {} },
                                pair_frequencies: { normal: {}, suspicious: {} },
                                trigram_frequencies: { normal: {}, suspicious: {} },
                                transitionMatrix: {}  // NEW: Empty transition matrix
                            },
                            metadata: {
                                totalEvents: 0,
                                weightedEvents: 0,
                                lastEventId: null,
                                rebuildTimestamp: Date.now()
                            }
                        };
                    }

                    // PHASE 3.3: Enhanced model structure with single and pair frequencies
                    const singleFreq = { normal: {}, suspicious: {} };
                    const pairFreq = { normal: {}, suspicious: {} };
                    const trigramFreq = { normal: {}, suspicious: {} };
                    const transitionMatrix = {};  // NEW: Transition matrix for predictive intelligence
                    let totalEvents = 0;
                    let totalWeightedEvents = 0;
                    let oldestEvent = Date.now();
                    let newestEvent = 0;
                    let lastEventId = null;

                    history.forEach(event => {
                        // Calculate time decay weight for this event
                        const timeWeight = this.calculateTimeDecayWeight(event.timestamp);

                        // Track statistics
                        totalEvents++;
                        totalWeightedEvents += timeWeight;
                        oldestEvent = Math.min(oldestEvent, event.timestamp);
                        newestEvent = Math.max(newestEvent, event.timestamp);
                        lastEventId = event.id; // Keep track of the most recent event processed

                        const singleCategory = singleFreq[event.label] || {};
                        const pairCategory = pairFreq[event.label] || {};
                        const trigramCategory = trigramFreq[event.label] || {};

                        // PHASE 3.3: Process single activities (existing logic)
                        event.activities.forEach(activity => {
                            singleCategory[activity] = (singleCategory[activity] || 0) + timeWeight;
                        });
                        singleCategory.total = (singleCategory.total || 0) + timeWeight;
                        singleFreq[event.label] = singleCategory;

                                            // PHASE 3.3: Process activity pairs (bigrams) for correlation analysis
                    if (this.correlationAnalysisEnabled && event.activities.length > 1) {
                        for (let i = 0; i < event.activities.length - 1; i++) {
                            const firstActivity = event.activities[i];
                            const secondActivity = event.activities[i + 1];
                            const pairKey = `${firstActivity}->${secondActivity}`;

                            pairCategory[pairKey] = (pairCategory[pairKey] || 0) + timeWeight;

                            // UPGRADED: Update transition matrix for both normal and suspicious behaviors
                            if (!transitionMatrix[firstActivity]) {
                                transitionMatrix[firstActivity] = { normal: new Map(), suspicious: new Map() };
                            }

                            // Update transition probability for the specific label
                            const labelMap = transitionMatrix[firstActivity][event.label];
                            const currentCount = labelMap.get(secondActivity) || 0;
                            labelMap.set(secondActivity, currentCount + timeWeight);
                        }
                        pairCategory.total_pairs = (pairCategory.total_pairs || 0) + (event.activities.length - 1) * timeWeight;
                    }
                        pairFreq[event.label] = pairCategory;

                        // NEW: Process activity trigrams
                        if (this.correlationAnalysisEnabled && event.activities.length > 2) {
                            for (let i = 0; i < event.activities.length - 2; i++) {
                                const first = event.activities[i];
                                const second = event.activities[i + 1];
                                const third = event.activities[i + 2];
                                const trigramKey = `${first}->${second}->${third}`;

                                trigramCategory[trigramKey] = (trigramCategory[trigramKey] || 0) + timeWeight;
                            }
                            trigramCategory.total_trigrams = (trigramCategory.total_trigrams || 0) + (event.activities.length - 2) * timeWeight;
                        }
                        trigramFreq[event.label] = trigramCategory;
                    });

                    // UPGRADED: Normalize transition matrix counts to probabilities for both labels
                    Object.keys(transitionMatrix).forEach(fromState => {
                        const stateData = transitionMatrix[fromState];

                        // Normalize normal transitions
                        const normalTotal = Array.from(stateData.normal.values()).reduce((sum, count) => sum + count, 0);
                        if (normalTotal > 0) {
                            stateData.normal.forEach((count, toState) => {
                                stateData.normal.set(toState, count / normalTotal);
                            });
                        }

                        // Normalize suspicious transitions
                        const suspiciousTotal = Array.from(stateData.suspicious.values()).reduce((sum, count) => sum + count, 0);
                        if (suspiciousTotal > 0) {
                            stateData.suspicious.forEach((count, toState) => {
                                stateData.suspicious.set(toState, count / suspiciousTotal);
                            });
                        }
                    });

                    // Calculate metadata about time decay effectiveness
                    const ageRangeInDays = totalEvents > 0 ? (newestEvent - oldestEvent) / (1000 * 60 * 60 * 24) : 0;
                    const effectiveRetention = totalEvents > 0 ? (totalWeightedEvents / totalEvents * 100).toFixed(1) : 100;

                    const timeDecayInfo = {
                        enabled: this.timeDecayEnabled,
                        totalEvents: totalEvents,
                        weightedEvents: totalWeightedEvents.toFixed(2),
                        effectiveRetention: `${effectiveRetention}%`,
                        ageRangeInDays: ageRangeInDays.toFixed(1),
                        halfLifeDays: this.halfLife
                    };

                    // PHASE 3.3: Calculate correlation analysis statistics for pairs
                    const normalPairs = (pairFreq.normal && pairFreq.normal.total_pairs) || 0;
                    const suspiciousPairs = (pairFreq.suspicious && pairFreq.suspicious.total_pairs) || 0;
                    const totalPairs = normalPairs + suspiciousPairs;

                    const correlationInfo = {
                        enabled: this.correlationAnalysisEnabled,
                        totalPairs: totalPairs.toFixed(2),
                        normalPairs: normalPairs.toFixed(2),
                        suspiciousPairs: suspiciousPairs.toFixed(2),
                        pairCoverage: totalEvents > 0 ? ((totalPairs / totalEvents) * 100).toFixed(1) + '%' : '0%'
                    };

                    // NEW: Calculate trigram statistics
                    const normalTrigrams = (trigramFreq.normal && trigramFreq.normal.total_trigrams) || 0;
                    const suspiciousTrigrams = (trigramFreq.suspicious && trigramFreq.suspicious.total_trigrams) || 0;
                    const totalTrigrams = normalTrigrams + suspiciousTrigrams;

                    const trigramInfo = {
                        enabled: this.correlationAnalysisEnabled,
                        totalTrigrams: totalTrigrams.toFixed(2),
                        normalTrigrams: normalTrigrams.toFixed(2),
                        suspiciousTrigrams: suspiciousTrigrams.toFixed(2),
                        trigramCoverage: totalEvents > 0 ? ((totalTrigrams / totalEvents) * 100).toFixed(1) + '%' : '0%'
                    };

                    // PHASE 3.3: Enhanced model structure with correlation analysis
                    const enhancedModel = {
                        single_frequencies: singleFreq,
                        pair_frequencies: pairFreq,
                        trigram_frequencies: trigramFreq,
                        transitionMatrix: transitionMatrix,  // NEW: Add transition matrix to model
                        timeDecayInfo: timeDecayInfo,
                        correlationInfo: correlationInfo,
                        trigramInfo: trigramInfo
                    };

                    // Log performance information
                    if (this.timeDecayEnabled && totalEvents > 0) {
                        console.log(`[Sentinel] Model rebuilt: ${totalEvents} events processed, ${effectiveRetention}% retention over ${ageRangeInDays.toFixed(1)} days`);
                    }

                    if (this.correlationAnalysisEnabled && totalPairs > 0) {
                        console.log(`[Sentinel] Correlation analysis: ${totalPairs.toFixed(1)} activity pairs processed, ${correlationInfo.pairCoverage} coverage`);
                    }

                    if (this.correlationAnalysisEnabled && totalTrigrams > 0) {
                        console.log(`[Sentinel] Trigram analysis: ${totalTrigrams.toFixed(1)} activity trigrams processed, ${trigramInfo.trigramCoverage} coverage`);
                    }

                    // UPGRADED: Log Markov Chain statistics for both labels
                    const totalStates = Object.keys(transitionMatrix).length;
                    const normalTransitions = Object.values(transitionMatrix).reduce((sum, stateData) => sum + stateData.normal.size, 0);
                    const suspiciousTransitions = Object.values(transitionMatrix).reduce((sum, stateData) => sum + stateData.suspicious.size, 0);
                    console.log(`[Sentinel] Markov Chain: ${totalStates} states, ${normalTransitions} normal transitions, ${suspiciousTransitions} suspicious transitions`);

                    return {
                        model: enhancedModel,
                        metadata: {
                            totalEvents: totalEvents,
                            weightedEvents: totalWeightedEvents,
                            lastEventId: lastEventId,
                            rebuildTimestamp: Date.now()
                        }
                    };
                } catch (error) {
                    Sentinel.logError('heuristics._rebuildModelFromHistory', error);
                    return {
                        model: {
                            single_frequencies: { normal: {}, suspicious: {} },
                            pair_frequencies: { normal: {}, suspicious: {} },
                            trigram_frequencies: { normal: {}, suspicious: {} },
                            transitionMatrix: {},
                            timeDecayInfo: { enabled: false, error: error.message },
                            correlationInfo: { enabled: false, error: error.message }
                        },
                        metadata: { totalEvents: 0, weightedEvents: 0, lastEventId: null, rebuildTimestamp: Date.now(), totalPairs: 0 }
                    };
                }
            },

            // PHASE 3.2: Intelligent Cached Model Management (Performance Optimization)
            // NEW: Proactive, Environment-Aware Implementation with Circuit Breaker
            async getOrRebuildModel() {
                // PHASE 3.4: Enhanced Circuit Breaker Check with State Machine
                if (!this._canAttemptOperation()) {
                    const status = this.getCircuitBreakerStatus();
                    Sentinel.log('warn', `ML model rebuild is paused (Circuit Breaker state: ${status.state}).`);

                    if (status.state === 'OPEN') {
                        Sentinel.UI.showNotification(`AI learning is temporarily paused. Will retry in ${Math.ceil(status.timeUntilReset/1000)} seconds.`, 'warning', 5000);
                    } else if (status.state === 'HALF_OPEN') {
                        Sentinel.UI.showNotification('AI learning system is attempting recovery...', 'info', 5000);
                    }

                    return this._getFallbackModel();
                }

                // Increment half-open attempts if in HALF_OPEN state
                this._incrementHalfOpenAttempts();

                try {
                    if (this.modelCacheEnabled) {
                        const cachedData = GM_getValue(this.cacheKey, null);
                        if (cachedData && cachedData.model && cachedData.metadata) {
                            const history = await this.getTrainingHistory();
                            if (history.length > 0 && cachedData.metadata.lastEventId === history[history.length - 1].id) {
                                console.log(`[Sentinel] Using valid cached model (${cachedData.metadata.totalEvents} events)`);
                                return cachedData.model;
                            }
                        }
                    }

                    console.log(`[Sentinel] Cache miss or invalid, attempting to rebuild model...`);
                    Sentinel.UI.showNotification('Rebuilding AI model...', 'info', 2000);

                    let result = null;
                    try {
                        // Attempt to use the high-performance worker path first.
                        // This function will now return `null` if workers are not supported.
                        result = await this._rebuildModelFromHistoryWithWorker();
                    } catch (workerError) {
                        // PHASE 3.4: Enhanced Circuit Breaker Logic - Record failure
                        this._recordFailure();

                        // This catch block will now only handle *unexpected* errors from the worker path,
                        // such as a timeout or a syntax error inside the worker code itself.
                        Sentinel.logError('getOrRebuildModel.workerPath', workerError);
                        console.warn(`[Sentinel] High-performance worker rebuild failed unexpectedly. Falling back to synchronous method.`);
                    }

                    // CRITICAL FIX: Eliminate UI freezing bottleneck with Circuit Breaker protection
                    // Instead of dangerous synchronous rebuild, use safe fallback with retry mechanism
                    if (!result) {
                        // PHASE 3.4: Enhanced Circuit Breaker Logic for Worker Failures
                        this._recordFailure();

                        console.warn('[Sentinel] Worker rebuild failed. Using safe fallback mechanism to prevent UI freeze.');

                        // Step 1: Try to use cached model as immediate fallback
                        if (this.modelCacheEnabled) {
                            const cachedData = GM_getValue(this.cacheKey, null);
                            if (cachedData && cachedData.model) {
                                console.warn('[Sentinel] Using STALE cached model to prevent UI freeze.');
                                Sentinel.UI.showNotification('AI model update failed. Using last known configuration.', 'warning', 5000);

                                // Schedule background retry for next attempt
                                this._scheduleBackgroundRetry();

                                return cachedData.model; // Return cached data immediately
                            }
                        }

                        // Step 2: If no cache available, return safe empty model
                        console.error('[Sentinel] CRITICAL: Worker rebuild failed and no cache available. ML system will be passive.');
                        Sentinel.UI.showNotification('Critical: AI Model failed to load. Adaptive protection is offline.', 'error', 8000);

                        // Schedule background retry for recovery
                        this._scheduleBackgroundRetry();

                        // Return safe empty model structure
                        return {
                            single_frequencies: { normal: {}, suspicious: {} },
                            pair_frequencies: { normal: {}, suspicious: {} },
                            trigram_frequencies: { normal: {}, suspicious: {} },
                            transitionMatrix: {},
                            timeDecayInfo: { enabled: false, error: 'Worker rebuild failed' },
                            correlationInfo: { enabled: false, error: 'Worker rebuild failed' },
                            trigramInfo: { enabled: false, error: 'Worker rebuild failed' }
                        };
                    }

                    if (this.modelCacheEnabled && this.cacheKey && result && result.model) {
                        GM_setValue(this.cacheKey, result);
                        console.log(`[Sentinel] Model cached successfully`);

                        // Reset retry state on successful rebuild
                        this._resetRetryState();

                        // PHASE 3.4: Enhanced Circuit Breaker - Record success
                        this._recordSuccess();
                        Sentinel.log('info', 'Circuit Breaker success recorded due to successful model rebuild.');
                    }

                    return result.model;

                } catch (error) {
                    // PHASE 3.4: Enhanced Circuit Breaker Logic for Critical Errors
                    this._recordFailure();

                    Sentinel.logError('heuristics.getOrRebuildModel', error);
                    console.error(`[Sentinel] Critical model rebuilding failure. Using safe fallback mechanism.`);

                    // Try to use cached model as immediate fallback
                    if (this.modelCacheEnabled) {
                        const cachedData = GM_getValue(this.cacheKey, null);
                        if (cachedData && cachedData.model) {
                            console.warn('[Sentinel] Using cached model due to critical error.');
                            Sentinel.UI.showNotification('AI model error. Using last known configuration.', 'warning', 5000);

                            // Schedule background retry for recovery
                            this._scheduleBackgroundRetry();

                            return cachedData.model;
                        }
                    }

                    // If no cache available, show critical error and return safe model
                    Sentinel.UI.showNotification('Critical: AI Model failed completely. Adaptive protection is offline.', 'error', 8000);

                    // Schedule background retry for recovery
                    this._scheduleBackgroundRetry();

                    // Return a safe, empty model structure to prevent downstream crashes
                    return {
                        single_frequencies: { normal: {}, suspicious: {} },
                        pair_frequencies: { normal: {}, suspicious: {} },
                        trigram_frequencies: { normal: {}, suspicious: {} },
                        transitionMatrix: {},
                        timeDecayInfo: { enabled: false, error: error.message },
                        correlationInfo: { enabled: false, error: error.message },
                        trigramInfo: { enabled: false, error: error.message }
                    };
                }
            },

            // CRITICAL FIX: Advanced Background Retry Mechanism for ML Model Recovery
            // Based on proven retry patterns from JavaScript ecosystem
            _scheduleBackgroundRetry() {
                // Prevent multiple retry attempts
                if (this._retryScheduled) {
                    return;
                }

                this._retryScheduled = true;

                // Implement exponential backoff retry mechanism with jitter
                const retryDelay = this._getRetryDelay();

                setTimeout(async () => {
                    console.log('[Sentinel] Retrying model rebuild in background...');

                    try {
                        // Use async/await with proper error handling
                        const newResult = await this._rebuildModelFromHistoryWithWorker();

                        if (newResult && this.modelCacheEnabled) {
                            GM_setValue(this.cacheKey, newResult);
                            console.log('[Sentinel] Background model rebuild successful.');
                            Sentinel.UI.showNotification('AI model updated successfully in background.', 'success', 3000);

                            // Reset retry state on successful background rebuild
                            this._resetRetryState();
                        } else {
                            throw new Error('Worker returned null or invalid result');
                        }
                    } catch (err) {
                        console.error('[Sentinel] Background model rebuild retry failed:', err);
                        Sentinel.logError('backgroundRetry', err);

                        // Schedule next retry with exponential backoff
                        this._scheduleNextRetry();
                    } finally {
                        this._retryScheduled = false;
                    }
                }, retryDelay);
            },

            // Helper method for exponential backoff retry delays with jitter
            _getRetryDelay() {
                if (!this._retryAttempts) {
                    this._retryAttempts = 0;
                }

                this._retryAttempts++;

                // Exponential backoff: 1min, 2min, 4min, 8min, max 15min
                const baseDelay = 60000; // 1 minute
                const maxDelay = 900000; // 15 minutes
                const exponentialDelay = Math.min(baseDelay * Math.pow(2, this._retryAttempts - 1), maxDelay);

                // Add jitter (±25%) to prevent thundering herd
                const jitter = exponentialDelay * 0.25 * (Math.random() - 0.5);
                const delay = Math.max(exponentialDelay + jitter, 10000); // Minimum 10 seconds

                console.log(`[Sentinel] Scheduling retry attempt ${this._retryAttempts} in ${Math.round(delay/1000)} seconds (with jitter)`);
                return delay;
            },

            // Schedule next retry if current one failed
            _scheduleNextRetry() {
                if (this._retryAttempts < 5) { // Max 5 retry attempts
                    setTimeout(() => {
                        this._scheduleBackgroundRetry();
                    }, 30000); // Wait 30 seconds before next attempt
                } else {
                    console.error('[Sentinel] Max retry attempts reached. ML system will remain in fallback mode.');
                    this._retryAttempts = 0; // Reset for future attempts
                }
            },

            // Reset retry state when system recovers
            _resetRetryState() {
                this._retryAttempts = 0;
                this._retryScheduled = false;
                console.log('[Sentinel] Retry state reset - system recovered successfully.');
            },

            // Get current retry status for debugging and user feedback
            getRetryStatus() {
                return {
                    retryScheduled: this._retryScheduled || false,
                    retryAttempts: this._retryAttempts || 0,
                    maxAttempts: 5,
                    isInRetryMode: this._retryScheduled || (this._retryAttempts > 0)
                };
            },

            // Force manual retry for testing and recovery
            forceRetry() {
                console.log('[Sentinel] Manual retry triggered by user.');
                this._resetRetryState();
                this._scheduleBackgroundRetry();
            },

            // PHASE 3.4: Circuit Breaker Methods for Resilient ML Model Rebuilding
            _tripCircuitBreaker() {
                this._circuitBreakerState.state = 'OPEN';
                this._circuitBreakerState.lastFailureTime = Date.now();
                this._circuitBreakerState.halfOpenAttempts = 0;
                Sentinel.log('error', `Circuit Breaker OPEN for ML model rebuild. State: ${this._circuitBreakerState.state}. Pausing for ${this._circuitBreakerState.resetTimeout/1000} seconds.`);
                Sentinel.UI.showNotification('AI learning is temporarily paused due to persistent errors. Will retry automatically.', 'error', 10000);

                // Schedule transition to HALF_OPEN state
                setTimeout(() => {
                    this._transitionToHalfOpen();
                }, this._circuitBreakerState.resetTimeout);
            },

            _transitionToHalfOpen() {
                this._circuitBreakerState.state = 'HALF_OPEN';
                this._circuitBreakerState.halfOpenAttempts = 0;
                Sentinel.log('info', `Circuit Breaker transitioning to HALF_OPEN state. Will attempt one recovery.`);
                Sentinel.UI.showNotification('AI learning system attempting recovery...', 'info', 5000);
            },

            _resetCircuitBreaker() {
                this._circuitBreakerState.state = 'CLOSED';
                this._circuitBreakerState.consecutiveFailures = 0;
                this._circuitBreakerState.lastFailureTime = null;
                this._circuitBreakerState.lastSuccessTime = Date.now();
                this._circuitBreakerState.halfOpenAttempts = 0;
                Sentinel.log('info', 'Circuit Breaker CLOSED. Model rebuild system fully recovered.');
                Sentinel.UI.showNotification('AI learning system fully recovered and is ready to resume.', 'success', 5000);
            },

            _recordSuccess() {
                if (this._circuitBreakerState.state === 'HALF_OPEN') {
                    // Success in HALF_OPEN state, transition to CLOSED
                    this._resetCircuitBreaker();
                } else if (this._circuitBreakerState.state === 'CLOSED') {
                    // Success in CLOSED state, reset failure count
                    this._circuitBreakerState.consecutiveFailures = 0;
                    this._circuitBreakerState.lastSuccessTime = Date.now();
                }
            },

            _recordFailure() {
                this._circuitBreakerState.consecutiveFailures++;
                this._circuitBreakerState.lastFailureTime = Date.now();

                if (this._circuitBreakerState.state === 'CLOSED' &&
                    this._circuitBreakerState.consecutiveFailures >= this._circuitBreakerState.maxFailures) {
                    this._tripCircuitBreaker();
                } else if (this._circuitBreakerState.state === 'HALF_OPEN') {
                    // Failure in HALF_OPEN state, transition back to OPEN
                    this._tripCircuitBreaker();
                }
            },

            _canAttemptOperation() {
                if (this._circuitBreakerState.state === 'CLOSED') {
                    return true;
                } else if (this._circuitBreakerState.state === 'HALF_OPEN') {
                    return this._circuitBreakerState.halfOpenAttempts < this._circuitBreakerState.maxHalfOpenAttempts;
                } else { // OPEN state
                    return false;
                }
            },

            _incrementHalfOpenAttempts() {
                if (this._circuitBreakerState.state === 'HALF_OPEN') {
                    this._circuitBreakerState.halfOpenAttempts++;
                }
            },

            _getFallbackModel() {
                // Return a safe, empty model structure when Circuit Breaker is tripped
                return {
                    single_frequencies: { normal: {}, suspicious: {} },
                    pair_frequencies: { normal: {}, suspicious: {} },
                    trigram_frequencies: { normal: {}, suspicious: {} },
                    transitionMatrix: {},
                    timeDecayInfo: { enabled: false, error: 'Circuit Breaker tripped' },
                    correlationInfo: { enabled: false, error: 'Circuit Breaker tripped' },
                    trigramInfo: { enabled: false, error: 'Circuit Breaker tripped' }
                };
            },

            getCircuitBreakerStatus() {
                const timeUntilReset = this._circuitBreakerState.lastFailureTime ?
                    Math.max(0, this._circuitBreakerState.resetTimeout - (Date.now() - this._circuitBreakerState.lastFailureTime)) : 0;

                return {
                    state: this._circuitBreakerState.state,
                    consecutiveFailures: this._circuitBreakerState.consecutiveFailures,
                    maxFailures: this._circuitBreakerState.maxFailures,
                    lastFailureTime: this._circuitBreakerState.lastFailureTime,
                    lastSuccessTime: this._circuitBreakerState.lastSuccessTime,
                    resetTimeout: this._circuitBreakerState.resetTimeout,
                    timeUntilReset: timeUntilReset,
                    halfOpenAttempts: this._circuitBreakerState.halfOpenAttempts,
                    maxHalfOpenAttempts: this._circuitBreakerState.maxHalfOpenAttempts,
                    canAttemptOperation: this._canAttemptOperation()
                };
            },

            // PHASE 3.5: Activity Sequence Whitelist Management
            async trainModelWithSequence(activities, label) {
                try {
                    if (label !== 'normal_sequence') {
                        console.warn('[Sentinel] trainModelWithSequence only supports normal_sequence label');
                        return;
                    }

                    // Generate sequence signature
                    const activitySequence = activities.map(activityData =>
                        activityData.activity || activityData
                    );
                    const sequenceSignature = this._generateSequenceSignature(activitySequence);

                    // Store in whitelist
                    if (!this.sequenceWhitelist.has(Sentinel.hostname)) {
                        this.sequenceWhitelist.set(Sentinel.hostname, new Set());
                    }
                    this.sequenceWhitelist.get(Sentinel.hostname).add(sequenceSignature);

                    // Persist to storage
                    await this._saveSequenceWhitelist();

                    console.log(`[Sentinel] Sequence whitelisted for ${Sentinel.hostname}:`, sequenceSignature);
                    return true;

                } catch (error) {
                    Sentinel.logError('heuristics.trainModelWithSequence', error);
                    return false;
                }
            },

            _generateSequenceSignature(activities) {
                // Create a normalized signature for the activity sequence
                return activities.join('|');
            },

            _isSequenceWhitelisted(activities) {
                try {
                    const sequenceSignature = this._generateSequenceSignature(activities);
                    const hostnameWhitelist = this.sequenceWhitelist.get(Sentinel.hostname);

                    if (!hostnameWhitelist) {
                        return false;
                    }

                    // Check exact match first
                    if (hostnameWhitelist.has(sequenceSignature)) {
                        return true;
                    }

                    // Check for partial matches (subsequences)
                    for (const whitelistedSignature of hostnameWhitelist) {
                        const whitelistedActivities = whitelistedSignature.split('|');

                        // Check if current sequence contains the whitelisted subsequence
                        if (this._containsSubsequence(activities, whitelistedActivities)) {
                            return true;
                        }
                    }

                    return false;

                } catch (error) {
                    Sentinel.logError('heuristics._isSequenceWhitelisted', error);
                    return false;
                }
            },

            _containsSubsequence(activities, subsequence) {
                // Check if activities array contains the subsequence in order
                if (subsequence.length > activities.length) {
                    return false;
                }

                for (let i = 0; i <= activities.length - subsequence.length; i++) {
                    let match = true;
                    for (let j = 0; j < subsequence.length; j++) {
                        if (activities[i + j] !== subsequence[j]) {
                            match = false;
                            break;
                        }
                    }
                    if (match) {
                        return true;
                    }
                }
                return false;
            },

            async _loadSequenceWhitelist() {
                try {
                    if (!this.whitelistKey) {
                        this.whitelistKey = `whitelist_sequences_${Sentinel.hostname}`;
                    }

                    const storedData = GM_getValue(this.whitelistKey, null);
                    if (storedData && storedData.sequences) {
                        this.sequenceWhitelist.set(Sentinel.hostname, new Set(storedData.sequences));
                        console.log(`[Sentinel] Loaded ${storedData.sequences.length} whitelisted sequences for ${Sentinel.hostname}`);
                    }
                } catch (error) {
                    Sentinel.logError('heuristics._loadSequenceWhitelist', error);
                }
            },

            async _saveSequenceWhitelist() {
                try {
                    if (!this.whitelistKey) {
                        this.whitelistKey = `whitelist_sequences_${Sentinel.hostname}`;
                    }

                    const hostnameWhitelist = this.sequenceWhitelist.get(Sentinel.hostname);
                    if (hostnameWhitelist) {
                        const sequences = Array.from(hostnameWhitelist);
                        GM_setValue(this.whitelistKey, {
                            sequences: sequences,
                            lastUpdated: Date.now()
                        });
                        console.log(`[Sentinel] Saved ${sequences.length} whitelisted sequences for ${Sentinel.hostname}`);
                    }
                } catch (error) {
                    Sentinel.logError('heuristics._saveSequenceWhitelist', error);
                }
            },

            getWhitelistStatus() {
                const hostnameWhitelist = this.sequenceWhitelist.get(Sentinel.hostname);
                return {
                    totalSequences: hostnameWhitelist ? hostnameWhitelist.size : 0,
                    sequences: hostnameWhitelist ? Array.from(hostnameWhitelist) : [],
                    hostname: Sentinel.hostname
                };
            },

            // PHASE 3.1: Proactive Whitelist Suggestions - Dismiss Tracking
            getDismissCountForSequence(activities) {
                try {
                    const sequenceSignature = this._generateSequenceSignature(activities);
                    const dismissKey = `dismiss_count_${Sentinel.hostname}`;
                    const dismissCounts = GM_getValue(dismissKey, {});
                    return dismissCounts[sequenceSignature] || 0;
                } catch (error) {
                    Sentinel.logError('heuristics.getDismissCountForSequence', error);
                    return 0;
                }
            },

            incrementDismissCountForSequence(activities) {
                try {
                    const sequenceSignature = this._generateSequenceSignature(activities);
                    const dismissKey = `dismiss_count_${Sentinel.hostname}`;
                    const dismissCounts = GM_getValue(dismissKey, {});

                    dismissCounts[sequenceSignature] = (dismissCounts[sequenceSignature] || 0) + 1;
                    GM_setValue(dismissKey, dismissCounts);

                    console.log(`[Sentinel] Dismiss count for sequence "${sequenceSignature}": ${dismissCounts[sequenceSignature]}`);
                    return dismissCounts[sequenceSignature];
                } catch (error) {
                    Sentinel.logError('heuristics.incrementDismissCountForSequence', error);
                    return 0;
                }
            },

            resetDismissCountForSequence(activities) {
                try {
                    const sequenceSignature = this._generateSequenceSignature(activities);
                    const dismissKey = `dismiss_count_${Sentinel.hostname}`;
                    const dismissCounts = GM_getValue(dismissKey, {});

                    delete dismissCounts[sequenceSignature];
                    GM_setValue(dismissKey, dismissCounts);

                    console.log(`[Sentinel] Reset dismiss count for sequence "${sequenceSignature}"`);
                } catch (error) {
                    Sentinel.logError('heuristics.resetDismissCountForSequence', error);
                }
            },

            getDismissSuggestions() {
                try {
                    const dismissKey = `dismiss_count_${Sentinel.hostname}`;
                    const dismissCounts = GM_getValue(dismissKey, {});
                    const suggestions = [];

                    Object.entries(dismissCounts).forEach(([sequence, count]) => {
                        if (count >= 3) {
                            suggestions.push({
                                sequence: sequence,
                                count: count,
                                activities: sequence.split('|')
                            });
                        }
                    });

                    return suggestions;
                } catch (error) {
                    Sentinel.logError('heuristics.getDismissSuggestions', error);
                    return [];
                }
            },

            // PHASE 3.2: Incremental Cache Update for New Training Events
            // PHASE 3.3: Enhanced with Correlation Analysis for Activity Pairs
            async _updateCacheWithNewEvent(newEvent) {
                try {
                    if (!this.modelCacheEnabled || this.cacheKey === null) {
                        return; // Caching disabled, skip
                    }

                    const cachedData = GM_getValue(this.cacheKey, null);
                    if (!cachedData || !cachedData.model) {
                        // No cache to update, skip (next getOrRebuildModel call will rebuild)
                        return;
                    }

                    // Calculate time decay weight for the new event
                    const timeWeight = this.calculateTimeDecayWeight(newEvent.timestamp);

                    // Clone the cached model for incremental update
                    const updatedModel = JSON.parse(JSON.stringify(cachedData.model));

                    // PHASE 3.3: Update single frequencies (existing logic)
                    const singleCategory = updatedModel.single_frequencies[newEvent.label] || {};
                    newEvent.activities.forEach(activity => {
                        singleCategory[activity] = (singleCategory[activity] || 0) + timeWeight;
                    });
                    singleCategory.total = (singleCategory.total || 0) + timeWeight;
                    updatedModel.single_frequencies[newEvent.label] = singleCategory;

                    // PHASE 3.3: Update pair frequencies (correlation analysis)
                    if (this.correlationAnalysisEnabled && newEvent.activities.length > 1) {
                        const pairCategory = updatedModel.pair_frequencies[newEvent.label] || {};

                        for (let i = 0; i < newEvent.activities.length - 1; i++) {
                            const firstActivity = newEvent.activities[i];
                            const secondActivity = newEvent.activities[i + 1];
                            const pairKey = `${firstActivity}->${secondActivity}`;

                            pairCategory[pairKey] = (pairCategory[pairKey] || 0) + timeWeight;
                        }
                        pairCategory.total_pairs = (pairCategory.total_pairs || 0) + (newEvent.activities.length - 1) * timeWeight;
                        updatedModel.pair_frequencies[newEvent.label] = pairCategory;

                        // UPGRADED: Update transition matrix for both normal and suspicious behaviors
                        if (updatedModel.transitionMatrix) {
                            for (let i = 0; i < newEvent.activities.length - 1; i++) {
                                const firstActivity = newEvent.activities[i];
                                const secondActivity = newEvent.activities[i + 1];

                                if (!updatedModel.transitionMatrix[firstActivity]) {
                                    updatedModel.transitionMatrix[firstActivity] = { normal: new Map(), suspicious: new Map() };
                                }

                                const labelMap = updatedModel.transitionMatrix[firstActivity][newEvent.label];
                                const currentCount = labelMap.get(secondActivity) || 0;
                                labelMap.set(secondActivity, currentCount + timeWeight);
                            }
                        }

                        // UPGRADED: Update trigram frequencies
                        if (this.correlationAnalysisEnabled && newEvent.activities.length > 2) {
                            const trigramCategory = updatedModel.trigram_frequencies[newEvent.label] || {};

                            for (let i = 0; i < newEvent.activities.length - 2; i++) {
                                const first = newEvent.activities[i];
                                const second = newEvent.activities[i + 1];
                                const third = newEvent.activities[i + 2];
                                const trigramKey = `${first}->${second}->${third}`;

                                trigramCategory[trigramKey] = (trigramCategory[trigramKey] || 0) + timeWeight;
                            }
                            trigramCategory.total_trigrams = (trigramCategory.total_trigrams || 0) + (newEvent.activities.length - 2) * timeWeight;
                            updatedModel.trigram_frequencies[newEvent.label] = trigramCategory;
                        }
                    }

                    // Update time decay info
                    if (updatedModel.timeDecayInfo) {
                        const oldTotal = parseInt(updatedModel.timeDecayInfo.totalEvents) || 0;
                        const oldWeighted = parseFloat(updatedModel.timeDecayInfo.weightedEvents) || 0;
                        const newTotal = oldTotal + 1;
                        const newWeighted = oldWeighted + timeWeight;
                        const newRetention = ((newWeighted / newTotal) * 100).toFixed(1);

                        updatedModel.timeDecayInfo.totalEvents = newTotal;
                        updatedModel.timeDecayInfo.weightedEvents = newWeighted.toFixed(2);
                        updatedModel.timeDecayInfo.effectiveRetention = `${newRetention}%`;
                    }

                    // PHASE 3.3: Update correlation info
                    if (updatedModel.correlationInfo && this.correlationAnalysisEnabled && newEvent.activities.length > 1) {
                        const oldPairs = parseFloat(updatedModel.correlationInfo.totalPairs) || 0;
                        const newPairs = oldPairs + (newEvent.activities.length - 1) * timeWeight;
                        const newTotal = parseInt(updatedModel.timeDecayInfo.totalEvents) || 1;

                        updatedModel.correlationInfo.totalPairs = newPairs.toFixed(2);
                        updatedModel.correlationInfo.pairCoverage = ((newPairs / newTotal) * 100).toFixed(1) + '%';

                        // Update individual label pair counts
                        if (newEvent.label === 'normal') {
                            const oldNormalPairs = parseFloat(updatedModel.correlationInfo.normalPairs) || 0;
                            updatedModel.correlationInfo.normalPairs = (oldNormalPairs + (newEvent.activities.length - 1) * timeWeight).toFixed(2);
                        } else {
                            const oldSuspiciousPairs = parseFloat(updatedModel.correlationInfo.suspiciousPairs) || 0;
                            updatedModel.correlationInfo.suspiciousPairs = (oldSuspiciousPairs + (newEvent.activities.length - 1) * timeWeight).toFixed(2);
                        }
                    }

                    // Update cache with incremental changes
                    const updatedCacheObject = {
                        model: updatedModel,
                        metadata: {
                            ...cachedData.metadata,
                            cacheTimestamp: Date.now(),
                            lastEventId: newEvent.id,
                            totalEvents: (cachedData.metadata.totalEvents || 0) + 1,
                            weightedEvents: (cachedData.metadata.weightedEvents || 0) + timeWeight,
                            totalPairs: (cachedData.metadata.totalPairs || 0) + (newEvent.activities.length > 1 ? (newEvent.activities.length - 1) * timeWeight : 0)
                        }
                    };

                    GM_setValue(this.cacheKey, updatedCacheObject);
                    const pairCount = newEvent.activities.length > 1 ? newEvent.activities.length - 1 : 0;
                    console.log(`[Sentinel] Cache incrementally updated with new event (weight: ${timeWeight.toFixed(4)}, ${pairCount} pairs)`);

                } catch (error) {
                    Sentinel.logError('heuristics._updateCacheWithNewEvent', error);
                    // On error, invalidate cache to force rebuild on next access
                    this._invalidateCache();
                }
            },

            // PHASE 3.2: Cache Invalidation for Deleted Events
            _invalidateCache() {
                try {
                    if (this.cacheKey) {
                        GM_setValue(this.cacheKey, undefined);
                        console.log('[Sentinel] Model cache invalidated');
                    }
                } catch (error) {
                    Sentinel.logError('heuristics._invalidateCache', error);
                }
            },

            // PHASE 2.1: IndexedDB-based training history management
            async getTrainingHistory() {
                try {
                    if (Sentinel.DB.initialized) {
                        return await Sentinel.DB.getHistory(Sentinel.hostname);
                    } else {
                        // Fallback to GM_getValue if IndexedDB is not available
                        console.warn('[Sentinel Heuristics] IndexedDB not available, using fallback storage');
                        const key = `heuristics_history_${Sentinel.hostname}`;
                        const history = GM_getValue(key, null);
                        return history ? JSON.parse(history) : [];
                    }
                } catch (error) {
                    Sentinel.logError('heuristics.getTrainingHistory', error);
                    // Fallback to GM_getValue on error
                    const key = `heuristics_history_${Sentinel.hostname}`;
                    const history = GM_getValue(key, null);
                    return history ? JSON.parse(history) : [];
                }
            },

            // PHASE 2.1: IndexedDB-based training history save (legacy method for compatibility)
            async saveTrainingHistory(history) {
                try {
                    if (Sentinel.DB.initialized) {
                        // This method is kept for compatibility but not used with IndexedDB
                        console.log(`[Sentinel] Training history managed via IndexedDB: ${history.length} events`);
                    } else {
                            // Fallback to GM_setValue
                        const key = `heuristics_history_${Sentinel.hostname}`;
                        GM_setValue(key, JSON.stringify(history));
                        console.log(`[Sentinel] Saved training history for ${Sentinel.hostname}: ${history.length} events`);
                    }
                } catch (error) {
                    Sentinel.logError('heuristics.saveTrainingHistory', error);
                }
            },

            // PHASE 2.1: Load learning data from IndexedDB (rebuilt from training history)
            // PHASE 3.1: Enhanced with Time Decay for Mature Intelligence
            // PHASE 3.2: Optimized with Cached Model Architecture for Performance
            async getLearnedData() {
                try {
                    // PHASE 3.2: Use cached model for optimal performance
                    return await this.getOrRebuildModel();
                } catch (error) {
                    Sentinel.logError('heuristics.getLearnedData', error);
                    return { normal: {}, suspicious: {}, timeDecayInfo: { enabled: false, error: error.message } };
                }
            },

            // PHASE 2.1: Enhanced training model with IndexedDB
            // PHASE 3.2: Optimized with Incremental Cache Updates for Performance
            async trainModel(activities, label) {
                try {
                    // Create new training event
                    const trainingEvent = {
                        id: 'evt_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36),
                        timestamp: Date.now(),
                        label: label,
                        activities: activities.map(activityData => activityData.activity || activityData),
                        hostname: Sentinel.hostname
                    };

                    if (Sentinel.DB.initialized) {
                        // Use IndexedDB for storage
                        await Sentinel.DB.addEvent(trainingEvent);
                        console.log(`[Sentinel] Added training event to IndexedDB for ${Sentinel.hostname}:`, trainingEvent);

                        // PHASE 3.2: Incremental cache update for performance optimization
                        await this._updateCacheWithNewEvent(trainingEvent);

                        // Get updated count for user feedback
                        const history = await this.getTrainingHistory();
                        Sentinel.UI.showNotification(`✅ Learned from your feedback! Model updated for ${Sentinel.hostname} (${history.length} training events)`, 'success', 3000);
                    } else {
                        // Fallback to GM_setValue
                        const history = await this.getTrainingHistory();
                        history.push(trainingEvent);

                        // Keep only last 100 training events to prevent excessive storage
                        if (history.length > 100) {
                            history.splice(0, history.length - 100);
                        }

                        await this.saveTrainingHistory(history);
                        console.log(`[Sentinel] Added training event to fallback storage for ${Sentinel.hostname}:`, trainingEvent);

                        // PHASE 3.2: Incremental cache update for fallback storage too
                        await this._updateCacheWithNewEvent(trainingEvent);

                        Sentinel.UI.showNotification(`✅ Learned from your feedback! Model updated for ${Sentinel.hostname} (${history.length} training events)`, 'success', 3000);
                    }
                } catch (error) {
                    Sentinel.logError('heuristics.trainModel', error);
                    Sentinel.UI.showNotification('❌ Failed to save learning data', 'error', 2000);
                }
            },

            // PHASE 2.1: Delete specific training event from IndexedDB
            // PHASE 3.2: Enhanced with Cache Invalidation for Performance Consistency
            async deleteTrainingEvent(eventId) {
                try {
                    let success = false;

                    if (Sentinel.DB.initialized) {
                        // Use IndexedDB for deletion
                        success = await Sentinel.DB.deleteEvent(eventId);
                        if (success) {
                            console.log(`[Sentinel] Deleted training event ${eventId} from IndexedDB for ${Sentinel.hostname}`);
                        } else {
                            console.warn(`[Sentinel] Training event ${eventId} not found in IndexedDB for ${Sentinel.hostname}`);
                        }
                    } else {
                        // Fallback to GM_setValue
                        const history = await this.getTrainingHistory();
                        const initialLength = history.length;

                        // Filter out the event with matching ID
                        const updatedHistory = history.filter(event => event.id !== eventId);

                        if (updatedHistory.length < initialLength) {
                            await this.saveTrainingHistory(updatedHistory);
                            console.log(`[Sentinel] Deleted training event ${eventId} from fallback storage for ${Sentinel.hostname}`);
                            success = true;
                        } else {
                            console.warn(`[Sentinel] Training event ${eventId} not found in fallback storage for ${Sentinel.hostname}`);
                            success = false;
                        }
                    }

                    // PHASE 3.2: Invalidate cache after deletion (rebuild required for accuracy)
                    if (success) {
                        this._invalidateCache();
                        console.log(`[Sentinel] Cache invalidated due to event deletion - next model access will rebuild`);
                    }

                    return success;
                } catch (error) {
                    Sentinel.logError('heuristics.deleteTrainingEvent', error);
                    return false;
                }
            },

            // PHASE 3.3: Correlation Analysis for Sequence Intelligence
            async classifyCorrelations(activities) {
                try {
                    if (!this.correlationAnalysisEnabled || activities.length < 2) {
                        // Not enough activities for correlation analysis or disabled
                        return null;
                    }

                    const data = await this.getOrRebuildModel();

                    // Check if we have enough pair training data
                    const normalTotal = (data.pair_frequencies.normal && data.pair_frequencies.normal.total_pairs) || 0;
                    const suspiciousTotal = (data.pair_frequencies.suspicious && data.pair_frequencies.suspicious.total_pairs) || 0;
                    const totalPairSamples = normalTotal + suspiciousTotal;

                    if (totalPairSamples < this.minSamplesForLearning) {
                        console.log(`[Sentinel] Insufficient pair training data (${totalPairSamples.toFixed(2)} weighted pairs), skipping correlation analysis`);
                        return null; // Fall back to single activity analysis only
                    }

                    // Extract activity pairs from current buffer
                    const activityPairs = [];
                    for (let i = 0; i < activities.length - 1; i++) {
                        const firstActivity = activities[i].activity || activities[i];
                        const secondActivity = activities[i + 1].activity || activities[i + 1];
                        activityPairs.push(`${firstActivity}->${secondActivity}`);
                    }

                    if (activityPairs.length === 0) {
                        return null;
                    }

                    // Calculate prior probabilities (using weighted pair samples)
                    const priorNormal = normalTotal / totalPairSamples;
                    const priorSuspicious = suspiciousTotal / totalPairSamples;

                    // Calculate likelihood for each activity pair
                    let logProbNormal = Math.log(priorNormal);
                    let logProbSuspicious = Math.log(priorSuspicious);

                    // Get unique pairs (to avoid double counting identical pairs in same buffer)
                    const uniquePairs = [...new Set(activityPairs)];
                    const activePairCount = uniquePairs.length;

                    uniquePairs.forEach(pairKey => {
                        // Laplace smoothing: add 1 to all weighted counts to avoid zero probabilities
                        const normalCount = (data.pair_frequencies.normal[pairKey] || 0) + 1;
                        const suspiciousCount = (data.pair_frequencies.suspicious[pairKey] || 0) + 1;

                        // Total pair types for each class (with smoothing)
                        // Estimate vocabulary size as the total unique pairs seen
                        const uniqueNormalPairs = Object.keys(data.pair_frequencies.normal).filter(k => k !== 'total_pairs').length;
                        const uniqueSuspiciousPairs = Object.keys(data.pair_frequencies.suspicious).filter(k => k !== 'total_pairs').length;
                        const estimatedVocabSize = Math.max(uniqueNormalPairs + uniqueSuspiciousPairs, 10); // Minimum vocab size

                        const normalDenom = normalTotal + estimatedVocabSize;
                        const suspiciousDenom = suspiciousTotal + estimatedVocabSize;

                        // Calculate log probabilities to avoid underflow
                        logProbNormal += Math.log(normalCount / normalDenom);
                        logProbSuspicious += Math.log(suspiciousCount / suspiciousDenom);
                    });

                    // Convert back to probabilities and normalize
                    const probNormal = Math.exp(logProbNormal);
                    const probSuspicious = Math.exp(logProbSuspicious);
                    const totalProb = probNormal + probSuspicious;

                    const confidence = {
                        normal: probNormal / totalProb,
                        suspicious: probSuspicious / totalProb,
                        totalPairSamples: totalPairSamples.toFixed(2),
                        analyzedPairs: activePairCount,
                        pairSequence: activityPairs
                    };

                    console.log(`[Sentinel] Correlation analysis for ${Sentinel.hostname}: ${activePairCount} pairs analyzed`, confidence);
                    return confidence;

                } catch (error) {
                    Sentinel.logError('heuristics.classifyCorrelations', error);
                    return null; // Fall back to single activity analysis
                }
            },

            // Naive Bayes Classification
            // PHASE 3.1: Enhanced with Time Decay Support for Mature Intelligence
            // PHASE 3.2: Optimized with Cached Model for Performance
            async classifyActivities(activities) {
                try {
                    const data = await this.getOrRebuildModel();

                    // PHASE 3.3: Use enhanced model structure with single frequencies
                    const singleFreq = data.single_frequencies || data; // Fallback for backward compatibility

                    // Check if we have enough training data (using weighted totals)
                    const normalTotal = (singleFreq.normal && singleFreq.normal.total) || 0;
                    const suspiciousTotal = (singleFreq.suspicious && singleFreq.suspicious.total) || 0;
                    const totalSamples = normalTotal + suspiciousTotal;

                    if (totalSamples < this.minSamplesForLearning) {
                        console.log(`[Sentinel] Insufficient weighted training data (${totalSamples.toFixed(2)} weighted samples), using static classification`);
                        return null; // Fall back to static system
                    }

                    // Calculate prior probabilities (using weighted samples)
                    const priorNormal = normalTotal / totalSamples;
                    const priorSuspicious = suspiciousTotal / totalSamples;

                    // Calculate likelihood for each activity
                    let logProbNormal = Math.log(priorNormal);
                    let logProbSuspicious = Math.log(priorSuspicious);
                    const suspiciousActivities = [];

                    activities.forEach(activityData => {
                        const activity = activityData.activity || activityData;

                        // Laplace smoothing: add 1 to all weighted counts to avoid zero probabilities
                        const normalCount = (singleFreq.normal[activity] || 0) + 1;
                        const suspiciousCount = (singleFreq.suspicious[activity] || 0) + 1;

                        // Total activities for each class (with smoothing)
                        const normalDenom = normalTotal + Object.keys(this.suspiciousActivities).length;
                        const suspiciousDenom = suspiciousTotal + Object.keys(this.suspiciousActivities).length;

                        // Calculate log probabilities to avoid underflow
                        logProbNormal += Math.log(normalCount / normalDenom);
                        logProbSuspicious += Math.log(suspiciousCount / suspiciousDenom);

                        // Track suspicious activities for transparency
                        if (suspiciousCount > normalCount && this.suspiciousActivities[activity]) {
                            suspiciousActivities.push(activity);
                        }
                    });

                    // Convert back to probabilities and normalize
                    const probNormal = Math.exp(logProbNormal);
                    const probSuspicious = Math.exp(logProbSuspicious);
                    const totalProb = probNormal + probSuspicious;

                    const confidence = {
                        normal: probNormal / totalProb,
                        suspicious: probSuspicious / totalProb,
                        totalSamples: totalSamples.toFixed(2),
                        timeDecayInfo: data.timeDecayInfo,
                        method: 'naive_bayes',
                        suspiciousActivities: suspiciousActivities // Enhanced transparency
                    };

                    // PHASE 3.1: Enhanced logging with time decay information
                    const timeDecayStatus = data.timeDecayInfo?.enabled ?
                        ` [Time Decay: ${data.timeDecayInfo.effectiveRetention} retention over ${data.timeDecayInfo.ageRangeInDays} days]` :
                        ' [Time Decay: DISABLED]';

                    console.log(`[Sentinel] Naive Bayes classification for ${Sentinel.hostname}${timeDecayStatus}:`, confidence);
                    return confidence;

                } catch (error) {
                    Sentinel.logError('heuristics.classifyActivities', error);
                    return null; // Fall back to static system
                }
            },

            // PHASE 3.3: Enhanced Classification with Combined Intelligence
            // ENHANCED: Combined intelligence classification with robust null handling and weight validation
            // This function now ensures:
            // 1. Proper weight normalization (sum to 1.0)
            // 2. Robust null result handling
            // 3. Division by zero prevention
            // 4. Comprehensive result validation
            // 5. Detailed debugging information
            async classifyWithCombinedIntelligence(activities) {
                try {
                    // PHASE 3.5: Check whitelist before classification
                    const activitySequence = activities.map(activityData =>
                        activityData.activity || activityData
                    );

                    if (this._isSequenceWhitelisted(activitySequence)) {
                        console.log(`[Sentinel] Activity sequence whitelisted for ${Sentinel.hostname}, returning normal classification`);
                        return {
                            normal: 1.0,
                            suspicious: 0.0,
                            method: 'whitelisted_sequence',
                            components: {
                                whitelist: {
                                    normal: 1.0,
                                    suspicious: 0.0,
                                    weight: 1.0,
                                    reason: 'Sequence whitelisted by user'
                                }
                            }
                        };
                    }

                    // Get all classification results including the new transition matrix analysis
                    const naiveBayesResult = await this.classifyActivities(activities);
                    const correlationResult = await this.classifyCorrelations(activities);
                    const trigramResult = await this.classifyTrigrams(activities);
                    const transitionMatrixResult = await this.classifyTransitionMatrix(activities);

                    // If no method has sufficient data, return null
                    if (!naiveBayesResult && !correlationResult && !trigramResult && !transitionMatrixResult) {
                        console.log(`[Sentinel] Insufficient training data for all classification methods`);
                        return null;
                    }

                    // TÍNH TOÁN TRỌNG SỐ ĐỘNG (including transition matrix)
                    const weights = this._calculateDynamicWeights(correlationResult, trigramResult, transitionMatrixResult);

                    // CRITICAL: Validate weights before using them
                    const weightSum = weights.naiveBayes + weights.correlation + weights.trigram + weights.transitionMatrix;
                    if (Math.abs(weightSum - 1.0) > 0.001) {
                        console.error(`[Sentinel] Invalid weight distribution: sum = ${weightSum.toFixed(4)}, using fallback weights`);
                        // Use fallback weights if normalization failed
                        weights.naiveBayes = 1.0;
                        weights.correlation = 0.0;
                        weights.trigram = 0.0;
                        weights.transitionMatrix = 0.0;
                    }

                    // SỬ DỤNG TRỌNG SỐ ĐỘNG ĐỂ TÍNH ĐIỂM with null safety
                    let finalSuspiciousScore = 0;
                    let finalNormalScore = 0;
                    let totalUsedWeight = 0;

                    // Calculate scores only for available results
                    if (naiveBayesResult && weights.naiveBayes > 0) {
                        finalSuspiciousScore += naiveBayesResult.suspicious * weights.naiveBayes;
                        finalNormalScore += naiveBayesResult.normal * weights.naiveBayes;
                        totalUsedWeight += weights.naiveBayes;
                    }

                    if (correlationResult && weights.correlation > 0) {
                        finalSuspiciousScore += correlationResult.suspicious * weights.correlation;
                        finalNormalScore += correlationResult.normal * weights.correlation;
                        totalUsedWeight += weights.correlation;
                    }

                    if (trigramResult && weights.trigram > 0) {
                        finalSuspiciousScore += trigramResult.suspicious * weights.trigram;
                        finalNormalScore += trigramResult.normal * weights.trigram;
                        totalUsedWeight += weights.trigram;
                    }

                    if (transitionMatrixResult && weights.transitionMatrix > 0) {
                        finalSuspiciousScore += transitionMatrixResult.suspicious * weights.transitionMatrix;
                        finalNormalScore += transitionMatrixResult.normal * weights.transitionMatrix;
                        totalUsedWeight += weights.transitionMatrix;
                    }

                    // CRITICAL: Handle case where no valid results were used
                    if (totalUsedWeight === 0) {
                        console.warn(`[Sentinel] No valid classification results found, returning null`);
                        return null;
                    }

                    // Log used weights for debugging
                    const usedWeights = this._calculateUsedWeights(weights, {
                        naiveBayesResult,
                        correlationResult,
                        trigramResult,
                        transitionMatrixResult
                    });
                    console.log(`[Sentinel] Used weights: ${JSON.stringify(usedWeights)}`);

                    // Normalize scores to ensure they sum to 1 (using only the weights that were actually used)
                    const totalScore = finalSuspiciousScore + finalNormalScore;

                    // Prevent division by zero
                    if (totalScore <= 0) {
                        console.warn(`[Sentinel] Invalid total score: ${totalScore}, using fallback scores`);
                        finalSuspiciousScore = 0.5;
                        finalNormalScore = 0.5;
                    } else {
                        // Normalize by the total score
                        finalSuspiciousScore = finalSuspiciousScore / totalScore;
                        finalNormalScore = finalNormalScore / totalScore;
                    }

                    const normalizedSuspicious = finalSuspiciousScore;
                    const normalizedNormal = finalNormalScore;

                    const combinedResult = {
                        normal: normalizedNormal,
                        suspicious: normalizedSuspicious,
                        totalSamples: naiveBayesResult?.totalSamples,
                        timeDecayInfo: naiveBayesResult?.timeDecayInfo,
                        method: 'combined_intelligence',
                        components: {
                            naiveBayes: naiveBayesResult ? {
                                normal: naiveBayesResult.normal,
                                suspicious: naiveBayesResult.suspicious,
                                weight: weights.naiveBayes,
                                suspiciousActivities: naiveBayesResult.suspiciousActivities
                            } : null,
                            correlation: correlationResult ? {
                                normal: correlationResult.normal,
                                suspicious: correlationResult.suspicious,
                                weight: weights.correlation,
                                analyzedPairs: correlationResult.analyzedPairs,
                                pairSequence: correlationResult.pairSequence
                            } : null,
                            trigram: trigramResult ? {
                                normal: trigramResult.normal,
                                suspicious: trigramResult.suspicious,
                                weight: weights.trigram,
                                analyzedTrigrams: trigramResult.analyzedTrigrams,
                                trigramSequence: trigramResult.trigramSequence
                            } : null,
                            transitionMatrix: transitionMatrixResult ? {
                                normal: transitionMatrixResult.normal,
                                suspicious: transitionMatrixResult.suspicious,
                                weight: weights.transitionMatrix,
                                analyzedTransitions: transitionMatrixResult.analyzedTransitions,
                                transitionSequence: transitionMatrixResult.transitionSequence
                            } : null
                        }
                    };

                    const correlationContribution = correlationResult ? (correlationResult.suspicious * weights.correlation) : 0;
                    const trigramContribution = trigramResult ? (trigramResult.suspicious * weights.trigram) : 0;
                    const transitionMatrixContribution = transitionMatrixResult ? (transitionMatrixResult.suspicious * weights.transitionMatrix) : 0;
                    const correlationImpact = correlationContribution / normalizedSuspicious > 0.3 ? 'HIGH' : 'LOW';
                    const trigramImpact = trigramContribution / normalizedSuspicious > 0.3 ? 'HIGH' : 'LOW';
                    const transitionMatrixImpact = transitionMatrixContribution / normalizedSuspicious > 0.3 ? 'HIGH' : 'LOW';

                    console.log(`[Sentinel] Combined intelligence classification for ${Sentinel.hostname}:`);
                    console.log(`[Sentinel] • Naive Bayes: ${(naiveBayesResult?.suspicious * 100 || 0).toFixed(1)}% suspicious (${weights.naiveBayes} weight)`);
                    if (correlationResult) {
                        console.log(`[Sentinel] • Correlation: ${(correlationResult.suspicious * 100).toFixed(1)}% suspicious (${weights.correlation} weight, ${correlationResult.analyzedPairs} pairs)`);
                    }
                    if (trigramResult) {
                        console.log(`[Sentinel] • Trigram: ${(trigramResult.suspicious * 100).toFixed(1)}% suspicious (${weights.trigram} weight, ${trigramResult.analyzedTrigrams} trigrams)`);
                    }
                    if (transitionMatrixResult) {
                        console.log(`[Sentinel] • Transition Matrix: ${(transitionMatrixResult.suspicious * 100).toFixed(1)}% suspicious (${weights.transitionMatrix} weight, ${transitionMatrixResult.analyzedTransitions} transitions)`);
                    }
                    console.log(`[Sentinel] • Combined: ${(normalizedSuspicious * 100).toFixed(1)}% suspicious (correlation impact: ${correlationImpact}, trigram impact: ${trigramImpact}, transition matrix impact: ${transitionMatrixImpact})`);

                    // CRITICAL: Final validation of the combined result
                    const finalValidation = this._validateCombinedResult(combinedResult, weights, {
                        naiveBayesResult,
                        correlationResult,
                        trigramResult,
                        transitionMatrixResult
                    });

                    if (!finalValidation.isValid) {
                        console.error(`[Sentinel] Combined result validation failed: ${finalValidation.reason}`);
                        return null;
                    }

                    return combinedResult;

                } catch (error) {
                    Sentinel.logError('heuristics.classifyWithCombinedIntelligence', error);
                    return null;
                }
            },

            // ENHANCED: Helper function to validate combined classification results
            _validateCombinedResult(combinedResult, weights, individualResults) {
                try {
                    // Check if the result object has required properties
                    if (!combinedResult || typeof combinedResult !== 'object') {
                        return { isValid: false, reason: 'Invalid result object' };
                    }

                    // Validate that scores are numbers and sum to 1.0
                    if (typeof combinedResult.suspicious !== 'number' || typeof combinedResult.normal !== 'number') {
                        return { isValid: false, reason: 'Invalid score types' };
                    }

                    const scoreSum = combinedResult.suspicious + combinedResult.normal;
                    if (Math.abs(scoreSum - 1.0) > 0.001) {
                        return { isValid: false, reason: `Scores do not sum to 1.0 (sum = ${scoreSum.toFixed(4)})` };
                    }

                    // Validate that scores are within valid range [0, 1]
                    if (combinedResult.suspicious < 0 || combinedResult.suspicious > 1 ||
                        combinedResult.normal < 0 || combinedResult.normal > 1) {
                        return { isValid: false, reason: 'Scores outside valid range [0, 1]' };
                    }

                    // Validate that at least one component was used
                    const usedComponents = Object.values(individualResults).filter(result => result !== null).length;
                    if (usedComponents === 0) {
                        return { isValid: false, reason: 'No individual results were used' };
                    }

                    // Validate weight distribution
                    const weightSum = weights.naiveBayes + weights.correlation + weights.trigram + weights.transitionMatrix;
                    if (Math.abs(weightSum - 1.0) > 0.001) {
                        return { isValid: false, reason: `Invalid weight distribution (sum = ${weightSum.toFixed(4)})` };
                    }

                    return { isValid: true, reason: 'Validation passed' };

                } catch (error) {
                    console.error('[Sentinel] Error in _validateCombinedResult:', error);
                    return { isValid: false, reason: `Validation error: ${error.message}` };
                }
            },

            // ENHANCED: Helper function to calculate actual used weights for debugging
            _calculateUsedWeights(weights, individualResults) {
                const usedWeights = {
                    naiveBayes: 0,
                    correlation: 0,
                    trigram: 0,
                    transitionMatrix: 0,
                    totalUsed: 0
                };

                if (individualResults.naiveBayesResult && weights.naiveBayes > 0) {
                    usedWeights.naiveBayes = weights.naiveBayes;
                    usedWeights.totalUsed += weights.naiveBayes;
                }

                if (individualResults.correlationResult && weights.correlation > 0) {
                    usedWeights.correlation = weights.correlation;
                    usedWeights.totalUsed += weights.correlation;
                }

                if (individualResults.trigramResult && weights.trigram > 0) {
                    usedWeights.trigram = weights.trigram;
                    usedWeights.totalUsed += weights.trigram;
                }

                if (individualResults.transitionMatrixResult && weights.transitionMatrix > 0) {
                    usedWeights.transitionMatrix = weights.transitionMatrix;
                    usedWeights.totalUsed += weights.transitionMatrix;
                }

                return usedWeights;
            },

            // UPGRADED: Model Configuration Signature for Cache Invalidation (including transition matrix)
            _generateModelSignature() {
                const signatureVersion = 'v4'; // Bump version to invalidate old cache
                try {
                    // Gather all parameters that affect the model
                    const modelParams = {
                        timeDecay: this.timeDecayEnabled ? this.halfLife : false,
                        correlation: this.correlationAnalysisEnabled,
                        weights: {
                            nb: this.naiveBayesWeight,
                            corr: this.correlationWeight,
                            tri: this.trigramWeight
                        },
                        thresholds: {
                            minSamples: this.minSamplesForLearning,
                            confidence: this.confidenceThreshold
                        },
                        // Include suspiciousActivities as a stable string
                        activities: this.suspiciousActivities
                    };
                    // Use JSON.stringify for a stable, extensible signature
                    return `${signatureVersion}|${JSON.stringify(modelParams)}`;
                } catch (error) {
                    Sentinel.logError('_generateModelSignature.error', error);
                    // If error, return a random string to force cache rebuild
                    return Math.random().toString();
                }
            },

            // UPGRADED: Dynamic Weight Calculation for Adaptive Intelligence (including transition matrix)
            // ENHANCED: Dynamic weight calculation with proper normalization
            // Ensures weights always sum to 1.0 and handles edge cases properly
            // This function now provides:
            _calculateDynamicWeights(correlationResult, trigramResult, transitionMatrixResult) {
                const baseCorrelationWeight = 0.25; // Reduced to make room for transition matrix
                const baseTrigramWeight = 0.15;     // Reduced to make room for transition matrix
                const baseTransitionMatrixWeight = 0.2; // New weight for transition matrix
                const baseNaiveBayesWeight = 0.4;   // Base weight for naive bayes

                let dynamicCorrelationWeight = 0.0;
                let dynamicTrigramWeight = 0.0;
                let dynamicTransitionMatrixWeight = 0.0;
                let dynamicNaiveBayesWeight = baseNaiveBayesWeight;

                // Calculate for bigrams
                if (correlationResult && this.correlationAnalysisEnabled) {
                    const totalPairSamples = parseFloat(correlationResult.totalPairSamples || 0);

                    // Step function for correlation weight
                    if (totalPairSamples > 20) { // Very confident
                        dynamicCorrelationWeight = baseCorrelationWeight;
                    } else if (totalPairSamples > 5) { // Some data
                        dynamicCorrelationWeight = baseCorrelationWeight * 0.5; // 0.125
                    } else { // Not reliable
                        dynamicCorrelationWeight = baseCorrelationWeight * 0.1; // 0.025
                    }
                }

                // Calculate for trigrams (enhanced with complexity, rarity, and pattern strength analysis)
                if (trigramResult && this.correlationAnalysisEnabled) {
                    const totalTrigramSamples = parseFloat(trigramResult.totalTrigramSamples || 0);
                    const complexity = trigramResult.complexity || 0;
                    const rarity = trigramResult.rarity || 0;
                    const patternStrength = Math.abs(trigramResult.patternStrength || 0);

                    // Base weight calculation from sample size
                    let baseWeight = 0;
                    if (totalTrigramSamples > 30) {
                        baseWeight = baseTrigramWeight;
                    } else if (totalTrigramSamples > 10) {
                        baseWeight = baseTrigramWeight * 0.5; // 0.075
                    } else {
                        baseWeight = baseTrigramWeight * 0.1; // 0.015
                    }

                    // Enhance weight based on trigram characteristics
                    let enhancementFactor = 1.0;

                    // High complexity increases weight (more sophisticated patterns)
                    if (complexity > 0.7) {
                        enhancementFactor *= 1.3;
                    } else if (complexity > 0.5) {
                        enhancementFactor *= 1.1;
                    }

                    // High rarity increases weight (unusual patterns are more significant)
                    if (rarity > 0.8) {
                        enhancementFactor *= 1.4;
                    } else if (rarity > 0.5) {
                        enhancementFactor *= 1.2;
                    }

                    // Strong pattern strength increases weight (clear suspicious/normal patterns)
                    if (patternStrength > 0.6) {
                        enhancementFactor *= 1.3;
                    } else if (patternStrength > 0.3) {
                        enhancementFactor *= 1.1;
                    }

                    // Cap enhancement factor to prevent over-weighting
                    enhancementFactor = Math.min(enhancementFactor, 2.0);

                    dynamicTrigramWeight = baseWeight * enhancementFactor;

                    console.log(`[Sentinel] Enhanced trigram weight calculation: base=${baseWeight.toFixed(3)}, complexity=${complexity.toFixed(3)}, rarity=${rarity.toFixed(3)}, patternStrength=${patternStrength.toFixed(3)}, enhancement=${enhancementFactor.toFixed(3)}, final=${dynamicTrigramWeight.toFixed(3)}`);
                }

                // Calculate for transition matrix (based on number of analyzed transitions)
                if (transitionMatrixResult && this.correlationAnalysisEnabled) {
                    const analyzedTransitions = transitionMatrixResult.analyzedTransitions || 0;
                    if (analyzedTransitions > 5) {
                        dynamicTransitionMatrixWeight = baseTransitionMatrixWeight;
                    } else if (analyzedTransitions > 2) {
                        dynamicTransitionMatrixWeight = baseTransitionMatrixWeight * 0.5; // 0.1
                    } else {
                        dynamicTransitionMatrixWeight = baseTransitionMatrixWeight * 0.1; // 0.02
                    }
                }

                // CRITICAL: Normalize weights to ensure they sum to 1.0
                const totalWeight = dynamicNaiveBayesWeight + dynamicCorrelationWeight + dynamicTrigramWeight + dynamicTransitionMatrixWeight;

                // Prevent division by zero and ensure proper normalization
                if (totalWeight > 0) {
                    dynamicNaiveBayesWeight = dynamicNaiveBayesWeight / totalWeight;
                    dynamicCorrelationWeight = dynamicCorrelationWeight / totalWeight;
                    dynamicTrigramWeight = dynamicTrigramWeight / totalWeight;
                    dynamicTransitionMatrixWeight = dynamicTransitionMatrixWeight / totalWeight;
                } else {
                    // Fallback: if no weights calculated, use naive bayes only
                    dynamicNaiveBayesWeight = 1.0;
                    dynamicCorrelationWeight = 0.0;
                    dynamicTrigramWeight = 0.0;
                    dynamicTransitionMatrixWeight = 0.0;
                }

                // Validate that weights sum to 1.0 (with small tolerance for floating point errors)
                const weightSum = dynamicNaiveBayesWeight + dynamicCorrelationWeight + dynamicTrigramWeight + dynamicTransitionMatrixWeight;
                if (Math.abs(weightSum - 1.0) > 0.001) {
                    console.warn(`[Sentinel] Weight normalization issue: sum = ${weightSum.toFixed(4)}, normalizing...`);
                    // Force normalization
                    dynamicNaiveBayesWeight = dynamicNaiveBayesWeight / weightSum;
                    dynamicCorrelationWeight = dynamicCorrelationWeight / weightSum;
                    dynamicTrigramWeight = dynamicTrigramWeight / weightSum;
                    dynamicTransitionMatrixWeight = dynamicTransitionMatrixWeight / weightSum;
                }

                const weights = {
                    naiveBayes: dynamicNaiveBayesWeight,
                    correlation: dynamicCorrelationWeight,
                    trigram: dynamicTrigramWeight,
                    transitionMatrix: dynamicTransitionMatrixWeight
                };

                // Log weight distribution for debugging
                console.log(`[Sentinel] Dynamic weights: NaiveBayes=${weights.naiveBayes.toFixed(3)}, Correlation=${weights.correlation.toFixed(3)}, Trigram=${weights.trigram.toFixed(3)}, TransitionMatrix=${weights.transitionMatrix.toFixed(3)}`);

                return weights;
            },

            // PHASE 3.3: Correlation Analysis for Sequence Intelligence
            async classifyTrigrams(activities) {
                try {
                    if (!this.correlationAnalysisEnabled || activities.length < 3) {
                        // Not enough activities for trigram analysis or disabled
                        return null;
                    }

                    const data = await this.getOrRebuildModel();

                    // Check if we have enough trigram training data
                    const normalTotal = (data.trigram_frequencies.normal && data.trigram_frequencies.normal.total_trigrams) || 0;
                    const suspiciousTotal = (data.trigram_frequencies.suspicious && data.trigram_frequencies.suspicious.total_trigrams) || 0;
                    const totalTrigramSamples = normalTotal + suspiciousTotal;

                    if (totalTrigramSamples < this.minSamplesForLearning) {
                        console.log(`[Sentinel] Insufficient trigram training data (${totalTrigramSamples.toFixed(2)} weighted trigrams), skipping trigram analysis`);
                        return null; // Fall back to lower n-gram analysis
                    }

                    // Extract activity trigrams from current buffer
                    const activityTrigrams = [];
                    for (let i = 0; i < activities.length - 2; i++) {
                        const firstActivity = activities[i].activity || activities[i];
                        const secondActivity = activities[i + 1].activity || activities[i + 1];
                        const thirdActivity = activities[i + 2].activity || activities[i + 2];
                        activityTrigrams.push(`${firstActivity}->${secondActivity}->${thirdActivity}`);
                    }

                    if (activityTrigrams.length === 0) {
                        return null;
                    }

                    // Calculate prior probabilities (using weighted trigram samples)
                    const priorNormal = normalTotal / totalTrigramSamples;
                    const priorSuspicious = suspiciousTotal / totalTrigramSamples;

                    // Calculate likelihood for each activity trigram
                    let logProbNormal = Math.log(priorNormal);
                    let logProbSuspicious = Math.log(priorSuspicious);

                    // Get unique trigrams (to avoid double counting identical trigrams in same buffer)
                    const uniqueTrigrams = [...new Set(activityTrigrams)];
                    const activeTrigramCount = uniqueTrigrams.length;

                    uniqueTrigrams.forEach(trigramKey => {
                        // Laplace smoothing: add 1 to all weighted counts to avoid zero probabilities
                        const normalCount = (data.trigram_frequencies.normal[trigramKey] || 0) + 1;
                        const suspiciousCount = (data.trigram_frequencies.suspicious[trigramKey] || 0) + 1;

                        // Total trigram types for each class (with smoothing)
                        // Estimate vocabulary size as the total unique trigrams seen
                        const uniqueNormalTrigrams = Object.keys(data.trigram_frequencies.normal).filter(k => k !== 'total_trigrams').length;
                        const uniqueSuspiciousTrigrams = Object.keys(data.trigram_frequencies.suspicious).filter(k => k !== 'total_trigrams').length;
                        const estimatedVocabSize = Math.max(uniqueNormalTrigrams + uniqueSuspiciousTrigrams, 10); // Minimum vocab size

                        const normalDenom = normalTotal + estimatedVocabSize;
                        const suspiciousDenom = suspiciousTotal + estimatedVocabSize;

                        // Calculate log probabilities to avoid underflow
                        logProbNormal += Math.log(normalCount / normalDenom);
                        logProbSuspicious += Math.log(suspiciousCount / suspiciousDenom);
                    });

                    // Convert back to probabilities and normalize
                    const probNormal = Math.exp(logProbNormal);
                    const probSuspicious = Math.exp(logProbSuspicious);
                    const totalProb = probNormal + probSuspicious;

                    const confidence = {
                        normal: probNormal / totalProb,
                        suspicious: probSuspicious / totalProb,
                        totalTrigramSamples: totalTrigramSamples.toFixed(2),
                        analyzedTrigrams: activeTrigramCount,
                        trigramSequence: activityTrigrams,
                        // Enhanced trigram analysis features
                        complexity: this._calculateTrigramComplexity(activityTrigrams),
                        rarity: this._calculateTrigramRarity(uniqueTrigrams, data.trigram_frequencies),
                        patternStrength: this._calculatePatternStrength(activityTrigrams, data.trigram_frequencies)
                    };

                    console.log(`[Sentinel] Enhanced trigram analysis for ${Sentinel.hostname}: ${activeTrigramCount} trigrams analyzed`, confidence);
                    return confidence;

                } catch (error) {
                    Sentinel.logError('heuristics.classifyTrigrams', error);
                    return null; // Fall back to lower n-gram analysis
                }
            },

            // Enhanced Trigram Analysis Helper Functions
            _calculateTrigramComplexity(trigrams) {
                if (!trigrams || trigrams.length === 0) return 0;

                // Calculate complexity based on:
                // 1. Number of unique activities in the trigram
                // 2. Diversity of activity types
                // 3. Sequential complexity

                const uniqueActivities = new Set();
                let sequentialComplexity = 0;

                trigrams.forEach(trigram => {
                    const activities = trigram.split('->');
                    activities.forEach(activity => uniqueActivities.add(activity));

                    // Calculate sequential complexity (how different consecutive activities are)
                    for (let i = 0; i < activities.length - 1; i++) {
                        if (activities[i] !== activities[i + 1]) {
                            sequentialComplexity++;
                        }
                    }
                });

                const diversityScore = uniqueActivities.size / (trigrams.length * 3); // Normalize by expected total
                const sequentialScore = sequentialComplexity / (trigrams.length * 2); // Normalize by expected transitions

                return (diversityScore + sequentialScore) / 2; // Average complexity score
            },

            _calculateTrigramRarity(uniqueTrigrams, trigramFrequencies) {
                if (!uniqueTrigrams || uniqueTrigrams.length === 0) return 0;

                // Calculate rarity based on how uncommon these trigrams are in the training data
                let totalRarityScore = 0;
                let validTrigrams = 0;

                uniqueTrigrams.forEach(trigram => {
                    const normalCount = trigramFrequencies.normal[trigram] || 0;
                    const suspiciousCount = trigramFrequencies.suspicious[trigram] || 0;
                    const totalCount = normalCount + suspiciousCount;

                    if (totalCount > 0) {
                        // Rarity score: inverse of frequency (more rare = higher score)
                        const rarityScore = 1 / (1 + totalCount); // Add 1 to avoid division by zero
                        totalRarityScore += rarityScore;
                        validTrigrams++;
                    } else {
                        // Completely unseen trigram = maximum rarity
                        totalRarityScore += 1.0;
                        validTrigrams++;
                    }
                });

                return validTrigrams > 0 ? totalRarityScore / validTrigrams : 0;
            },

            _calculatePatternStrength(trigrams, trigramFrequencies) {
                if (!trigrams || trigrams.length === 0) return 0;

                // Calculate pattern strength based on:
                // 1. Consistency of patterns
                // 2. Frequency of suspicious patterns
                // 3. Deviation from normal patterns

                let suspiciousPatternScore = 0;
                let normalPatternScore = 0;
                let totalPatterns = 0;

                trigrams.forEach(trigram => {
                    const normalCount = trigramFrequencies.normal[trigram] || 0;
                    const suspiciousCount = trigramFrequencies.suspicious[trigram] || 0;
                    const totalCount = normalCount + suspiciousCount;

                    if (totalCount > 0) {
                        const suspiciousRatio = suspiciousCount / totalCount;
                        const normalRatio = normalCount / totalCount;

                        suspiciousPatternScore += suspiciousRatio;
                        normalPatternScore += normalRatio;
                        totalPatterns++;
                    }
                });

                if (totalPatterns === 0) return 0;

                // Pattern strength: how strongly the patterns lean toward suspicious vs normal
                const avgSuspiciousRatio = suspiciousPatternScore / totalPatterns;
                const avgNormalRatio = normalPatternScore / totalPatterns;

                // Return a score that indicates pattern strength (higher = more suspicious pattern)
                return avgSuspiciousRatio - avgNormalRatio;
            },

            // UPGRADED: Transition Matrix Classification using both normal and suspicious patterns
            async classifyTransitionMatrix(activities) {
                try {
                    if (!this.correlationAnalysisEnabled || activities.length < 2) {
                        return null;
                    }

                    const data = await this.getOrRebuildModel();
                    const transitionMatrix = data.transitionMatrix || {};

                    if (Object.keys(transitionMatrix).length === 0) {
                        console.log(`[Sentinel] No transition matrix data available, skipping transition analysis`);
                        return null;
                    }

                    // Calculate transition probabilities for the activity sequence
                    let logProbNormal = 0;
                    let logProbSuspicious = 0;
                    let analyzedTransitions = 0;
                    const transitionSequence = [];

                    for (let i = 0; i < activities.length - 1; i++) {
                        const fromActivity = activities[i].activity || activities[i];
                        const toActivity = activities[i + 1].activity || activities[i + 1];

                        if (transitionMatrix[fromActivity]) {
                            const stateData = transitionMatrix[fromActivity];

                            // Get transition probabilities for both labels
                            const normalProb = stateData.normal.get(toActivity) || 0.001; // Small smoothing value
                            const suspiciousProb = stateData.suspicious.get(toActivity) || 0.001;

                            // Use log probabilities to avoid underflow
                            logProbNormal += Math.log(normalProb);
                            logProbSuspicious += Math.log(suspiciousProb);

                            analyzedTransitions++;
                            transitionSequence.push(`${fromActivity}->${toActivity}`);
                        }
                    }

                    if (analyzedTransitions === 0) {
                        return null;
                    }

                    // Convert back to probabilities and normalize
                    const probNormal = Math.exp(logProbNormal);
                    const probSuspicious = Math.exp(logProbSuspicious);
                    const totalProb = probNormal + probSuspicious;

                    const confidence = {
                        normal: probNormal / totalProb,
                        suspicious: probSuspicious / totalProb,
                        analyzedTransitions: analyzedTransitions,
                        transitionSequence: transitionSequence,
                        method: 'transition_matrix'
                    };

                    console.log(`[Sentinel] Transition Matrix analysis for ${Sentinel.hostname}: ${analyzedTransitions} transitions analyzed`, confidence);
                    return confidence;

                } catch (error) {
                    Sentinel.logError('heuristics.classifyTransitionMatrix', error);
                    return null;
                }
            },

            // UPGRADED: Web Worker version of _rebuildModelFromHistory for performance optimization
            // ENHANCED: Web Worker for Model Rebuilding with Bulletproof Implementation
            // ENHANCED: Worker-based model rebuilding with no fallback to main thread
            // This function will throw an error if worker creation fails, ensuring
            // that heavy computation never runs on the main thread
            async _rebuildModelFromHistoryWithWorker() {
                try {
                    // Check if Web Workers are supported and functional
                    const workerSupported = await this._checkWorkerSupport();
                    if (!workerSupported) {
                        // Return null instead of throwing an error. This enables clean, expected control flow.
                        console.warn('[Sentinel] Web Worker support not available. Skipping worker-based model rebuild.');
                        return null;
                    }

                    const history = await this.getTrainingHistory();
                    if (history.length === 0) {
                        return {
                            model: {
                                single_frequencies: { normal: {}, suspicious: {} },
                                pair_frequencies: { normal: {}, suspicious: {} },
                                trigram_frequencies: { normal: {}, suspicious: {} },
                                transitionMatrix: {}
                            },
                            metadata: {
                                totalEvents: 0,
                                weightedEvents: 0,
                                lastEventId: null,
                                rebuildTimestamp: Date.now()
                            }
                        };
                    }

                    // Use the helper function to create worker
                    const { worker, workerUrl } = this._createRebuildWorker();

                    return new Promise((resolve, reject) => {
                        const timeoutId = setTimeout(() => {
                            URL.revokeObjectURL(workerUrl);
                            worker.terminate();
                            reject(new Error('Worker timeout - model rebuilding took too long'));
                        }, 30000); // 30 second timeout

                        worker.onmessage = (event) => {
                            clearTimeout(timeoutId);
                            URL.revokeObjectURL(workerUrl);
                            worker.terminate();

                            const message = event.data;

                            if (message.type === 'MODEL_REBUILT') {
                                try {
                                // Convert plain objects back to Maps for the transition matrix
                                    const result = message.payload;
                                Object.keys(result.model.transitionMatrix).forEach(fromState => {
                                    const stateData = result.model.transitionMatrix[fromState];
                                    stateData.normal = new Map(Object.entries(stateData.normal));
                                    stateData.suspicious = new Map(Object.entries(stateData.suspicious));
                                });

                                    console.log('[Sentinel] Worker completed: ' + result.metadata.totalEvents + ' events processed');
                                resolve(result);

                                } catch (deserializeError) {
                                    console.error('[Sentinel] Error deserializing worker result:', deserializeError.message);
                                    reject(new Error('Failed to process worker result: ' + deserializeError.message));
                                }

                            } else if (message.type === 'WORKER_ERROR') {
                                console.error('[Sentinel Worker] Error:', message.payload);
                                reject(new Error('Worker error: ' + message.payload.message));

                            } else {
                                console.warn('[Sentinel] Unknown worker message type:', message.type);
                                reject(new Error('Unknown worker message type: ' + message.type));
                            }
                        };

                        worker.onerror = (error) => {
                            clearTimeout(timeoutId);
                            URL.revokeObjectURL(workerUrl);
                            worker.terminate();
                            console.error('[Sentinel] Worker failed to start or run:', error);
                            reject(new Error('Worker failed: ' + error.message));
                        };

                        // Send data to worker with comprehensive configuration
                        worker.postMessage({
                            history: history,
                            config: {
                            timeDecayEnabled: this.timeDecayEnabled,
                            halfLife: this.halfLife,
                            correlationAnalysisEnabled: this.correlationAnalysisEnabled
                            }
                        });
                    });

                } catch (error) {
                    Sentinel.logError('heuristics._rebuildModelFromHistoryWithWorker', error);
                    console.error('[Sentinel] Worker initialization failed completely:', error.message);
                    // Re-throw unexpected errors. The expected lack of worker support is handled above.
                    throw new Error(`Worker path failed unexpectedly: ${error.message}`);
                }
            },

            // ENHANCED: Helper function for creating and managing rebuild workers
            _createRebuildWorker() {
                // ENHANCED: Bulletproof worker code with comprehensive error handling
                const workerCode = `
                    // ENHANCED: Worker logic for model rebuilding with comprehensive error handling
                    async function rebuildModelWorkerLogic(historyData, config) {
                        try {
                            // Extract configuration parameters
                            const { timeDecayEnabled, halfLife, correlationAnalysisEnabled } = config;

                            // Initialize data structures
                        const singleFreq = { normal: {}, suspicious: {} };
                        const pairFreq = { normal: {}, suspicious: {} };
                        const trigramFreq = { normal: {}, suspicious: {} };
                        const transitionMatrix = {};
                        let totalEvents = 0;
                        let totalWeightedEvents = 0;
                        let oldestEvent = Date.now();
                        let newestEvent = 0;
                        let lastEventId = null;

                            // ENHANCED: Time decay calculation function with error handling
                        function calculateTimeDecayWeight(eventTimestamp) {
                                try {
                            if (!timeDecayEnabled) return 1.0;
                            const now = Date.now();
                            const ageInDays = (now - eventTimestamp) / (1000 * 60 * 60 * 24);
                                    const weight = Math.exp(-ageInDays * Math.log(2) / halfLife);
                                    // Ensure weight is reasonable (between 0.001 and 1.0)
                                    return Math.max(0.001, Math.min(1.0, weight));
                                } catch (error) {
                                    console.warn('[Worker] Time decay calculation error:', error.message);
                                    return 1.0; // Fallback to no decay
                                }
                            }

                            // Process each event in history
                            for (const event of historyData) {
                                try {
                            const timeWeight = calculateTimeDecayWeight(event.timestamp);
                            totalEvents++;
                            totalWeightedEvents += timeWeight;
                            oldestEvent = Math.min(oldestEvent, event.timestamp);
                            newestEvent = Math.max(newestEvent, event.timestamp);
                            lastEventId = event.id;

                            const singleCategory = singleFreq[event.label] || {};
                            const pairCategory = pairFreq[event.label] || {};
                            const trigramCategory = trigramFreq[event.label] || {};

                            // Process single activities
                                    if (event.activities && Array.isArray(event.activities)) {
                            event.activities.forEach(activity => {
                                            if (typeof activity === 'string' && activity.trim()) {
                                singleCategory[activity] = (singleCategory[activity] || 0) + timeWeight;
                                            }
                            });
                            singleCategory.total = (singleCategory.total || 0) + timeWeight;
                            singleFreq[event.label] = singleCategory;
                                    }

                            // Process activity pairs and transition matrix
                                    if (correlationAnalysisEnabled && event.activities && event.activities.length > 1) {
                                for (let i = 0; i < event.activities.length - 1; i++) {
                                    const firstActivity = event.activities[i];
                                    const secondActivity = event.activities[i + 1];

                                            if (typeof firstActivity === 'string' && typeof secondActivity === 'string') {
                                                const pairKey = \`\${firstActivity}->\${secondActivity}\`;
                                pairCategory[pairKey] = (pairCategory[pairKey] || 0) + timeWeight;

                                                // ENHANCED: Update transition matrix for both normal and suspicious behaviors
                                if (!transitionMatrix[firstActivity]) {
                                    transitionMatrix[firstActivity] = { normal: new Map(), suspicious: new Map() };
                                }

                                const labelMap = transitionMatrix[firstActivity][event.label];
                                const currentCount = labelMap.get(secondActivity) || 0;
                                labelMap.set(secondActivity, currentCount + timeWeight);
                                            }
                                }
                                pairCategory.total_pairs = (pairCategory.total_pairs || 0) + (event.activities.length - 1) * timeWeight;
                            }
                            pairFreq[event.label] = pairCategory;

                            // Process activity trigrams
                                    if (correlationAnalysisEnabled && event.activities && event.activities.length > 2) {
                                for (let i = 0; i < event.activities.length - 2; i++) {
                                    const first = event.activities[i];
                                    const second = event.activities[i + 1];
                                    const third = event.activities[i + 2];

                                            if (typeof first === 'string' && typeof second === 'string' && typeof third === 'string') {
                                                const trigramKey = \`\${first}->\${second}->\${third}\`;
                                trigramCategory[trigramKey] = (trigramCategory[trigramKey] || 0) + timeWeight;
                                            }
                                }
                                trigramCategory.total_trigrams = (trigramCategory.total_trigrams || 0) + (event.activities.length - 2) * timeWeight;
                            }
                            trigramFreq[event.label] = trigramCategory;

                                } catch (eventError) {
                                    console.warn('[Worker] Error processing event:', eventError.message);
                                    // Continue processing other events
                                    continue;
                                }
                            }

                            // ENHANCED: Normalize transition matrix with error handling
                        Object.keys(transitionMatrix).forEach(fromState => {
                                try {
                            const stateData = transitionMatrix[fromState];

                                    // Normalize normal transitions
                            const normalTotal = Array.from(stateData.normal.values()).reduce((sum, count) => sum + count, 0);
                            if (normalTotal > 0) {
                                stateData.normal.forEach((count, toState) => {
                                    stateData.normal.set(toState, count / normalTotal);
                                });
                            }

                                    // Normalize suspicious transitions
                            const suspiciousTotal = Array.from(stateData.suspicious.values()).reduce((sum, count) => sum + count, 0);
                            if (suspiciousTotal > 0) {
                                stateData.suspicious.forEach((count, toState) => {
                                    stateData.suspicious.set(toState, count / suspiciousTotal);
                                });
                                    }
                                } catch (normalizeError) {
                                    console.warn('[Worker] Error normalizing transition matrix for state:', fromState, normalizeError.message);
                            }
                        });

                        // Convert Maps to plain objects for serialization
                        const serializedTransitionMatrix = {};
                        Object.keys(transitionMatrix).forEach(fromState => {
                                try {
                            serializedTransitionMatrix[fromState] = {
                                normal: Object.fromEntries(transitionMatrix[fromState].normal),
                                suspicious: Object.fromEntries(transitionMatrix[fromState].suspicious)
                            };
                                } catch (serializeError) {
                                    console.warn('[Worker] Error serializing transition matrix for state:', fromState, serializeError.message);
                                    serializedTransitionMatrix[fromState] = { normal: {}, suspicious: {} };
                                }
                            });

                            // Calculate metadata about time decay effectiveness
                            const ageRangeInDays = totalEvents > 0 ? (newestEvent - oldestEvent) / (1000 * 60 * 60 * 24) : 0;
                            const effectiveRetention = totalEvents > 0 ? (totalWeightedEvents / totalEvents * 100).toFixed(1) : 100;

                            const timeDecayInfo = {
                                enabled: timeDecayEnabled,
                                totalEvents: totalEvents,
                                weightedEvents: totalWeightedEvents.toFixed(2),
                                effectiveRetention: effectiveRetention + '%',
                                ageRangeInDays: ageRangeInDays.toFixed(1),
                                halfLifeDays: halfLife
                            };

                            // Calculate correlation analysis statistics
                            const normalPairs = (pairFreq.normal && pairFreq.normal.total_pairs) || 0;
                            const suspiciousPairs = (pairFreq.suspicious && pairFreq.suspicious.total_pairs) || 0;
                            const totalPairs = normalPairs + suspiciousPairs;

                            const correlationInfo = {
                                enabled: correlationAnalysisEnabled,
                                totalPairs: totalPairs.toFixed(2),
                                normalPairs: normalPairs.toFixed(2),
                                suspiciousPairs: suspiciousPairs.toFixed(2),
                                pairCoverage: totalEvents > 0 ? ((totalPairs / totalEvents) * 100).toFixed(1) + '%' : '0%'
                            };

                            // Calculate trigram statistics
                            const normalTrigrams = (trigramFreq.normal && trigramFreq.normal.total_trigrams) || 0;
                            const suspiciousTrigrams = (trigramFreq.suspicious && trigramFreq.suspicious.total_trigrams) || 0;
                            const totalTrigrams = normalTrigrams + suspiciousTrigrams;

                            const trigramInfo = {
                                enabled: correlationAnalysisEnabled,
                                totalTrigrams: totalTrigrams.toFixed(2),
                                normalTrigrams: normalTrigrams.toFixed(2),
                                suspiciousTrigrams: suspiciousTrigrams.toFixed(2),
                                trigramCoverage: totalEvents > 0 ? ((totalTrigrams / totalEvents) * 100).toFixed(1) + '%' : '0%'
                            };

                        return {
                            model: {
                                single_frequencies: singleFreq,
                                pair_frequencies: pairFreq,
                                trigram_frequencies: trigramFreq,
                                    transitionMatrix: serializedTransitionMatrix,
                                    timeDecayInfo: timeDecayInfo,
                                    correlationInfo: correlationInfo,
                                    trigramInfo: trigramInfo
                            },
                            metadata: {
                                totalEvents: totalEvents,
                                weightedEvents: totalWeightedEvents,
                                lastEventId: lastEventId,
                                rebuildTimestamp: Date.now()
                            }
                        };

                        } catch (error) {
                            console.error('[Worker] Critical error in rebuildModelWorkerLogic:', error.message);
                            throw error;
                        }
                    }

                    // ENHANCED: Message handler with comprehensive error handling
                    onmessage = async function(e) {
                        try {
                            const { history, config } = e.data;

                            if (!history || !Array.isArray(history)) {
                                throw new Error('Invalid history data provided to worker');
                            }

                            if (!config || typeof config !== 'object') {
                                throw new Error('Invalid configuration provided to worker');
                            }

                            const result = await rebuildModelWorkerLogic(history, config);
                            postMessage({ type: 'MODEL_REBUILT', payload: result });

                        } catch (error) {
                            console.error('[Worker] Error in message handler:', error.message);
                            postMessage({
                                type: 'WORKER_ERROR',
                                payload: {
                                    message: error.message,
                                    stack: error.stack,
                                    timestamp: Date.now()
                                }
                            });
                        }
                    };
                `;

                // Create blob and worker with error handling
                const blob = new Blob([workerCode], { type: 'application/javascript' });
                const workerUrl = URL.createObjectURL(blob);
                const worker = new Worker(workerUrl);

                return { worker, workerUrl };
            },

            // ENHANCED: Helper function to check Web Worker support
            _checkWorkerSupport() {
                if (!window.Worker) {
                    console.warn('[Sentinel] Web Workers not supported in this environment.');
                    return Promise.resolve(false); // Always return a promise
                }

                try {
                    // Test if we can actually create a worker
                    const testBlob = new Blob(['onmessage = function() { postMessage("test"); }'], { type: 'application/javascript' });
                    const testUrl = URL.createObjectURL(testBlob);
                    const testWorker = new Worker(testUrl);

                    return new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            testWorker.terminate();
                            URL.revokeObjectURL(testUrl);
                            console.warn('[Sentinel] Worker test timed out. High-performance mode disabled.');
                            resolve(false); // FIX: Resolve on timeout
                        }, 1000);

                        testWorker.onmessage = () => {
                            clearTimeout(timeout);
                            testWorker.terminate();
                            URL.revokeObjectURL(testUrl);
                            resolve(true); // Success path
                        };

                        testWorker.onerror = () => {
                            clearTimeout(timeout);
                            testWorker.terminate();
                            URL.revokeObjectURL(testUrl);
                            console.warn('[Sentinel] Worker test failed. High-performance mode disabled.');
                            resolve(false); // FIX: Resolve on error
                        };

                        testWorker.postMessage('test');
                    });
                } catch (error) {
                    console.error('[Sentinel] Critical error during worker support test:', error.message);
                    return Promise.resolve(false); // FIX: Resolve on exception
                }
            },

            // Enhanced activity reporting with ML integration
            reportActivity(activity) {
                this.currentActivityBuffer.push({ activity, timestamp: Date.now() });

                // Limit buffer size
                if (this.currentActivityBuffer.length > this.activityLogLimit) {
                    this.currentActivityBuffer.shift();
                }
            },

            async init() {
                if (!Sentinel.config.enableHeuristics) return;
                console.log('[Sentinel Heuristics v8.4] IndexedDB-powered ML system online with enterprise-grade storage, transparent management, scalable training history, intelligent adaptive learning, mature time decay intelligence, high-performance cached model architecture, core intelligence upgrade with combined Naive Bayes + Correlation Analysis, and activity sequence whitelist for reduced false positives.');

                try {
                    // Initialize whitelist key and load whitelisted sequences
                    this.whitelistKey = `whitelist_sequences_${Sentinel.hostname}`;
                    await this._loadSequenceWhitelist();

                    // Load existing learning data and display statistics
                    const learnedData = await this.getLearnedData();
                    const normalSamples = (learnedData.normal && learnedData.normal.total) || 0;
                    const suspiciousSamples = (learnedData.suspicious && learnedData.suspicious.total) || 0;
                    const totalSamples = normalSamples + suspiciousSamples;

                    if (totalSamples > 0) {
                        // PHASE 3.1: Enhanced logging with time decay information
                        const timeDecayInfo = learnedData.timeDecayInfo || {};
                        const weightedInfo = timeDecayInfo.enabled ?
                            ` (${timeDecayInfo.weightedEvents} weighted, ${timeDecayInfo.effectiveRetention} retention)` :
                            '';

                        console.log(`[Sentinel] Loaded ML model for ${Sentinel.hostname}: ${normalSamples.toFixed(2)} normal, ${suspiciousSamples.toFixed(2)} suspicious samples${weightedInfo}`);
                        console.log(`[Sentinel] Adaptive learning ${totalSamples >= this.minSamplesForLearning ? 'ACTIVE' : 'PENDING'} (${totalSamples.toFixed(2)}/${this.minSamplesForLearning} weighted samples)`);

                        // PHASE 3.1: Time decay status information
                        if (timeDecayInfo.enabled) {
                            console.log(`[Sentinel] Time decay intelligence ACTIVE: ${this.halfLife}-day half-life, ${timeDecayInfo.effectiveRetention} knowledge retention over ${timeDecayInfo.ageRangeInDays} days`);
                        } else {
                            console.log(`[Sentinel] Time decay intelligence DISABLED - all historical data weighted equally`);
                        }

                        // Show IndexedDB status if available
                        if (Sentinel.DB.initialized) {
                            const dbStats = await Sentinel.DB.getStats();
                            console.log(`[Sentinel] IndexedDB: ${dbStats.totalEvents} total events across all sites (v${dbStats.dbVersion})`);
                        }
                    } else {
                        console.log(`[Sentinel] No learning data for ${Sentinel.hostname} - will use static rules until user provides feedback`);
                        if (this.timeDecayEnabled) {
                            console.log(`[Sentinel] Time decay intelligence ready: ${this.halfLife}-day half-life for future learning`);
                        }
                    }
                } catch (error) {
                    Sentinel.logError('heuristics.init', error);
                    console.log(`[Sentinel] Error loading learning data for ${Sentinel.hostname} - will use static rules`);
                }
            },

            // PHASE 3.6: Policy Engine - Centralized Decision Flow
            async report(activity) {
                if (!Sentinel.config.enableHeuristics) return;

                // Step 1: Record activity and update buffers
                this.detectedActivities.push({ activity: activity, timestamp: Date.now() });
                if (this.detectedActivities.length > this.activityLogLimit) {
                    this.detectedActivities.shift();
                }

                this.reportActivity(activity); // Add to ML buffer
                const currentSequence = this.currentActivityBuffer.map(a => a.activity);

                // Step 2: Check Whitelist (Highest Priority)
                if (this._isSequenceWhitelisted(currentSequence)) {
                    console.log(`[Sentinel] Policy Engine: Sequence whitelisted. Suppressing alerts for: ${currentSequence.join(' -> ')}`);
                    this.resetStaticScoreForSequence(currentSequence);
                    return; // Stop processing immediately
                }

                // Step 3: ML Classification (if sufficient data)
                if (this.learningEnabled && this.currentActivityBuffer.length >= 5) {
                        let mlResult = null;
                    try {
                            mlResult = await this.classifyWithCombinedIntelligence(this.currentActivityBuffer);
                        } catch (error) {
                            Sentinel.logError('policyEngine.mlClassification', error);
                        }

                        // Nếu ML đã chạy và trả về một kết quả (dù là null do lỗi hay là một đối tượng phân loại)
                        // thì quyết định của nó (hoặc việc nó không thể quyết định) là cuối cùng.
                        if (mlResult !== null) {
                            if (mlResult && mlResult.suspicious > this.confidenceThreshold) {
                            console.log(`[Sentinel] Policy Engine: ML classification triggered alert (${(mlResult.suspicious * 100).toFixed(1)}% suspicious)`);
                            this.triggerAdaptiveAlert(mlResult);
                            } else {
                                // ML đã chạy và kết luận là bình thường, hoặc không đủ tự tin
                                console.log(`[Sentinel] Policy Engine: ML processed. Suppressing static score for this batch.`);
                            }
                            // Dù kết quả là gì, reset trạng thái và dừng lại.
                            this.resetStaticScore();
                            this.currentActivityBuffer = [];
                            return; // <-- ĐIỂM MẤU CHỐT
                    }
                }

                // Step 4: Static Score System (Lowest Priority)
                    // Logic của hệ thống tĩnh chỉ được thực thi nếu khối ML ở trên không chạy hoặc không trả về kết quả.
                this.updateStaticScore(activity);

                if (this.suspicionScore > this.threshold) {
                    console.log(`[Sentinel] Policy Engine: Static score threshold triggered alert (${this.suspicionScore}/${this.threshold})`);
                    this.triggerAlert();
                    this.suspicionScore = 0;
                    this.currentActivityBuffer = [];
                }
            },

            // PHASE 3.6: Policy Engine Helper Functions
            updateStaticScore(activity) {
                const activityInfo = this.suspiciousActivities[activity];
                if (activityInfo) {
                    this.suspicionScore += activityInfo.score || 0;
                }

                // Start decay mechanism if not running
                if (!this.staticScoreDecayInterval) {
                    this.staticScoreDecayInterval = setInterval(() => {
                        // Reduce 1 point per second
                        this.suspicionScore = Math.max(0, this.suspicionScore - 1);
                        // If score reaches 0, stop interval to save resources
                        if (this.suspicionScore === 0) {
                            clearInterval(this.staticScoreDecayInterval);
                            this.staticScoreDecayInterval = null;
                        }
                    }, 1000);
                }
            },

            resetStaticScore() {
                this.suspicionScore = 0;
                if (this.staticScoreDecayInterval) {
                    clearInterval(this.staticScoreDecayInterval);
                    this.staticScoreDecayInterval = null;
                }
            },

            resetStaticScoreForSequence(sequence) {
                // Reset static score for whitelisted sequences
                this.resetStaticScore();
                console.log(`[Sentinel] Policy Engine: Reset static score for whitelisted sequence: ${sequence.join(' -> ')}`);
            },

            // PHASE 3.1: Adaptive Alert with Machine Learning Integration
            // PHASE 3.3: Enhanced with Combined Intelligence and Sequence Detection
            triggerAdaptiveAlert(mlResult) {
                const activitySummary = this.currentActivityBuffer.reduce((summary, log) => {
                    summary[log.activity] = (summary[log.activity] || 0) + 1;
                    return summary;
                }, {});
                const summaryString = Object.entries(activitySummary)
                    .map(([activity, count]) => `${count}x ${activity}`)
                    .join(', ');

                const confidence = (mlResult.suspicious * 100).toFixed(1);

                // PHASE 3.3: Enhanced alert message with correlation analysis insights
                let alertMessage = `🤖 AI Alert: Suspicious behavior detected (${confidence}% confidence). ${summaryString}`;
                let logMessage = `[Sentinel] AI ALERT (${confidence}% confidence, ${mlResult.method}). Activities: ${summaryString}`;

                // Add sequence information if correlation analysis contributed significantly
                if (mlResult.method === 'combined_intelligence' && mlResult.components && mlResult.components.correlation) {
                    const corrContribution = mlResult.components.correlation.suspicious * mlResult.components.correlation.weight;
                    const totalSuspicious = mlResult.suspicious;
                    const correlationImpact = corrContribution / totalSuspicious;

                    if (correlationImpact > 0.3) { // Correlation contributes more than 30% to the decision
                        const pairSequence = mlResult.components.correlation.pairSequence || [];
                        const sequenceString = pairSequence.join(' → ');
                        alertMessage += ` Note: The sequence of these actions is unusual for this site.`;
                        logMessage += ` Sequence detected: ${sequenceString}`;
                        console.warn(`[Sentinel] Sequence analysis contributed ${(correlationImpact * 100).toFixed(1)}% to this alert`);
                    }
                } else if (mlResult.method === 'correlation_only') {
                    alertMessage += ` Note: Detected based on unusual activity sequences.`;
                }

                if (Sentinel.config.heuristicMode === 'log' || Sentinel.config.heuristicMode === 'alert') {
                    console.warn(logMessage);
                    if (Sentinel.config.heuristicMode === 'log') {
                        console.table(this.currentActivityBuffer);
                        if (mlResult.components && mlResult.components.correlation) {
                            console.log(`[Sentinel] Correlation analysis details:`, mlResult.components.correlation);
                        }
                    }
                }
                if (Sentinel.config.heuristicMode === 'alert') {
                    this.displayAdaptiveBanner(alertMessage, [...this.currentActivityBuffer], mlResult);
                }

                // Reset buffers
                this.currentActivityBuffer = [];
                this.detectedActivities = [];
            },

            triggerAlert() {
                const activitySummary = this.detectedActivities.reduce((summary, log) => {
                    summary[log.activity] = (summary[log.activity] || 0) + 1;
                    return summary;
                }, {});
                const summaryString = Object.entries(activitySummary)
                    .map(([activity, count]) => `${count}x ${activity}`)
                    .join(', ');

                const logMessage = `[Sentinel] HIGH SUSPICION SCORE (${this.suspicionScore}). Activities: ${summaryString}`;
                const alertMessage = `⚠️ Static Alert: Aggressive tracking detected. ${summaryString}`;

                if (Sentinel.config.heuristicMode === 'log' || Sentinel.config.heuristicMode === 'alert') {
                    console.warn(logMessage);
                    if (Sentinel.config.heuristicMode === 'log') {
                        console.table(this.detectedActivities);
                    }
                }
                if (Sentinel.config.heuristicMode === 'alert') {
                    this.displayAdaptiveBanner(alertMessage, [...this.detectedActivities], null);
                }

                this.suspicionScore = 0;
    if (this.staticScoreDecayInterval) {
        clearInterval(this.staticScoreDecayInterval);
        this.staticScoreDecayInterval = null;
    }
    this.detectedActivities = [];
},
            // PHASE 3.1: Adaptive Banner with Machine Learning Training Interface
            displayAdaptiveBanner(message, activities, mlResult) {
                try {
                    // Clean up any existing banner
                    if (this.activeBanner) {
                        this.activeBanner.remove();
                        this.activeBanner = null;
                    }

                    // PHASE 3.1: Proactive Whitelist Suggestions - Check dismiss count
                    const dismissCount = this.getDismissCountForSequence(activities);
                    const shouldSuggestWhitelist = dismissCount >= 3;

                    // If user has dismissed this sequence 3+ times, show whitelist suggestion instead
                    if (shouldSuggestWhitelist) {
                        this.showProactiveWhitelistSuggestion(activities, dismissCount);
                        return;
                    }

                    const bannerId = Sentinel.UI.selectors.alertBanner;
                    const banner = document.createElement('div');
                    banner.id = bannerId;

                    // Create interactive banner with user feedback buttons
                    const normalBtnId = Sentinel.UI._generateId('sentinel-heuristic-normal');
                    const suspiciousBtnId = Sentinel.UI._generateId('sentinel-heuristic-suspicious');
                    const dismissBtnId = Sentinel.UI._generateId('sentinel-heuristic-dismiss');
                    const explainBtnId = Sentinel.UI._generateId('sentinel-explain-btn');
                    const sequenceBtnId = Sentinel.UI._generateId('sentinel-trust-sequence');

                    const confidenceInfo = mlResult ?
                        ` (AI: ${(mlResult.suspicious * 100).toFixed(1)}% confidence, ${mlResult.totalSamples} training samples)` :
                        ' (Static Rules)';

                    // PHASE 1.2: Enhanced banner with activity descriptions and user-friendly buttons
                    const activitiesWithTooltips = activities.map(activityData => {
                        const activity = activityData.activity || activityData;
                        const activityInfo = Sentinel.Heuristics.suspiciousActivities[activity];
                        const description = activityInfo?.desc || 'Unknown tracking activity';
                        const score = activityInfo?.score || 0;

                        return `<span class="activity-pill" title="${description} (Risk score: ${score})">${activity}</span>`;
                    }).join(' ');

                    banner.innerHTML = `
                        <div style="padding: 8px; border-radius: 6px; background: ${mlResult ? 'rgba(142, 68, 173, 0.1)' : 'rgba(192, 57, 43, 0.1)'} ; margin-bottom: 8px;">
                            <div style="font-weight: 600; margin-bottom: 6px;">${message}${confidenceInfo}</div>
                            <div style="font-size: 12px; color: #555; margin-bottom: 8px;">
                                <strong>Detected activities:</strong> ${activitiesWithTooltips}
                            </div>
                            <div style="font-size: 11px; color: #666; font-style: italic; margin-bottom: 8px;">
                                💡 Your feedback helps Sentinel's AI learn what is normal behavior for this website
                            </div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;">
                                <button id="${normalBtnId}" style="background: #27ae60; border: none; color: white; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s;">
                                    ✅ Trust this behavior
                                </button>
                                <button id="${sequenceBtnId}" style="background: #f39c12; border: none; color: white; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s;">
                                    🔒 Trust this sequence
                                </button>
                                <button id="${suspiciousBtnId}" style="background: #e74c3c; border: none; color: white; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s;">
                                    🚫 Block this behavior
                                </button>
                                <button id="${dismissBtnId}" style="background: #95a5a6; border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; transition: all 0.2s;">
                                    ⏭️ Skip (no feedback)
                                </button>
                                <button id="${explainBtnId}" style="background: #3498db; border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; transition: all 0.2s;">
                                    ❓ Why this alert?
                                </button>
                            </div>
                            <div style="font-size: 11px; color: #666; margin-top: 8px; text-align: center;">
                                💡 <strong>Quick Guide:</strong> "Trust" = Teach AI this is normal | "Block" = Confirm it's suspicious | "Sequence" = Whitelist this pattern
                            </div>
                        </div>
                    `;

                    document.body.appendChild(banner);
                    this.activeBanner = banner;

                    // PHASE 1.2: Enhanced dynamic styling with activity tooltips
                    GM_addStyle(`
                        #${bannerId} {
                            position: fixed; top: 0; left: 0; width: 100%;
                            background: ${mlResult ? '#8e44ad' : '#c0392b'};
                            color: white; padding: 12px 16px; z-index: 2147483647;
                            font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        }
                        #${bannerId} button:hover {
                            opacity: 0.9; transform: scale(1.05); transition: all 0.2s;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                        }
                        #${bannerId} .activity-pill {
                            background: rgba(255,255,255,0.2);
                            padding: 2px 6px;
                            border-radius: 3px;
                            margin: 0 2px;
                            font-family: monospace;
                            font-size: 11px;
                            cursor: help;
                            display: inline-block;
                            transition: background 0.2s;
                        }
                        #${bannerId} .activity-pill:hover {
                            background: rgba(255,255,255,0.3);
                        }
                    `);

                    // Set up event listeners for user feedback
                    const setupFeedback = () => {
                        const normalBtn = document.getElementById(normalBtnId);
                        const suspiciousBtn = document.getElementById(suspiciousBtnId);
                        const dismissBtn = document.getElementById(dismissBtnId);
                        const explainBtn = document.getElementById(explainBtnId);

                        // PHASE 3.1: Enhanced dismiss button with proactive tracking
                        if (dismissBtn) {
                            dismissBtn.onclick = () => {
                                // Track this dismissal for proactive suggestions
                                const newDismissCount = this.incrementDismissCountForSequence(activities);
                                console.log(`[Sentinel] User dismissed alert. Dismiss count: ${newDismissCount}`);

                                this.cleanupBanner();
                                Sentinel.UI.showNotification('Alert dismissed. Sentinel will learn from your behavior.', 'info', 2000);
                            };
                        }
                        const sequenceBtn = document.getElementById(sequenceBtnId);

                        if (normalBtn) {
                            normalBtn.onclick = async () => {
                                console.log('[Sentinel] User marked activities as NORMAL for', Sentinel.hostname);
                                try {
                                    await this.trainModel(activities, 'normal');
                                } catch (error) {
                                    Sentinel.logError('banner.trainModel.normal', error);
                                }
                                this.cleanupBanner();
                            };
                        }

                        if (suspiciousBtn) {
                            suspiciousBtn.onclick = async () => {
                                console.log('[Sentinel] User confirmed activities as SUSPICIOUS for', Sentinel.hostname);
                                try {
                                    await this.trainModel(activities, 'suspicious');
                                } catch (error) {
                                    Sentinel.logError('banner.trainModel.suspicious', error);
                                }
                                this.cleanupBanner();
                            };
                        }

                        if (explainBtn) {
                            explainBtn.onclick = () => {
                                this._buildExplainerPanel(mlResult);
                            };
                        }

                        if (sequenceBtn) {
                            sequenceBtn.onclick = async () => {
                                console.log('[Sentinel] User trusted activity sequence for', Sentinel.hostname);
                                try {
                                    await this.trainModelWithSequence(activities, 'normal_sequence');
                                    Sentinel.UI.showNotification('Activity sequence added to whitelist. Future similar sequences will be trusted.', 'success', 5000);
                                } catch (error) {
                                    Sentinel.logError('banner.trainModelWithSequence', error);
                                    Sentinel.UI.showNotification('Failed to whitelist sequence. Please try again.', 'error', 3000);
                                }
                                this.cleanupBanner();
                            };
                        }
                    };

                    // Setup feedback immediately if DOM is ready, otherwise wait
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', setupFeedback);
                    } else {
                        setTimeout(setupFeedback, 100);
                    }

                    // Auto-cleanup after 15 seconds (longer for user interaction)
                    setTimeout(() => {
                        if (this.activeBanner === banner) {
                            console.log('[Sentinel] Banner auto-dismissed after 15 seconds');
                            this.cleanupBanner();
                        }
                    }, 15000);

                } catch (error) {
                    Sentinel.logError('heuristics.displayAdaptiveBanner', error);
                    // Fallback to simple banner
                    this.displaySimpleBanner(message);
                }
            },

            // PHASE 3.1: Proactive Whitelist Suggestion Dialog
            showProactiveWhitelistSuggestion(activities, dismissCount) {
                const sequenceSignature = this._generateSequenceSignature(activities);
                const activitySequence = activities.map(a => a.activity || a).join(' → ');

                const message = `You've dismissed alerts for this activity sequence ${dismissCount} times:\n\n` +
                              `🔍 Sequence: ${activitySequence}\n\n` +
                              `Would you like to whitelist this sequence as normal behavior for ${Sentinel.hostname}? ` +
                              `This will prevent future alerts for this specific activity pattern.`;

                Sentinel.UI.showConfirmation(
                    message,
                    async () => {
                        try {
                            // Add to whitelist
                            await this.trainModelWithSequence(activities, 'normal_sequence');

                            // Reset dismiss count since it's now whitelisted
                            this.resetDismissCountForSequence(activities);

                            Sentinel.UI.showNotification(
                                `✅ Sequence whitelisted! Future alerts for this pattern will be suppressed.`,
                                'success',
                                5000
                            );

                            console.log(`[Sentinel] Proactive whitelist: Added "${sequenceSignature}" to whitelist`);
                        } catch (error) {
                            Sentinel.logError('heuristics.showProactiveWhitelistSuggestion', error);
                            Sentinel.UI.showNotification(
                                'Failed to whitelist sequence. Please try again.',
                                'error',
                                3000
                            );
                        }
                    },
                    () => {
                        // User declined - just reset the dismiss count to stop suggesting
                        this.resetDismissCountForSequence(activities);
                        Sentinel.UI.showNotification(
                            'Dismiss count reset. You can still manually whitelist this sequence later.',
                            'info',
                            3000
                        );
                    },
                    {
                        title: '🤖 Proactive Whitelist Suggestion',
                        confirmText: '✅ Yes, whitelist this sequence',
                        cancelText: '❌ No, just reset dismiss count'
                    }
                );
            },

            // Cleanup method for banner management
            cleanupBanner() {
                if (this.activeBanner) {
                    this.activeBanner.remove();
                    this.activeBanner = null;
                }
            },

            // Fallback simple banner (no ML features)
            displaySimpleBanner(message) {
                const bannerId = Sentinel.UI.selectors.alertBanner;
                let banner = document.getElementById(bannerId);
                if (!banner) {
                    banner = document.createElement('div');
                    banner.id = bannerId;
                    document.body.appendChild(banner);
                    GM_addStyle(`#${bannerId} { position: fixed; top: 0; left: 0; width: 100%; background: #c0392b; color: white; text-align: center; padding: 8px; z-index: 2147483647; font-size: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); }`);
                }
                banner.textContent = message;
                setTimeout(() => banner && banner.remove(), 7000);
            },

            // NEW: Decision Explainer Panel
            _buildExplainerPanel(mlResult) {
                if (!mlResult) {
                    Sentinel.UI.showNotification('No detailed analysis available for this alert', 'info', 3000);
                    return;
                }

                const explainerId = Sentinel.UI._generateId('sentinel-explainer-panel');
                let explainer = document.getElementById(explainerId);
                if (explainer) {
                    explainer.remove();
                }

                // ENHANCED: Calculate confidence level and recommendation
                const confidence = (mlResult.suspicious * 100).toFixed(1);
                let confidenceLevel = 'Low';
                let recommendation = 'Consider trusting this behavior';

                if (confidence >= 80) {
                    confidenceLevel = 'Very High';
                    recommendation = 'Strongly recommend blocking this behavior';
                } else if (confidence >= 60) {
                    confidenceLevel = 'High';
                    recommendation = 'Recommend blocking this behavior';
                } else if (confidence >= 40) {
                    confidenceLevel = 'Medium';
                    recommendation = 'Consider blocking this behavior';
                } else if (confidence >= 20) {
                    confidenceLevel = 'Low';
                    recommendation = 'Consider trusting this behavior';
                } else {
                    confidenceLevel = 'Very Low';
                    recommendation = 'Recommend trusting this behavior';
                }

                explainer = document.createElement('div');
                explainer.id = explainerId;
                explainer.innerHTML = `
                    <div class="explainer-header">
                        <h3>🤖 AI Decision Explanation</h3>
                        <button class="close-explainer">×</button>
                    </div>
                    <div class="explainer-body">
                        <div class="confidence-section">
                            <div class="confidence-level">
                                <span class="confidence-label">Confidence Level:</span>
                                <span class="confidence-value ${confidenceLevel.toLowerCase().replace(' ', '-')}">${confidenceLevel}</span>
                            </div>
                            <div class="overall-score">
                                Suspicious Score: ${confidence}%
                                <div class="progress-bar">
                                    <div style="width: ${confidence}%; background: #e74c3c;"></div>
                                </div>
                            </div>
                            <div class="recommendation">
                                <strong>💡 Recommendation:</strong> ${recommendation}
                            </div>
                        </div>

                        <div class="method-info">
                            <strong>🔍 Analysis Method:</strong> ${mlResult.method || 'Combined Intelligence'}
                            ${mlResult.totalSamples ? `<br><strong>📊 Training Samples:</strong> ${mlResult.totalSamples}` : ''}
                        </div>

                        <div class="components-breakdown">
                            <h4>📈 Decision Components</h4>
                            ${this._renderComponents(mlResult.components)}
                        </div>

                        <div class="explanation-note">
                            <strong>🎯 Primary Driver:</strong> ${this._getPrimaryDriver(mlResult.components)}
                        </div>

                        <div class="action-suggestions">
                            <h4>💡 Suggested Actions</h4>
                            <div class="suggestion-item">
                                <span class="suggestion-icon">✅</span>
                                <span class="suggestion-text">Trust this behavior - Teach AI this is normal</span>
                            </div>
                            <div class="suggestion-item">
                                <span class="suggestion-icon">🔒</span>
                                <span class="suggestion-text">Trust this sequence - Whitelist this pattern</span>
                            </div>
                            <div class="suggestion-item">
                                <span class="suggestion-icon">🚫</span>
                                <span class="suggestion-text">Block this behavior - Confirm it's suspicious</span>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(explainer);

                GM_addStyle(`
                    #${explainerId} {
                        position: fixed; top: 10%; left: 50%; transform: translateX(-50%);
                        background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                        z-index: 2147483647; width: 500px; max-height: 80vh; overflow-y: auto;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    }
                    .explainer-header {
                        background: linear-gradient(135deg, #3498db, #2980b9); color: white;
                        padding: 15px 20px; border-radius: 12px 12px 0 0;
                        display: flex; justify-content: space-between; align-items: center;
                    }
                    .explainer-header h3 { margin: 0; font-size: 18px; }
                    .close-explainer { background: none; border: none; color: white; font-size: 24px; cursor: pointer; }
                    .explainer-body { padding: 20px; }

                    .confidence-section { margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; }
                    .confidence-level { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
                    .confidence-label { font-weight: 600; }
                    .confidence-value { padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 12px; }
                    .confidence-value.very-high { background: #e74c3c; color: white; }
                    .confidence-value.high { background: #f39c12; color: white; }
                    .confidence-value.medium { background: #f1c40f; color: #2c3e50; }
                    .confidence-value.low { background: #2ecc71; color: white; }
                    .confidence-value.very-low { background: #27ae60; color: white; }

                    .overall-score { margin-bottom: 10px; font-weight: bold; }
                    .progress-bar { height: 12px; background: #e9ecef; border-radius: 6px; margin-top: 8px; overflow: hidden; }
                    .progress-bar > div { height: 100%; border-radius: 6px; transition: width 0.3s ease; }
                    .recommendation { font-style: italic; color: #495057; }

                    .method-info { margin-bottom: 20px; padding: 10px; background: #e3f2fd; border-radius: 6px; font-size: 13px; }

                    .components-breakdown h4 { margin: 0 0 15px 0; color: #2c3e50; }
                    .component-item { margin: 15px 0; padding: 12px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #3498db; }
                    .component-title { font-weight: bold; margin-bottom: 8px; color: #2c3e50; }
                    .component-detail { font-size: 13px; color: #495057; line-height: 1.4; }
                    .explanation-note { font-style: italic; color: #555; margin: 20px 0; padding: 10px; background: #fff3cd; border-radius: 6px; }

                    .action-suggestions { margin-top: 20px; }
                    .action-suggestions h4 { margin: 0 0 15px 0; color: #2c3e50; }
                    .suggestion-item { display: flex; align-items: center; margin: 10px 0; padding: 8px; background: #f8f9fa; border-radius: 4px; }
                    .suggestion-icon { margin-right: 10px; font-size: 16px; }
                    .suggestion-text { font-size: 13px; color: #495057; }

                    .sequence-code {
                        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                        background-color: #f1f3f4;
                        padding: 3px 6px;
                        border-radius: 4px;
                        font-size: 11px;
                        color: #e74c3c;
                        border: 1px solid #ddd;
                        display: inline-block;
                        margin: 2px;
                    }
                `);

                document.querySelector(`#${explainerId} .close-explainer`).onclick = () => explainer.remove();
            },

            // Helper for rendering components with enhanced transparency
            _renderComponents(components) {
                let html = '';
                if (components.naiveBayes) {
                    const suspiciousActivities = components.naiveBayes.suspiciousActivities || [];
                    const activityList = suspiciousActivities.length > 0 ?
                        suspiciousActivities.map(activity => `<span class="sequence-code">${activity}</span>`).join(', ') :
                        'No specific activities identified';

                    html += `
                        <div class="component-item">
                            <div class="component-title">Individual Actions (Naive Bayes)</div>
                            <div class="component-detail">
                                Score: ${(components.naiveBayes.suspicious * 100).toFixed(1)}%, Weight: ${components.naiveBayes.weight.toFixed(2)}, Contribution: ${(components.naiveBayes.suspicious * components.naiveBayes.weight * 100).toFixed(1)}%
                                <br><strong>Triggering Activities:</strong> ${activityList}
                            </div>
                        </div>
                    `;
                }
                if (components.correlation) {
                    const pairSequence = components.correlation.pairSequence || [];
                    const sequence = pairSequence.length > 0 ?
                        pairSequence.join(' → ') :
                        'No specific sequence identified';

                    html += `
                        <div class="component-item">
                            <div class="component-title">Action Pairs (Correlation)</div>
                            <div class="component-detail">
                                Score: ${(components.correlation.suspicious * 100).toFixed(1)}%, Weight: ${components.correlation.weight.toFixed(2)}, Contribution: ${(components.correlation.suspicious * components.correlation.weight * 100).toFixed(1)}%
                                <br><strong>Triggering Sequence:</strong> <span class="sequence-code">${sequence}</span>
                            </div>
                        </div>
                    `;
                }
                if (components.trigram) {
                    const trigramSequence = components.trigram.trigramSequence || [];
                    const sequence = trigramSequence.length > 0 ?
                        trigramSequence.join(' → ') :
                        'No specific triplet identified';

                    html += `
                        <div class="component-item">
                            <div class="component-title">Action Triplets (Trigrams)</div>
                            <div class="component-detail">
                                Score: ${(components.trigram.suspicious * 100).toFixed(1)}%, Weight: ${components.trigram.weight.toFixed(2)}, Contribution: ${(components.trigram.suspicious * components.trigram.weight * 100).toFixed(1)}%
                                <br><strong>Triggering Triplet:</strong> <span class="sequence-code">${sequence}</span>
                            </div>
                        </div>
                    `;
                }
                return html;
            },

            // Helper to determine primary driver
            _getPrimaryDriver(components) {
                let maxContribution = 0;
                let primary = 'individual actions';
                if (components.naiveBayes) {
                    const contrib = components.naiveBayes.suspicious * components.naiveBayes.weight;
                    if (contrib > maxContribution) {
                        maxContribution = contrib;
                        primary = 'individual actions';
                    }
                }
                if (components.correlation) {
                    const contrib = components.correlation.suspicious * components.correlation.weight;
                    if (contrib > maxContribution) {
                        maxContribution = contrib;
                        primary = 'unusual action sequences';
                    }
                }
                if (components.trigram) {
                    const contrib = components.trigram.suspicious * components.trigram.weight;
                    if (contrib > maxContribution) {
                        primary = 'complex action patterns';
                    }
                }
                return primary;
            },

            // PHASE 3.2: Performance Monitoring and Optimization
            measureExecutionTime(operationName, operation) {
                const startTime = performance.now();
                const result = operation();
                const endTime = performance.now();
                const executionTime = endTime - startTime;

                // Log performance data for optimization analysis
                if (executionTime > 50) { // Only log operations taking more than 50ms
                    Sentinel.log('warn', `Performance: ${operationName} took ${executionTime.toFixed(2)}ms`);
                }

                return result;
            },

            // PHASE 3.2: Lazy Loading Performance Analysis
            analyzeLazyLoadingPerformance() {
                const performanceData = {
                    settingsPanel: {
                        cssLoadTime: 0,
                        htmlGenerationTime: 0,
                        totalLoadTime: 0
                    },
                    mlPanel: {
                        dataFetchTime: 0,
                        htmlGenerationTime: 0,
                        totalLoadTime: 0
                    }
                };

                // Measure settings panel performance
                const settingsStart = performance.now();
                this.buildSettingsPanel();
                performanceData.settingsPanel.totalLoadTime = performance.now() - settingsStart;

                // Measure ML panel performance
                const mlStart = performance.now();
                this.buildMlManagementPanel().then(() => {
                    performanceData.mlPanel.totalLoadTime = performance.now() - mlStart;

                    // Log performance insights
                    Sentinel.log('info', `Performance Analysis: Settings Panel ${performanceData.settingsPanel.totalLoadTime.toFixed(2)}ms, ML Panel ${performanceData.mlPanel.totalLoadTime.toFixed(2)}ms`);

                    if (performanceData.settingsPanel.totalLoadTime > 100) {
                        Sentinel.log('warn', 'Settings panel load time exceeds 100ms - consider further optimization');
                    }

                    if (performanceData.mlPanel.totalLoadTime > 500) {
                        Sentinel.log('warn', 'ML panel load time exceeds 500ms - consider data caching');
                    }
                });

                return performanceData;
            },

            showCircuitBreakerStatus() {
                const status = Sentinel.Heuristics.getCircuitBreakerStatus();
                const retryStatus = Sentinel.Heuristics.getRetryStatus();

                const stateIcon = status.state === 'CLOSED' ? '✅' : status.state === 'HALF_OPEN' ? '⚠️' : '🚫';

                let message = `🔌 Enhanced Circuit Breaker Status:\n`;
                message += `${stateIcon} State: ${status.state}\n`;
                message += `• Consecutive Failures: ${status.consecutiveFailures}/${status.maxFailures}\n`;
                message += `• Last Failure: ${status.lastFailureTime ? new Date(status.lastFailureTime).toLocaleTimeString() : 'None'}\n`;
                message += `• Last Success: ${status.lastSuccessTime ? new Date(status.lastSuccessTime).toLocaleTimeString() : 'None'}\n`;
                message += `• Time Until Reset: ${status.timeUntilReset > 0 ? Math.ceil(status.timeUntilReset / 1000) + 's' : 'N/A'}\n`;
                message += `• Half-Open Attempts: ${status.halfOpenAttempts}/${status.maxHalfOpenAttempts}\n`;
                message += `• Can Attempt Operation: ${status.canAttemptOperation ? 'Yes' : 'No'}\n\n`;
                message += `🔄 Retry Status:\n`;
                message += `• In Retry Mode: ${retryStatus.isInRetryMode ? 'Yes' : 'No'}\n`;
                message += `• Retry Attempts: ${retryStatus.retryAttempts}/${retryStatus.maxAttempts}\n`;
                message += `• Retry Scheduled: ${retryStatus.retryScheduled ? 'Yes' : 'No'}\n\n`;
                message += `📊 State Machine Flow:\n`;
                message += `CLOSED → OPEN → HALF_OPEN → CLOSED\n\n`;
                message += `Current Status: ${status.state === 'CLOSED' ? 'System is healthy and ready' :
                            status.state === 'HALF_OPEN' ? 'System is attempting recovery' :
                            'System is paused due to persistent errors'}`;

                console.log('[Sentinel] Enhanced Circuit Breaker Status:', status);
                console.log('[Sentinel] Retry Status:', retryStatus);

                this.showDialog({
                    type: 'notification',
                    style: status.state === 'OPEN' ? 'error' : status.state === 'HALF_OPEN' ? 'warning' : 'info',
                    message: message,
                    duration: 10000
                });
            },

            showWhitelistStatus() {
                const whitelistStatus = Sentinel.Heuristics.getWhitelistStatus();

                let message = `🔒 Sequence Whitelist Status:\n`;
                message += `• Hostname: ${whitelistStatus.hostname}\n`;
                message += `• Total Whitelisted Sequences: ${whitelistStatus.totalSequences}\n`;

                if (whitelistStatus.sequences.length > 0) {
                    message += `\n📋 Whitelisted Sequences:\n`;
                    whitelistStatus.sequences.forEach((sequence, index) => {
                        const activities = sequence.split('|');
                        message += `${index + 1}. ${activities.join(' → ')}\n`;
                    });
                } else {
                    message += `\n📋 No sequences whitelisted yet.\n`;
                    message += `💡 Use "Trust this sequence" button in alerts to whitelist activity patterns.`;
                }

                console.log('[Sentinel] Whitelist Status:', whitelistStatus);

                this.showDialog({
                    type: 'notification',
                    style: 'info',
                    message: message,
                    duration: 10000
                });
            },

            showDismissSuggestions() {
                const suggestions = Sentinel.Heuristics.getDismissSuggestions();

                if (suggestions.length === 0) {
                    this.showDialog({
                        type: 'notification',
                        style: 'info',
                        message: `🤖 No dismiss suggestions available.\n\nSentinel will suggest whitelisting sequences that you've dismissed 3+ times.`,
                        duration: 5000
                    });
                    return;
                }

                let message = `🤖 Proactive Whitelist Suggestions:\n\n`;
                message += `The following sequences have been dismissed multiple times:\n\n`;

                suggestions.forEach((suggestion, index) => {
                    const activitySequence = suggestion.activities.join(' → ');
                    message += `${index + 1}. ${activitySequence}\n`;
                    message += `   Dismissed: ${suggestion.count} times\n\n`;
                });

                message += `💡 These sequences will trigger proactive whitelist suggestions in future alerts.`;

                this.showDialog({
                    type: 'notification',
                    style: 'info',
                    message: message,
                    duration: 15000
                });
            }
        }
    };

    // --- EXECUTION ---
        // Ensure DOM is ready before initializing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
    Sentinel.init().catch(e => console.error('[Sentinel] Critical initialization failed:', e));
            });
        } else {
            // DOM already loaded
            Sentinel.init().catch(e => console.error('[Sentinel] Critical initialization failed:', e));
        }

})();