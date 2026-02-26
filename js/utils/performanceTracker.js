// Copyright (c) 2026 Music Blocks Contributors
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the The GNU Affero General Public
// License as published by the Free Software Foundation; either
// version 3 of the License, or (at your option) any later version.
//
// You should have received a copy of the GNU Affero General Public
// License along with this library; if not, write to the Free Software
// Foundation, 51 Franklin Street, Suite 500 Boston, MA 02110-1335 USA

/*
   exported

   isPerformanceEnabled, startPerformanceTracking, endPerformanceTracking,
   getPerformanceStats, resetPerformanceStats, enterExecutionScope,
   exitExecutionScope
*/

/**
 * Performance Instrumentation Module (Phase 1)
 *
 * Developer-only, console-based performance tracking for Music Blocks.
 * Disabled by default — opt in via URL param or global flag:
 *   - URL: ?performance=true
 *   - JS:  window.DEBUG_PERFORMANCE = true
 *
 * Tracks:
 *   1. Total execution time (performance.now, fallback to Date.now)
 *   2. Memory usage delta (performance.memory when available)
 *   3. Max execution depth (lightweight scope enter/exit counter)
 *
 * This module does NOT alter execution logic, UI, or async behavior.
 */

// ── Internal State ──────────────────────────────────────────────────
// All state is module-scoped; nothing leaks to the global object
// except the explicitly exported functions.

let _startTime = 0;
let _endTime = 0;
let _executionTime = 0;

let _memoryStart = 0;
let _memoryEnd = 0;
let _memoryDelta = 0;
let _memorySupported = false;

let _maxDepth = 0;
let _currentDepth = 0;

// ── High-resolution timer helper ────────────────────────────────────
// Prefer performance.now() for sub-millisecond precision; fall back
// to Date.now() in environments that lack the Performance API.

const _now =
    typeof performance !== "undefined" && typeof performance.now === "function"
        ? () => performance.now()
        : () => Date.now();

// ── Memory helper ───────────────────────────────────────────────────
// performance.memory is a non-standard Chrome API. When unavailable
// we gracefully skip memory tracking (no errors, no polyfills).

function _getMemoryUsage() {
    if (
        typeof performance !== "undefined" &&
        performance.memory &&
        typeof performance.memory.usedJSHeapSize === "number"
    ) {
        _memorySupported = true;
        return performance.memory.usedJSHeapSize;
    }
    _memorySupported = false;
    return 0;
}

// ── Opt-in check ────────────────────────────────────────────────────
// Instrumentation is enabled ONLY when explicitly requested.
// Two activation methods:
//   1. URL query string: ?performance=true
//   2. Global flag:      window.DEBUG_PERFORMANCE === true

/**
 * Returns true if performance instrumentation is enabled.
 * @returns {boolean}
 */
function isPerformanceEnabled() {
    // Check global flag first (cheapest).
    if (typeof window !== "undefined" && window.DEBUG_PERFORMANCE === true) {
        return true;
    }

    // Check URL query parameter.
    try {
        if (typeof window !== "undefined" && window.location) {
            const params = new URLSearchParams(window.location.search);
            return params.get("performance") === "true";
        }
    } catch (_e) {
        // Swallow errors in restricted environments (e.g. Node tests).
    }

    return false;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Called at the start of a program run. Captures initial timestamps
 * and memory snapshot.
 * @returns {void}
 */
function startPerformanceTracking() {
    // Reset counters for a fresh run.
    _currentDepth = 0;
    _maxDepth = 0;
    _executionTime = 0;
    _memoryDelta = 0;

    _startTime = _now();
    _memoryStart = _getMemoryUsage();
}

/**
 * Called when a program run completes. Captures final timestamps,
 * computes deltas, and logs results to the console.
 * @returns {void}
 */
function endPerformanceTracking() {
    _endTime = _now();
    _executionTime = _endTime - _startTime;

    _memoryEnd = _getMemoryUsage();
    if (_memorySupported) {
        _memoryDelta = _memoryEnd - _memoryStart;
    }

    // Output formatted stats to the developer console.
    _logPerformanceStats();
}

/**
 * Returns the most recent performance statistics as a plain object.
 * Useful for programmatic inspection in the console or tests.
 * @returns {Object}
 */
function getPerformanceStats() {
    return {
        executionTime: _executionTime,
        memoryDelta: _memorySupported ? _memoryDelta : null,
        memorySupported: _memorySupported,
        maxDepth: _maxDepth
    };
}

/**
 * Resets all internal state. Call between runs if needed.
 * @returns {void}
 */
function resetPerformanceStats() {
    _startTime = 0;
    _endTime = 0;
    _executionTime = 0;
    _memoryStart = 0;
    _memoryEnd = 0;
    _memoryDelta = 0;
    _memorySupported = false;
    _maxDepth = 0;
    _currentDepth = 0;
}

// ── Depth Tracking ──────────────────────────────────────────────────
// Lightweight enter/exit helpers for tracking maximum execution depth.
// These do NOT modify the interpreter's recursion model — they simply
// count how deep the block-execution call stack goes.

/**
 * Increment the current execution depth and update the max if needed.
 * Call at the entry point of each block-execution scope.
 * @returns {void}
 */
function enterExecutionScope() {
    _currentDepth++;
    if (_currentDepth > _maxDepth) {
        _maxDepth = _currentDepth;
    }
}

/**
 * Decrement the current execution depth, clamped to zero.
 * Call at every exit point of each block-execution scope.
 * @returns {void}
 */
function exitExecutionScope() {
    if (_currentDepth > 0) {
        _currentDepth--;
    }
}

// ── Console Output ──────────────────────────────────────────────────
// Uses console.groupCollapsed when available for a tidy output.

function _logPerformanceStats() {
    const groupFn =
        typeof console.groupCollapsed === "function"
            ? console.groupCollapsed
            : console.group || console.log;
    const groupEnd = typeof console.groupEnd === "function" ? console.groupEnd : function () {};

    try {
        // eslint-disable-next-line no-console
        groupFn.call(console, "🎵 Music Blocks Performance Stats");
        // eslint-disable-next-line no-console
        console.log("  Execution Time : " + _executionTime.toFixed(2) + " ms");
        // eslint-disable-next-line no-console
        console.log(
            "  Memory Delta   : " + (_memorySupported ? _memoryDelta + " bytes" : "unsupported")
        );
        // eslint-disable-next-line no-console
        console.log("  Max Exec Depth : " + _maxDepth);
        // eslint-disable-next-line no-console
        groupEnd.call(console);
    } catch (_e) {
        // Graceful fallback — never break the app over logging.
    }
}

// ── Module Exports (Node / test environments) ───────────────────────

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        isPerformanceEnabled,
        startPerformanceTracking,
        endPerformanceTracking,
        getPerformanceStats,
        resetPerformanceStats,
        enterExecutionScope,
        exitExecutionScope
    };
}
