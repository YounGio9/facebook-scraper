import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrowserService } from './services/browser.service';
import { FacebookService } from './services/facebook.service';
import { CookieService } from './services/cookie.service';
import { LoginDto } from './dto/login.dto';
import { GroupPostsDto, GroupPostsResponse } from './dto/group-posts.dto';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private readonly COOKIE_FILENAME = 'facebook-session';

  constructor(
    private readonly configService: ConfigService,
    private readonly browserService: BrowserService,
    private readonly facebookService: FacebookService,
    private readonly cookieService: CookieService,
  ) {}

  async loginToFacebook(loginDto?: LoginDto) {
    try {
      this.logger.log('Starting Facebook login process...');

      // Get credentials from DTO or environment variables
      const email = loginDto?.email || this.configService.get<string>('FACEBOOK_EMAIL');
      const password = loginDto?.password || this.configService.get<string>('FACEBOOK_PASSWORD');

      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      // Initialize browser
      const driver = await this.browserService.initializeBrowser();

      // Perform Facebook login
      const result = await this.facebookService.login(driver, email, password);

      this.logger.log('Facebook login completed successfully');

      return {
        success: true,
        message: 'Login successful',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Login failed: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getGroupPosts(groupPostsDto: GroupPostsDto): Promise<GroupPostsResponse> {
    try {
      this.logger.log(`Fetching posts from group ${groupPostsDto.groupId}...`);

      // Get the existing driver or initialize a new one
      let driver = this.browserService.getDriver();

      if (!driver) {
        this.logger.log('No existing browser session found.');

        // Check if we have saved cookies
        const hasCookies = await this.cookieService.cookiesExist(this.COOKIE_FILENAME);

        if (hasCookies) {
          this.logger.log('Found saved cookies, initializing browser with session...');

          // Initialize browser
          driver = await this.browserService.initializeBrowser();

          // Navigate to Facebook (required to set cookies)
          await driver.get('https://www.facebook.com');
          await driver.sleep(2000);

          // Load cookies
          this.logger.log('Loading saved cookies...');
          await this.cookieService.loadCookies(driver, this.COOKIE_FILENAME);

          // Refresh to apply cookies
          await driver.navigate().refresh();
          await driver.sleep(3000);

          this.logger.log('Browser initialized with saved session');
        } else {
          this.logger.warn('No saved cookies found. Please login first using /scraper/login');
          throw new Error('No saved session found. Please login first using the /scraper/login endpoint');
        }
      } else {
        this.logger.log('Reusing existing browser session');
      }

      // TODO: Implement scraping logic here
      // The session is ready, now you can navigate to the group and scrape posts
      throw new Error('Scraping method not yet implemented');

    } catch (error) {
      this.logger.error(`Failed to get group posts: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async closeBrowser() {
    try {
      this.logger.log('Manually closing browser...');
      await this.browserService.closeBrowser();
      return {
        success: true,
        message: 'Browser closed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to close browser: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
