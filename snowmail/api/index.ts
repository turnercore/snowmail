import { VercelRequest, VercelResponse } from '@vercel/node';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

let cachedServer: any;

const bootstrap = async () => {
  if (!cachedServer) {
    const server = express();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
    await app.init();
    cachedServer = server;
  }
  return cachedServer;
}

export default async (req: VercelRequest, res: VercelResponse) => {
  const server = await bootstrap();
  server(req, res);
};
