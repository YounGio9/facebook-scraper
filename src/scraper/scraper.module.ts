import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScraperController } from './scraper.controller';
import { ScraperService } from './scraper.service';
import { BrowserService } from './services/browser.service';
import { FacebookService } from './services/facebook.service';
import { CookieService } from './services/cookie.service';

@Module({
  imports: [ConfigModule],
  controllers: [ScraperController],
  providers: [ScraperService, BrowserService, FacebookService, CookieService],
})
export class ScraperModule {}
