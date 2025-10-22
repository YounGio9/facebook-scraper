import { Injectable, Logger } from '@nestjs/common';
import { WebDriver, By, until, WebElement } from 'selenium-webdriver';
import { CookieService } from './cookie.service';

@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name);
  private readonly FACEBOOK_URL = 'https://www.facebook.com';
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

      // Only save cookies if login was fully successful (not if 2FA is pending)
      if (loginResult.status === 'success') {
        this.logger.log('Saving session cookies for future use...');
        try {
          await this.cookieService.saveCookies(driver, this.COOKIE_FILENAME);
        } catch (error) {
          this.logger.warn(`Failed to save cookies, but login was successful: ${error.message}`);
        }
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
      this.logger.log(`Checking login status at URL: ${currentUrl}`);

      // If we're on login page or checkpoint, definitely not logged in
      if (currentUrl.includes('login.php') || currentUrl.includes('/login/')) {
        this.logger.log('Detected login page in URL - NOT logged in');
        return false;
      }

      if (currentUrl.includes('checkpoint') && !currentUrl.includes('facebook.com/')) {
        this.logger.log('Detected checkpoint page - NOT logged in');
        return false;
      }

      // Check for ABSENCE of login form elements (best indicator)
      try {
        const emailField = await driver.findElements(By.id('email'));
        const passField = await driver.findElements(By.id('pass'));

        if (emailField.length > 0 && passField.length > 0) {
          this.logger.log('Found login form fields (email & password) - NOT logged in');
          return false;
        } else {
          this.logger.log('Login form fields NOT found - likely logged in');
        }
      } catch (error) {
        this.logger.warn(`Error checking for login form: ${error.message}`);
      }

      // Check for presence of feed or navigation elements (logged in indicator)
      try {
        const feedElements = await driver.findElements(By.css('div[role="feed"], div[role="main"], div[role="navigation"]'));
        if (feedElements.length > 0) {
          this.logger.log(`Found ${feedElements.length} feed/navigation elements - LOGGED IN`);
          return true;
        }
      } catch (error) {
        this.logger.warn(`Error checking for feed elements: ${error.message}`);
      }

      // Fallback: if we're on facebook.com main domain and not on login/checkpoint, assume logged in
      if (currentUrl.includes('facebook.com') &&
          !currentUrl.includes('login') &&
          !currentUrl.includes('checkpoint')) {
        this.logger.log('On Facebook main domain without login/checkpoint - assuming LOGGED IN');
        return true;
      }

      this.logger.log('Could not determine login status - defaulting to NOT logged in');
      return false;
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

        // Check if 2FA was completed
        try {
          this.logger.log('2FA wait complete, checking login status...');

          // Get current page state (no refresh needed - user already completed 2FA)
          const finalUrl = await driver.getCurrentUrl();
          this.logger.log(`Current URL: ${finalUrl}`);

          const isNowLoggedIn = await this.checkIfLoggedIn(driver);

          this.logger.log(`After 2FA wait - URL: ${finalUrl}, Logged in: ${isNowLoggedIn}`);

          if (isNowLoggedIn) {
            this.logger.log('2FA completed successfully!');
            return {
              status: 'success',
              message: '2FA completed successfully',
              url: finalUrl,
            };
          } else {
            this.logger.warn('2FA not completed or session expired');
            return {
              status: '2fa_required',
              message: '2FA detected but not completed. Please try logging in again.',
              url: finalUrl,
            };
          }
        } catch (error) {
          this.logger.error(`Error checking 2FA status: ${error.message}`);
          return {
            status: '2fa_required',
            message: '2FA detected. Session may have expired.',
            url: newUrl,
          };
        }
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
