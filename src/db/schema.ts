import { pgTable, serial, text, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name'),
  email: text('email'),
  age: integer('age'),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
