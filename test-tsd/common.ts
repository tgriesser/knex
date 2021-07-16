import type { Knex } from "../types";

export const clientConfig: Knex.Config = {
  client: 'sqlite3',
  connection: {
    filename: './mydb.sqlite',
  },
};

export interface User {
  id: number;
  age: number;
  name: string;
  active: boolean;
  departmentId: number;
}

export interface Department {
  id: number;
  departmentName: string;
}

export interface Article {
  id: number;
  subject: string;
  body?: string;
  authorId?: string;
}

export interface Ticket {
  name: string;
  from: string;
  to: string;
  at: Date;
}

