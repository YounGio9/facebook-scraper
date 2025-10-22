import { Injectable, Logger } from '@nestjs/common';
import { WebDriver, By, until, WebElement } from 'selenium-webdriver';
import { CookieService } from './cookie.service';

@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name);
  private readonly FACEBOOK_URL = 'https://www.facebook.com';
  private readonly TIMEOUT = 30000; // 30 seconds
  private readonly COOKIE_FILENAME = 'facebook-session';

  constructor(private readonly cookieService: CookieService) {}

  async login(driver: WebDriver, email: string, password: string) {
    try {
      // First, check if we have saved cookies
      const hasCookies = await this.cookieService.cookiesExist(this.COOKIE_FILENAME);

      if (hasCookies) {
        this.logger.log('Found saved cookies, attempting to reuse session...');

        // Navigate to Facebook first (cookies need a domain to be added to)
        await driver.get(this.FACEBOOK_URL);
        await driver.sleep(1000);

        // Load saved cookies
        await this.cookieService.loadCookies(driver, this.COOKIE_FILENAME);

        // Refresh to apply cookies
        await driver.navigate().refresh();
        await driver.sleep(3000);

        // Check if we're already logged in
        const isLoggedIn = await this.checkIfLoggedIn(driver);

        if (isLoggedIn) {
          this.logger.log('Session restored successfully! Already logged in.');
          const currentUrl = await driver.getCurrentUrl();
          return {
            status: 'success',
            message: 'Session restored from saved cookies. No login required!',
            url: currentUrl,
            usedCookies: true,
          };
        } else {
          this.logger.warn('Saved cookies are expired or invalid. Will perform fresh login.');
          await this.cookieService.deleteCookies(this.COOKIE_FILENAME);
        }
      }

      // If no cookies or cookies failed, do normal login
      this.logger.log('Performing fresh login to Facebook...');
      const loginResult = await this.performLogin(driver, email, password);

      // If login was successful, save cookies for next time
      if (loginResult.status === 'success' || loginResult.status === '2fa_required') {
        this.logger.log('Saving session cookies for future use...');
        await this.cookieService.saveCookies(driver, this.COOKIE_FILENAME);
      }

      return loginResult;

    } catch (error) {
      this.logger.error(`Login error: ${error.message}`);
      throw error;
    }
  }

  private async checkIfLoggedIn(driver: WebDriver): Promise<boolean> {
    try {
      const currentUrl = await driver.getCurrentUrl();
      const pageSource = await driver.getPageSource();

      // If we're NOT on login page and NOT on checkpoint, we're likely logged in
      const notOnLoginPage = !currentUrl.includes('login.php') &&
                             !currentUrl.includes('/login/');
      const notOnCheckpoint = !currentUrl.includes('checkpoint');

      // Additional check: look for elements that only appear when logged in
      const hasLoggedInElements = pageSource.includes('data-click="profile_icon"') ||
                                   pageSource.includes('Account Settings') ||
                                   pageSource.includes('Settings & privacy') ||
                                   currentUrl.includes('facebook.com/?');

      return notOnLoginPage && (notOnCheckpoint || hasLoggedInElements);
    } catch (error) {
      this.logger.warn(`Error checking login status: ${error.message}`);
      return false;
    }
  }

  private async performLogin(driver: WebDriver, email: string, password: string) {
    try {
      // Navigate to Facebook if not already there
      const currentUrl = await driver.getCurrentUrl();
      if (!currentUrl.includes('facebook.com')) {
        await driver.get(this.FACEBOOK_URL);
      }

      // Wait for page to load
      await driver.sleep(2000);

      this.logger.log('Looking for email input field...');

      // Find and fill email field
      const emailField = await this.findEmailField(driver);
      await emailField.clear();
      await emailField.sendKeys(email);
      this.logger.log('Email entered');

      // Small delay to mimic human behavior
      await driver.sleep(500);

      this.logger.log('Looking for password input field...');

      // Find and fill password field
      const passwordField = await this.findPasswordField(driver);
      await passwordField.clear();
      await passwordField.sendKeys(password);
      this.logger.log('Password entered');

      // Small delay to mimic human behavior
      await driver.sleep(500);

      this.logger.log('Looking for login button...');

      // Find and click login button
      const loginButton = await this.findLoginButton(driver);
      await loginButton.click();
      this.logger.log('Login button clicked');

      // Wait for navigation or error
      await driver.sleep(3000);

      // Check if login was successful
      const newUrl = await driver.getCurrentUrl();
      this.logger.log(`Current URL after login: ${newUrl}`);

      // Check for common error indicators
      const pageSource = await driver.getPageSource();

      if (pageSource.includes('Two-factor authentication') ||
          pageSource.includes('two_step_verification') ||
          newUrl.includes('checkpoint')) {
        this.logger.warn('2FA detected - waiting for user to complete verification...');

        // Wait up to 2 minutes for user to complete 2FA
        this.logger.log('Waiting for 2FA completion (up to 2 minutes)...');
        await driver.sleep(120000); // Wait 2 minutes

        // Save cookies after 2FA might be completed
        return {
          status: '2fa_required',
          message: '2FA detected. Cookies will be saved after you complete verification.',
          url: newUrl,
        };
      }

      if (pageSource.includes('The password that you') ||
          pageSource.includes('incorrect password') ||
          pageSource.includes('Wrong credentials')) {
        throw new Error('Invalid credentials provided');
      }

      // If we're on the homepage or feed, login was successful
      if (newUrl.includes('facebook.com') &&
          !newUrl.includes('login') &&
          !newUrl.includes('checkpoint')) {
        this.logger.log('Login successful!');
        return {
          status: 'success',
          message: 'Successfully logged into Facebook',
          url: newUrl,
        };
      }

      // Unknown state - keep browser open for manual inspection
      this.logger.warn('Login state unclear - keeping browser open');
      return {
        status: 'unknown',
        message: 'Login completed but final state is unclear. Check the browser.',
        url: newUrl,
      };

    } catch (error) {
      this.logger.error(`Login error: ${error.message}`);
      throw error;
    }
  }

  private async findEmailField(driver: WebDriver): Promise<WebElement> {
    // Try multiple possible selectors for email field
    const selectors = [
      By.id('email'),
      By.name('email'),
      By.css('input[type="text"][name="email"]'),
      By.css('input[type="email"]'),
      By.css('input[data-testid="royal_email"]'),
    ];

    for (const selector of selectors) {
      try {
        const element = await driver.wait(until.elementLocated(selector), 5000);
        if (element) {
          this.logger.log(`Email field found using selector: ${selector}`);
          return element;
        }
      } catch (error) {
        // Try next selector
        continue;
      }
    }

    throw new Error('Could not find email input field');
  }

  private async findPasswordField(driver: WebDriver): Promise<WebElement> {
    // Try multiple possible selectors for password field
    const selectors = [
      By.id('pass'),
      By.name('pass'),
      By.css('input[type="password"]'),
      By.css('input[data-testid="royal_pass"]'),
    ];

    for (const selector of selectors) {
      try {
        const element = await driver.wait(until.elementLocated(selector), 5000);
        if (element) {
          this.logger.log(`Password field found using selector: ${selector}`);
          return element;
        }
      } catch (error) {
        // Try next selector
        continue;
      }
    }

    throw new Error('Could not find password input field');
  }

  private async findLoginButton(driver: WebDriver): Promise<WebElement> {
    // Try multiple possible selectors for login button
    const selectors = [
      By.name('login'),
      By.css('button[type="submit"]'),
      By.css('button[name="login"]'),
      By.css('input[type="submit"]'),
      By.css('button[data-testid="royal_login_button"]'),
    ];

    for (const selector of selectors) {
      try {
        const element = await driver.wait(until.elementLocated(selector), 5000);
        if (element) {
          this.logger.log(`Login button found using selector: ${selector}`);
          return element;
        }
      } catch (error) {
        // Try next selector
        continue;
      }
    }

    throw new Error('Could not find login button');
  }
}
