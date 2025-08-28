// cspell:ignore Crawlee parsererror
/**
 * Type-safe DOM element guards and utilities
 * Following Crawlee methodology for resilient selector handling
 */

/**
 * Type guard to safely cast unknown nodes to Element
 * @param node - The node to check
 * @returns The node as Element if it's an Element, otherwise throws
 */
export const asElement = (node: unknown): Element => {
  if (!(node instanceof Element)) {
    throw new Error(`Expected Element, got ${typeof node}: ${node}`);
  }
  return node;
};

/**
 * Type guard to safely cast unknown nodes to HTMLElement
 * @param node - The node to check
 * @returns The node as HTMLElement if it's an HTMLElement, otherwise throws
 */
export const asHTMLElement = (node: unknown): HTMLElement => {
  if (!(node instanceof HTMLElement)) {
    throw new Error(`Expected HTMLElement, got ${typeof node}: ${node}`);
  }
  return node;
};

/**
 * Safe element finder with null checks
 * @param container - Container to search in
 * @param selector - CSS selector
 * @returns Element or null
 */
export const safeQuerySelector = (container: Element | Document, selector: string): Element | null => {
  try {
    return container.querySelector(selector);
  } catch (error) {
    console.warn(`Invalid selector "${selector}": ${error}`);
    return null;
  }
};

/**
 * Safe element finder that throws if not found
 * @param container - Container to search in
 * @param selector - CSS selector
 * @returns Element
 * @throws Error if element not found
 */
export const requireElement = (container: Element | Document, selector: string): Element => {
  const element = safeQuerySelector(container, selector);
  if (!element) {
    throw new Error(`Required element not found: ${selector}`);
  }
  return element;
};

/**
 * Safe text content extractor
 * @param element - Element to extract text from
 * @returns Trimmed text content or empty string
 */
export const safeTextContent = (element: Element | null): string => {
  if (!element || !element.textContent) {
    return '';
  }
  return element.textContent.trim();
};

/**
 * Safe attribute extractor
 * @param element - Element to extract attribute from
 * @param attr - Attribute name
 * @returns Attribute value or empty string
 */
export const safeGetAttribute = (element: Element | null, attr: string): string => {
  if (!element) {
    return '';
  }
  return element.getAttribute(attr) || '';
};

/**
 * Resilient selector strategy: try multiple selectors until one works
 * Following Crawlee's selector resilience pattern
 * @param container - Container to search in
 * @param selectors - Array of selectors to try in order
 * @returns First matching element or null
 */
export const resilientSelector = (container: Element | Document, selectors: string[]): Element | null => {
  for (const selector of selectors) {
    const element = safeQuerySelector(container, selector);
    if (element) {
      return element;
    }
  }
  return null;
};

/**
 * Wait for element to appear (for async tests)
 * @param container - Container to search in
 * @param selector - CSS selector
 * @param timeout - Timeout in milliseconds
 * @returns Promise that resolves to element or rejects
 */
export const waitForElement = (
  container: Element | Document,
  selector: string,
  timeout: number = 5000
): Promise<Element> => {
  return new Promise((resolve, reject) => {
    const element = safeQuerySelector(container, selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = safeQuerySelector(container, selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(container as Node, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element not found within ${timeout}ms: ${selector}`));
    }, timeout);
  });
};

/**
 * Create a safe DOM parser for test fixtures
 * @param html - HTML string to parse
 * @returns Document object
 */
export const createTestDocument = (html: string): Document => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Validate that parsing was successful
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`Failed to parse HTML: ${parserError.textContent}`);
  }

  return doc;
};

/**
 * Simulate user scrolling for testing
 * @param element - Element to scroll
 * @param deltaY - Scroll amount
 */
export const simulateScroll = (element: Element, deltaY: number): void => {
  const scrollEvent = new WheelEvent('wheel', {
    deltaY,
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(scrollEvent);
};

/**
 * Type-safe array builder to avoid never[] inference issues
 * @param items - Items to collect
 * @returns Typed array
 */
export const collectItems = <T>(items: (T | null | undefined)[]): T[] => {
  const result: T[] = [];
  for (const item of items) {
    if (item !== null && item !== undefined) {
      result.push(item);
    }
  }
  return result;
};
