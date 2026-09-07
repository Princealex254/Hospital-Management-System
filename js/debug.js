/**
 * PRINCE ALEX DIGITAL HMS — Debug Utility
 * 
 * Provides a simple debug logging mechanism.
 * Set DEBUG_MODE to false before production deployment.
 */

const DEBUG_MODE = true;

/**
 * Logs debug messages to the console when DEBUG_MODE is enabled.
 * @param {...*} messages - Messages to log
 */
function debug(...messages) {
    if (DEBUG_MODE) {
        console.log("[HMS DEBUG]", ...messages);
    }
}

/**
 * Logs debug warnings to the console when DEBUG_MODE is enabled.
 * @param {...*} messages - Messages to log
 */
function debugWarn(...messages) {
    if (DEBUG_MODE) {
        console.warn("[HMS DEBUG]", ...messages);
    }
}

/**
 * Logs debug errors to the console when DEBUG_MODE is enabled.
 * @param {...*} messages - Messages to log
 */
function debugError(...messages) {
    if (DEBUG_MODE) {
        console.error("[HMS DEBUG]", ...messages);
    }
}

export { DEBUG_MODE, debug, debugWarn, debugError };
