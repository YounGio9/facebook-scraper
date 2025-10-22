import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroupPostEntity } from '../entities/group-post.entity';
import { CommentEntity } from '../entities/comment.entity';
import { GroupPost } from '../dto/group-posts.dto';
import * as crypto from 'crypto';

@Injectable()
export class PostsRepositoryService {
  private readonly logger = new Logger(PostsRepositoryService.name);

  constructor(
    @InjectRepository(GroupPostEntity)
    private readonly postsRepository: Repository<GroupPostEntity>,
    @InjectRepository(CommentEntity)
    private readonly commentsRepository: Repository<CommentEntity>,
  ) {}

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
        const existingByUrl = await this.postsRepository.findOne({
          where: { url: post.url },
        });
        if (existingByUrl) {
          this.logger.debug(`Post already exists with URL: ${post.url}`);
          return true;
        }
      }

      // Check by content hash
      const existingByHash = await this.postsRepository.findOne({
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
  async savePost(post: GroupPost): Promise<GroupPostEntity | null> {
    try {
      // Check if post already exists
      const exists = await this.isPostExists(post);
      if (exists) {
        this.logger.debug(`Skipping duplicate post: ${post.url || 'no URL'}`);
        return null;
      }

      // Create post entity
      const postEntity = new GroupPostEntity();
      postEntity.text = post.text;
      postEntity.author_name = post.author_name;
      postEntity.author_url = post.author_url;
      postEntity.url = post.url;
      postEntity.content_hash = this.generateContentHash(post);
      postEntity.timestamp = post.timestamp;
      postEntity.likes_count = post.likes_count;
      postEntity.comments_count = post.comments_count;
      postEntity.shares_count = post.shares_count;
      postEntity.images = post.images || [];
      postEntity.title = post.title || null;
      postEntity.price = post.price || null;
      postEntity.location = post.location || null;

      // Create comment entities
      const commentEntities: CommentEntity[] = [];
      if (post.comments && post.comments.length > 0) {
        for (const comment of post.comments) {
          const commentEntity = new CommentEntity();
          commentEntity.author_name = comment.author_name;
          commentEntity.author_url = comment.author_url;
          commentEntity.text = comment.text;
          commentEntity.likes_count = comment.likes_count;
          commentEntity.timestamp = comment.timestamp;
          commentEntity.post = postEntity;
          commentEntities.push(commentEntity);
        }
      }

      postEntity.comments = commentEntities;

      // Save post with comments (cascade will save comments automatically)
      const savedPost = await this.postsRepository.save(postEntity);
      this.logger.log(`Saved post: ${savedPost.id} with ${commentEntities.length} comments`);

      return savedPost;
    } catch (error) {
      this.logger.error(`Error saving post: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Get all posts from the database
   */
  async getAllPosts(): Promise<GroupPostEntity[]> {
    try {
      return await this.postsRepository.find({
        relations: ['comments'],
        order: { created_at: 'DESC' },
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
      return await this.postsRepository.count();
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
      await this.postsRepository.clear();
      this.logger.log('All posts deleted');
    } catch (error) {
      this.logger.error(`Error deleting all posts: ${error.message}`);
    }
  }
}
