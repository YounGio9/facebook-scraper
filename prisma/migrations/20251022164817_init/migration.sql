-- CreateTable
CREATE TABLE "group_posts" (
    "id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "author_name" VARCHAR,
    "author_url" TEXT,
    "url" TEXT,
    "content_hash" VARCHAR,
    "timestamp" TIMESTAMP(3),
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "comments_count" INTEGER NOT NULL DEFAULT 0,
    "shares_count" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT[],
    "title" VARCHAR,
    "price" VARCHAR,
    "location" VARCHAR,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "author_name" VARCHAR,
    "author_url" TEXT,
    "text" TEXT NOT NULL,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "post_id" UUID NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_post_url" ON "group_posts"("url");

-- CreateIndex
CREATE INDEX "idx_content_hash" ON "group_posts"("content_hash");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "group_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
