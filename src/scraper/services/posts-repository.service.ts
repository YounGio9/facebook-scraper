import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GroupPost as GroupPostModel } from '@prisma/client';
import { GroupPost } from '../dto/group-posts.dto';
import * as crypto from 'crypto';

@Injectable()
export class PostsRepositoryService {
  private readonly logger = new Logger(PostsRepositoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a hash for post content to identify duplicates when URL is not available
   */
  generateContentHash(post: GroupPost): string {
    const content = `${post.author_name || ''}|${post.text || ''}|${post.timestamp?.toISOString() || ''}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check if a post already exists in the database by URL or content hash
   */
  async isPostExists(post: GroupPost): Promise<boolean> {
    try {
      const contentHash = this.generateContentHash(post);

      // Check by URL first (if available)
      if (post.url) {
        const existingByUrl = await this.prisma.groupPost.findFirst({
          where: { url: post.url },
        });
        if (existingByUrl) {
          this.logger.debug(`Post already exists with URL: ${post.url}`);
          return true;
        }
      }

      // Check by content hash
      const existingByHash = await this.prisma.groupPost.findFirst({
        where: { content_hash: contentHash },
      });

      if (existingByHash) {
        this.logger.debug(`Post already exists with content hash: ${contentHash}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error checking post existence: ${error.message}`);
      return false;
    }
  }

  /**
   * Save a post to the database with its comments
   */
  async savePost(post: GroupPost): Promise<GroupPostModel | null> {
    try {
      // Check if post already exists
      const exists = await this.isPostExists(post);
      if (exists) {
        this.logger.debug(`Skipping duplicate post: ${post.url || 'no URL'}`);
        return null;
      }

      // Save post with comments using Prisma's nested write
      const savedPost = await this.prisma.groupPost.create({
        data: {
          text: post.text,
          author_name: post.author_name || null,
          author_url: post.author_url || null,
          url: post.url || null,
          content_hash: this.generateContentHash(post),
          timestamp: post.timestamp || null,
          likes_count: post.likes_count || 0,
          comments_count: post.comments_count || 0,
          shares_count: post.shares_count || 0,
          images: post.images || [],
          title: post.title || null,
          price: post.price || null,
          location: post.location || null,
          comments: {
            create: post.comments?.map(comment => ({
              author_name: comment.author_name || null,
              author_url: comment.author_url || null,
              text: comment.text,
              likes_count: comment.likes_count || 0,
              timestamp: comment.timestamp || null,
            })) || [],
          },
        },
        include: {
          comments: true,
        },
      });

      this.logger.log(`Saved post: ${savedPost.id} with ${savedPost.comments.length} comments`);
      return savedPost;
    } catch (error) {
      this.logger.error(`Error saving post: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Get all posts from the database
   */
  async getAllPosts(): Promise<GroupPostModel[]> {
    try {
      return await this.prisma.groupPost.findMany({
        include: {
          comments: true,
        },
        orderBy: {
          created_at: 'desc',
        },
      });
    } catch (error) {
      this.logger.error(`Error getting all posts: ${error.message}`);
      return [];
    }
  }

  /**
   * Get posts count
   */
  async getPostsCount(): Promise<number> {
    try {
      return await this.prisma.groupPost.count();
    } catch (error) {
      this.logger.error(`Error getting posts count: ${error.message}`);
      return 0;
    }
  }

  /**
   * Delete all posts (for testing purposes)
   */
  async deleteAllPosts(): Promise<void> {
    try {
      await this.prisma.groupPost.deleteMany();
      this.logger.log('All posts deleted');
    } catch (error) {
      this.logger.error(`Error deleting all posts: ${error.message}`);
    }
  }
}
