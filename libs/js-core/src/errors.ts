export class HardStop extends Error{};
export class NavError extends Error{};
export class XHRTapError extends Error{};
export const classify = (e:unknown)=> e instanceof HardStop?'HARD_STOP': e instanceof NavError?'NAV': e instanceof XHRTapError?'XHR':'GEN';
