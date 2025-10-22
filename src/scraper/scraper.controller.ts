import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { LoginDto } from './dto/login.dto';
import { GroupPostsDto } from './dto/group-posts.dto';

@Controller('scraper')
export class ScraperController {
  private readonly logger = new Logger(ScraperController.name);

  constructor(private readonly scraperService: ScraperService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    this.logger.log('Login request received');
    return this.scraperService.loginToFacebook(loginDto);
  }

  @Post('group-posts')
  async getGroupPosts(@Body() groupPostsDto: GroupPostsDto) {
    this.logger.log(`Group posts request received for group: ${groupPostsDto.groupId}`);
    return this.scraperService.getGroupPosts(groupPostsDto);
  }

  @Post('close-browser')
  async closeBrowser() {
    this.logger.log('Close browser request received');
    return this.scraperService.closeBrowser();
  }
}
