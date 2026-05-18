import { pgTable, serial, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const conversationParticipantsTable = pgTable("conversation_participants", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversationsTable.id),
  userId: integer("user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversationsTable.id),
  senderId: integer("sender_id").references(() => usersTable.id),
  content: text("content").notNull(),
  messageType: varchar("message_type", { length: 50 }).default("text"),
  mediaData: text("media_data"),
  deletedForAll: boolean("deleted_for_all").default(false),
  deletedFor: text("deleted_for").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type Conversation = typeof conversationsTable.$inferSelect;
export type ConversationParticipant = typeof conversationParticipantsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
