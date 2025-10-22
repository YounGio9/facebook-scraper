import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScraperController } from './scraper.controller';
import { ScraperService } from './scraper.service';
import { BrowserService } from './services/browser.service';
import { FacebookService } from './services/facebook.service';
import { FacebookScraperService } from './services/facebook-scraper.service';
import { CookieService } from './services/cookie.service';
import { PostsRepositoryService } from './services/posts-repository.service';
import { GroupPostEntity } from './entities/group-post.entity';
import { CommentEntity } from './entities/comment.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([GroupPostEntity, CommentEntity]),
  ],
  controllers: [ScraperController],
  providers: [
    ScraperService,
    BrowserService,
    FacebookService,
    FacebookScraperService,
    CookieService,
    PostsRepositoryService,
  ],
})
export class ScraperModule {}
