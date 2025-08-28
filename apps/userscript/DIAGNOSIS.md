# Userscript Issue Diagnosis and Fixes

## Root Causes

1. **Missing Tampermonkey Types**: The project was referencing `greasemonkey` types which weren't available, causing TS2304 errors for `GM_*` functions.

2. **DOM Typing Issues**: Direct access to `Element.title` was causing TS2339 errors because `title` property doesn't exist on the base `Element` type.

3. **Missing cSpell Dictionary Entry**: The word "jsaction" was not in the dictionary, causing cSpell errors.

## Fixes Applied

### 1. Switched to Tampermonkey Types
- Installed `@types/tampermonkey` as a dev dependency
- Updated `tsconfig.json` to use `["tampermonkey", "node"]` instead of `["greasemonkey"]`
- Added triple-slash references to files using `GM_*` functions:
  - `src/extractor.ts`
  - `src/transport.ts`

### 2. Fixed DOM Typing Issues
- Created a helper function `getElementTitle()` to safely access the title attribute
- Replaced direct `titleElement?.title` access with proper type checking
- Added `globals.d.ts` with fallback declarations for `GM_*` functions

### 3. Updated cSpell Dictionary
- Added "jsaction" to the words list in `cspell.json`

## Verification

- ✅ TypeScript compilation passes with no errors
- ✅ Build succeeds and produces `dist/argus.user.js`
- ✅ All GM_* functions are properly typed
- ✅ DOM access is properly typed
- ✅ cSpell no longer reports "jsaction" as an unknown word

## Residual Issues

None identified. All originally reported issues have been resolved.
