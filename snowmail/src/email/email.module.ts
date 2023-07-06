import { Module } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { OpenAIService } from './services/openai.service';
import { PocketService } from './services/pocket.service';
import { EmailController } from './email.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [EmailController],
  providers: [EmailService, OpenAIService, PocketService],
})
export class EmailModule {}
