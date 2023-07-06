import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { OpenAIService } from './services/openai.service';

@Controller('email')
export class EmailController {
  constructor(
    private emailService: EmailService,
    private openaiService: OpenAIService,
  ) {}

  @Post('process')
  async processEmail(@Body() data: any) {
    const response = await this.emailService.processEmail(data);
    return response;
  }

  @Post('extract-links')
  async extractLinks(@Body('content') content: string) {
    const links = await this.openaiService.extractLinks(content);
    return links;
  }

  @Post('add-links-to-pocket')
  async addLinksToPocket(@Body('links') links: string[]) {
    await this.emailService.addLinksToPocket(links);
    return { message: 'Links added to Pocket successfully' };
  }
}
