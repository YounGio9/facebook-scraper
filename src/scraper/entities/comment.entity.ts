import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { GroupPostEntity } from './group-post.entity';

@Entity('comments')
export class CommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GroupPostEntity, (post) => post.comments, { onDelete: 'CASCADE' })
  post: GroupPostEntity;

  @Column({ nullable: true })
  author_name: string | null;

  @Column({ nullable: true, type: 'text' })
  author_url: string | null;

  @Column({ type: 'text' })
  text: string;

  @Column({ default: 0 })
  likes_count: number;

  @Column({ type: 'timestamp', nullable: true })
  timestamp: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
