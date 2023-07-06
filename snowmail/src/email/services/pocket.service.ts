import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { map, firstValueFrom } from 'rxjs';

export interface PocketAddLinkDto {
  url: string;
  title: string;
  consumer_key: string;
  access_token: string;
}

@Injectable()
export class PocketService implements OnModuleInit {
  constructor(private httpService: HttpService) {}

  onModuleInit() {
    if (!process.env.POCKET_CONSUMER_KEY || !process.env.POCKET_ACCESS_TOKEN) {
      throw new Error(
        'POCKET_CONSUMER_KEY and/or POCKET_ACCESS_TOKEN environment variables are not set',
      );
    }
  }

  async addLinkToPocket(pocketAddLinkDto: PocketAddLinkDto) {
    const { url, title, consumer_key, access_token } = pocketAddLinkDto;

    const response$ = this.httpService.post(
      'https://getpocket.com/v3/add',
      {
        url,
        title,
        consumer_key,
        access_token,
      },
      {
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Accept': 'application/json',
        },
      },
    );

    const response = await firstValueFrom(
      response$.pipe(map((axiosResponse) => axiosResponse.data)),
    );

    return response;
  }
}
