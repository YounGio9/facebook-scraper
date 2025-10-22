import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrowserService } from './services/browser.service';
import { FacebookService } from './services/facebook.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly browserService: BrowserService,
    private readonly facebookService: FacebookService,
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
}
