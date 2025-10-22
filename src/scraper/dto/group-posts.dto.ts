export class GroupPostsDto {
  groupId: string;
  maxPosts?: number = 50;
  includeComments?: boolean = true;
  maxCommentsPerPost?: number = 20;
}

export interface Comment {
  author_name: string | null;
  author_url: string | null;
  text: string;
  likes_count: number;
  timestamp: Date | null;
}

export interface GroupPost {
  text: string;
  author_name: string | null;
  author_url: string | null;
  url: string | null;
  timestamp: Date | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  comments: Comment[];
  title?: string;
  price?: string;
  location?: string;
  images?: string[];
}

export interface GroupPostsResponse {
  success: boolean;
  message: string;
  data?: {
    name: string | null;
    member_count: number | null;
    posts: GroupPost[];
    posts_saved: number;
    posts_skipped: number;
  };
}
