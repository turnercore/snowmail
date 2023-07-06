import { Injectable, OnModuleInit } from '@nestjs/common';
import { Configuration, OpenAIApi } from 'openai';
import dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class OpenAIService implements OnModuleInit {
  private readonly openai: OpenAIApi;

  constructor() {
    const apiKey = process.env.OPENAI_API;
    if (!apiKey) {
      throw new Error('OPENAI_API environment variable is not set');
    }
    const configuration = new Configuration({
      apiKey,
    });
    this.openai = new OpenAIApi(configuration);
  }

  onModuleInit() {
    if (!process.env.OPENAI_API) {
      throw new Error('OPENAI_API environment variable is not set');
    }
  }

  async moderate(data: any) {
    try {
      if (!data.content) {
        throw new Error('Content is required');
      }
      const moderationResult = await this.openai.createModeration({
        input: data.content,
      });
      return moderationResult.data;
    } catch (error: any) {
      throw new Error(`Failed to moderate content: ${error.message}`);
    }
  }

  async rewrite(content: string, tone = 'professional, friendly') {
    const systemMessage = `You are an AI language model. Your task is to rewrite the following content in a ${tone} tone: "${content}"`;
    try {
      if (!content || content.length <= 0) {
        throw new Error('Content is required');
      }
      const completion = await this.openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: content },
        ],
      });
      if (
        !completion.data ||
        !completion.data.choices ||
        !completion.data.choices[0] ||
        !completion.data.choices[0].message
      ) {
        throw new Error('Unexpected response from OpenAI API');
      }
      const body = completion.data.choices[0].message.content;
      const subject = '';
      return { body, subject };
    } catch (error: any) {
      throw new Error(`Failed to rewrite content: ${error.message}`);
    }
  }

  async extractLinks(content: string) {
    const systemMessage = `You are an AI language model. Your task is to extract all the links from the following HTML content that seem to be articles that a user might want to save to read later: "${content}"`;
    try {
      if (!content || content.length <= 0) {
        throw new Error('Content is required');
      }
      const completion = await this.openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: content },
        ],
      });
      if (
        !completion.data ||
        !completion.data.choices ||
        !completion.data.choices[0] ||
        !completion.data.choices[0].message
      ) {
        throw new Error('Unexpected response from OpenAI API');
      }
      const extractedLinks = JSON.parse(
        completion.data.choices[0].message.content,
      );
      return extractedLinks;
    } catch (error: any) {
      throw new Error(`Failed to extract links: ${error.message}`);
    }
  }
}
