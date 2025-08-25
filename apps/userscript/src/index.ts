// ==UserScript==
// @name         Argus Google Maps Reviews
// @namespace    https://github.com/BoxBoxmari/Project-Argus
// @version      0.1.0
// @description  Extract Google Maps reviews data
// @author       Project Argus
// @match        https://www.google.com/maps/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_download
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_getResourceURL
// ==/UserScript==

import { ArgusExtractor } from './extractor';
export * from './progress';
export * from './storage';

(function() {
    'use strict';
    
    const extractor = new ArgusExtractor();
    extractor.init();
})();
