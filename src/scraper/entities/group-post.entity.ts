import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { CommentEntity } from './comment.entity';

@Entity('group_posts')
@Index('idx_post_url', ['url'], { unique: true, where: 'url IS NOT NULL' })
@Index('idx_content_hash', ['content_hash'], { unique: true, where: 'content_hash IS NOT NULL' })
export class GroupPostEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ nullable: true })
  author_name: string | null;

  @Column({ nullable: true, type: 'text' })
  author_url: string | null;

  @Column({ nullable: true, type: 'text', unique: false })
  url: string | null;

  @Column({ nullable: true })
  content_hash: string | null;

  @Column({ type: 'timestamp', nullable: true })
  timestamp: Date | null;

  @Column({ default: 0 })
  likes_count: number;

  @Column({ default: 0 })
  comments_count: number;

  @Column({ default: 0 })
  shares_count: number;

  @Column({ type: 'simple-array', nullable: true })
  images: string[];

  @Column({ nullable: true })
  title: string | null;

  @Column({ nullable: true })
  price: string | null;

  @Column({ nullable: true })
  location: string | null;

  @OneToMany(() => CommentEntity, (comment) => comment.post, { cascade: true, eager: true })
  comments: CommentEntity[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
