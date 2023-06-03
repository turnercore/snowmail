import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Configuration, OpenAIApi } from 'openai';
import dotenv from 'dotenv';
dotenv.config();
//test for github
@Controller('email')
export class EmailController {
  private readonly openai: OpenAIApi;

  constructor() {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API,
    });
    this.openai = new OpenAIApi(configuration);
  }

  @Post('moderate')
  async moderate(@Body('content') content: string) {
    try {
      // Send the content to the OpenAI moderation endpoint
      const moderationResult = await this.openai.createModeration({
        input: content,
      });

      // Return the moderation result
      return moderationResult.data;
    } catch (error) {
      // Catch and handle any errors that occur during the moderation request
      throw new HttpException(
        `Failed to moderate content: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
