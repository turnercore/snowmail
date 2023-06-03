import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmailController } from './email/email.controller';

@Module({
  imports: [],
  controllers: [AppController, EmailController],
  providers: [AppService],
})
export class AppModule {}
