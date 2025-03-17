import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

export const prisma: PrismaClient = new PrismaClient({
  datasourceUrl: `${process.env.DATABASE_URL}`,
});
