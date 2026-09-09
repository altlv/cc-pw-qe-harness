export interface AppConfig {
  /** Folder name under apps/, and the Playwright project name. */
  name: string;
  /** One line: what this app is and why it is in the harness. */
  description: string;
  baseURL: string;
  /**
   * CSS scope for page scanning. Without it a scan of a documentation site
   * returns eighty nav links and buries the app's own controls.
   */
  scanScope?: string;
  /** Set when the harness bundles the app itself. */
  webServer?: { command: string; port: number };
  /**
   * True for third-party sites. Excluded from the default run and from CI —
   * a suite that goes red because someone else's site is down teaches the
   * team to ignore red.
   */
  external?: boolean;
}
