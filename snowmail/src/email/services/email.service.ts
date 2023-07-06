import { Injectable, OnModuleInit } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { PocketService, PocketAddLinkDto } from './pocket.service';

@Injectable()
export class EmailService {
  constructor(
    private openaiService: OpenAIService,
    private pocketService: PocketService,
  ) {}

  async processEmail(data: any) {
    try {
      const moderationResult = await this.openaiService.moderate(data);

      const flagged = moderationResult.results.some((result) => result.flagged);

      const flags = [];
      let response = {
        flagged: false,
        flags: [],
        rewriteBody: '',
        rewriteSubject: '',
      };

      if (flagged) {
        for (const result of moderationResult.results) {
          if (result.flagged) {
            for (const category in result.categories) {
              if (result.categories[category]) {
                flags.push(category);
              }
            }
          }
        }
      }

      if (flagged) {
        const rewrite = await this.openaiService.rewrite(data.content);
        response = {
          flagged,
          flags,
          rewriteBody: rewrite.body,
          rewriteSubject: rewrite.subject,
        };
      }

      return response;
    } catch (error: any) {
      throw new Error(`Failed to process content: ${error.message}`);
    }
  }

  async addLinksToPocket(links: string[]) {
    const pocketAddLinkDto: PocketAddLinkDto = {
      url: '',
      title: '',
      consumer_key: process.env.POCKET_CONSUMER_KEY || '',
      access_token: process.env.POCKET_ACCESS_TOKEN || '',
    };

    for (const link of links) {
      pocketAddLinkDto.url = link;
      pocketAddLinkDto.title = link;
      await this.pocketService.addLinkToPocket(pocketAddLinkDto);
    }
  }
}
