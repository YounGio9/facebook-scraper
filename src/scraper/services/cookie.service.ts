import { Injectable, Logger } from '@nestjs/common';
import { WebDriver } from 'selenium-webdriver';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expiry?: number;
  httpOnly?: boolean;
  secure?: boolean;
}

@Injectable()
export class CookieService {
  private readonly logger = new Logger(CookieService.name);
  private readonly cookiesDir = path.join(process.cwd(), 'cookies');

  async saveCookies(driver: WebDriver, filename: string): Promise<void> {
    try {
      // Ensure cookies directory exists
      await this.ensureCookiesDirectory();

      // Get all cookies from the browser
      const cookies = await driver.manage().getCookies();

      // Save to file
      const cookiePath = path.join(this.cookiesDir, `${filename}.json`);
      await fs.writeFile(cookiePath, JSON.stringify(cookies, null, 2));

      this.logger.log(`Saved ${cookies.length} cookies to ${cookiePath}`);
    } catch (error) {
      this.logger.error(`Failed to save cookies: ${error.message}`);
      throw error;
    }
  }

  async loadCookies(driver: WebDriver, filename: string): Promise<boolean> {
    try {
      const cookiePath = path.join(this.cookiesDir, `${filename}.json`);

      // Check if cookie file exists
      try {
        await fs.access(cookiePath);
      } catch {
        this.logger.log(`No saved cookies found at ${cookiePath}`);
        return false;
      }

      // Read cookies from file
      const cookieData = await fs.readFile(cookiePath, 'utf-8');
      const cookies: Cookie[] = JSON.parse(cookieData);

      // Add each cookie to the browser
      for (const cookie of cookies) {
        try {
          await driver.manage().addCookie(cookie);
        } catch (error) {
          this.logger.warn(`Failed to add cookie ${cookie.name}: ${error.message}`);
        }
      }

      this.logger.log(`Loaded ${cookies.length} cookies from ${cookiePath}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to load cookies: ${error.message}`);
      return false;
    }
  }

  async deleteCookies(filename: string): Promise<void> {
    try {
      const cookiePath = path.join(this.cookiesDir, `${filename}.json`);
      await fs.unlink(cookiePath);
      this.logger.log(`Deleted cookies file: ${cookiePath}`);
    } catch (error) {
      this.logger.warn(`Failed to delete cookies: ${error.message}`);
    }
  }

  async cookiesExist(filename: string): Promise<boolean> {
    try {
      const cookiePath = path.join(this.cookiesDir, `${filename}.json`);
      await fs.access(cookiePath);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureCookiesDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.cookiesDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create cookies directory: ${error.message}`);
    }
  }
}
