declare module 'robots-txt-parse' {
  export interface Rule {
    type: string;
    path: string;
  }

  export interface Group {
    userAgent: string[];
    rules: Rule[];
  }

  export interface ParsedRobots {
    groups: Group[];
  }

  export function parse(text: string): ParsedRobots;
}
