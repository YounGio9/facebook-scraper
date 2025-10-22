import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScraperController } from './scraper.controller';
import { ScraperService } from './scraper.service';
import { BrowserService } from './services/browser.service';
import { FacebookService } from './services/facebook.service';
import { FacebookScraperService } from './services/facebook-scraper.service';
import { CookieService } from './services/cookie.service';

@Module({
  imports: [ConfigModule],
  controllers: [ScraperController],
  providers: [
    ScraperService,
    BrowserService,
    FacebookService,
    FacebookScraperService,
    CookieService,
  ],
})
export class ScraperModule {}
