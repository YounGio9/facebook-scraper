import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { GroupPostEntity } from './group-post.entity';

@Entity('comments')
export class CommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GroupPostEntity, (post) => post.comments, { onDelete: 'CASCADE' })
  post: GroupPostEntity;

  @Column({ type: 'varchar', nullable: true })
  author_name: string;

  @Column({ type: 'text', nullable: true })
  author_url: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'int', default: 0 })
  likes_count: number;

  @Column({ type: 'timestamp', nullable: true })
  timestamp: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
