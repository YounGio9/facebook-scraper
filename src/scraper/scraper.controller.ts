import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { LoginDto } from './dto/login.dto';

@Controller('scraper')
export class ScraperController {
  private readonly logger = new Logger(ScraperController.name);

  constructor(private readonly scraperService: ScraperService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    this.logger.log('Login request received');
    return this.scraperService.loginToFacebook(loginDto);
  }
}
