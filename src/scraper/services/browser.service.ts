import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Builder, WebDriver, Capabilities } from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome';

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserService.name);
  private driver: WebDriver | null = null;

  constructor(private readonly configService: ConfigService) {}

  async initializeBrowser(): Promise<WebDriver> {
    try {
      this.logger.log('Initializing Chrome browser...');

      // Configure Chrome options
      const options = new chrome.Options();

      // Get headless mode from environment
      const isHeadless = this.configService.get<string>('BROWSER_HEADLESS') === 'true';

      if (isHeadless) {
        options.addArguments('--headless');
      }

      // Add common arguments to avoid detection
      options.addArguments('--disable-blink-features=AutomationControlled');
      options.addArguments('--disable-dev-shm-usage');
      options.addArguments('--no-sandbox');
      options.addArguments('--window-size=1920,1080');
      options.addArguments('--start-maximized');

      // Set user agent to avoid bot detection
      options.addArguments('user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Exclude automation switches
      options.excludeSwitches(['enable-automation']);
      options.addArguments('--disable-blink-features=AutomationControlled');

      // Build the driver
      this.driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

      this.logger.log('Browser initialized successfully');

      return this.driver;
    } catch (error) {
      this.logger.error(`Failed to initialize browser: ${error.message}`);
      throw error;
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.driver) {
      this.logger.log('Closing browser...');
      await this.driver.quit();
      this.driver = null;
      this.logger.log('Browser closed');
    }
  }

  async onModuleDestroy() {
    await this.closeBrowser();
  }

  getDriver(): WebDriver | null {
    return this.driver;
  }
}
