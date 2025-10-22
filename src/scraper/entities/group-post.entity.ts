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

  @Column({ type: 'varchar', nullable: true })
  author_name: string;

  @Column({ type: 'text', nullable: true })
  author_url: string;

  @Column({ type: 'text', nullable: true })
  url: string;

  @Column({ type: 'varchar', nullable: true })
  content_hash: string;

  @Column({ type: 'timestamp', nullable: true })
  timestamp: Date;

  @Column({ type: 'int', default: 0 })
  likes_count: number;

  @Column({ type: 'int', default: 0 })
  comments_count: number;

  @Column({ type: 'int', default: 0 })
  shares_count: number;

  @Column({ type: 'simple-array', nullable: true })
  images: string[];

  @Column({ type: 'varchar', nullable: true })
  title: string;

  @Column({ type: 'varchar', nullable: true })
  price: string;

  @Column({ type: 'varchar', nullable: true })
  location: string;

  @OneToMany(() => CommentEntity, (comment) => comment.post, { cascade: true, eager: true })
  comments: CommentEntity[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
