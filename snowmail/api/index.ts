import { VercelRequest, VercelResponse } from '@vercel/node';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

let app: any;

export default async (req: VercelRequest, res: VercelResponse) => {
  if (!app) {
    const server = express();
    app = await NestFactory.create(AppModule, new ExpressAdapter(server));
    await app.init();
  }

  return app(req, res);
};
