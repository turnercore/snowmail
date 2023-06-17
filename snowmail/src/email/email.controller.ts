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
import {
  threatDetectorSystemMessage,
  rewriteSystemMessage,
} from '../consts/systemMessages';
import { Request } from 'express';
import crypto from 'crypto';

// Mailgun
import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { Resolution } from 'mailgun.js/Enums';
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY || '',
});
const mailgunDomain = process.env.MAILGUN_DOMAIN || '';
// Forward email address
const forwardEmail = process.env.FORWARD_EMAIL || '';

interface MailgunWebhookPayload {
  signature: string;
  recipient: string;
  sender: string;
  subject: string;
  'body-plain': string;
  timestamp: string;
  token: string;
  'body-html': string;
  // additional fields that you expect from the Mailgun webhook payload
}

@Controller('email')
export class EmailController {
  private readonly openai: OpenAIApi;
  // Initialize the OpenAI API client
  constructor() {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API,
    });
    this.openai = new OpenAIApi(configuration);
  }

  // Process is the main method that will be called by the Snowmail app
  async process(data: any) {
    try {
      console.log('Processing data: ' + JSON.stringify(data));
      // Call the moderate method to get the moderation result
      const moderationResult = await this.moderate(data);

      // Check if content is flagged
      const flagged = moderationResult.results.some((result) => result.flagged);

      // If the content was flagged by first-pass moderation, get the flags.
      // eslint-disable-next-line prefer-const
      let flags = [];
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
      // If the content is flagged, rewrite content. Return the flagged result and the rewritten content
      if (flagged) {
        const rewrite = await this.rewrite(data.content);
        response = {
          flagged,
          flags,
          rewriteBody: rewrite.body,
          rewriteSubject: rewrite.subject,
        };
      }

      // The content is flagged, send the processed email back
      const domain = mailgunDomain;
      const fromEmail = data.sender; // adjust this to be your "from" email
      const toEmails = [forwardEmail];
      const subject = response.rewriteSubject || data.subject;
      const htmlBody = response.rewriteBody || data.content;
      const textBody = response.rewriteSubject || data.content;

      const sendEmailResult = await sendEmail(
        domain,
        fromEmail,
        toEmails,
        subject,
        htmlBody,
        textBody,
      );

      return response;
    } catch (error: any) {
      // Catch and handle any errors that occur during the moderation request
      throw new HttpException(
        `Failed to process content: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Basic first pass moderation method that calls the OpenAI API Modrate endpoint, returning a flag if the content is flagged
  async moderate(data: any) {
    try {
      // Make sure data has content
      if (!data.content) {
        throw new HttpException('Content is required', HttpStatus.BAD_REQUEST);
      }
      // Send the content to the OpenAI moderation endpoint
      const moderationResult = await this.openai.createModeration({
        input: data.content,
      });

      // Return the moderation result
      return moderationResult.data;
    } catch (error: any) {
      // Catch and handle any errors that occur during the moderation request
      throw new HttpException(
        `Failed to moderate content: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Rewrite method that calls the OpenAI API Complete endpoint, getting a rewritten version of the content
  async rewrite(content: string, tone = 'professional, friendly') {
    const systemMessage =
      rewriteSystemMessage + `In your rewritten message, use a ${tone} tone.`;
    try {
      let result;
      // Make sure content is provided
      if (!content || content.length <= 0) {
        throw new HttpException('Content is required', HttpStatus.BAD_REQUEST);
      } else {
        // Send the content to the OpenAI complete endpoint
        const completion = await this.openai.createChatCompletion({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: content },
          ],
        });

        // Check if the API response is as expected
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
        result.body = body;
        result.subject = subject;
        return result;
      }
    } catch (error: any) {
      // Catch and handle any errors that occur during the rewrite request
      throw new HttpException(
        `Failed to rewrite content: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Threats method that calls the OpenAI API Chat endpoint, getting a list of threats in the content
  async threats(content: string) {
    try {
      // Make sure content is provided
      if (!content || content.length <= 0) {
        throw new HttpException('Content is required', HttpStatus.BAD_REQUEST);
      } else {
        const systemMessage = threatDetectorSystemMessage;
        // Send the content to the OpenAI complete endpoint
        const completion = await this.openai.createChatCompletion({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: content },
          ],
        });

        // Check if the API response is as expected
        if (
          !completion.data ||
          !completion.data.choices ||
          !completion.data.choices[0] ||
          !completion.data.choices[0].message
        ) {
          throw new Error('Unexpected response from OpenAI API');
        }

        return completion.data.choices[0].message.content;
      }
    } catch (error: any) {
      // Catch and handle any errors that occur during the rewrite request
      throw new HttpException(
        `Failed to detect threats in content: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  //------ External Routes --------\\
  //This method will be exposed by default, unless the environment variable is set to false
  @Post('process')
  async externalProcess(@Body() data: any) {
    if (process.env.EXPOSE_PROCESS_ENDPOINT === 'false') {
      throw new HttpException(
        'This endpoint is not exposed',
        HttpStatus.NOT_FOUND,
      );
    } else {
      const response = this.process(data);
      return response;
    }
  }

  @Post('mailgun')
  async mailgun(@Body() body: MailgunWebhookPayload) {
    console.log('Mailgun request received');
    try {
      // Make sure that the request is coming from Mailgun
      const signingKey = process.env.MAILGUN_SIGNING_KEY;

      // Verify the authenticity of the webhook request
      const isVerified = verifyMailgunWebhook(body, signingKey);

      if (!isVerified) {
        throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      }
      // Make sure that the req has the required data
      if (
        !body.recipient ||
        !body.sender ||
        !body.subject ||
        !body['body-plain']
      ) {
        throw new HttpException(
          'Request is missing required data',
          HttpStatus.NOT_ACCEPTABLE,
        );
      }

      const recipient = body.recipient;
      const sender = body.sender;
      const subject = body.subject;
      const plainText = body['body-plain'];
      const content = plainText;

      // Create a JSON data object with the extracted email data
      const parsedData = {
        recipient,
        sender,
        subject,
        content,
      };

      // Process the email
      this.process(parsedData);
      // Return a success response to Mailgun
      return {
        statusCode: HttpStatus.OK,
      };
    } catch (error: any) {
      // Catch and handle any errors that occur during the processing of the email
      console.error(`Failed to process email: ${error.message}`);

      // Return an error response to Mailgun
      return {
        statusCode: HttpStatus.NOT_ACCEPTABLE,
      };
    }
  }

  // This method will only be exposed if the environment variable allows it
  @Post('moderate')
  async externalModerate(@Body() data: any) {
    if (process.env.EXPOSE_MODERATE_ENDPOINT === 'true') {
      return this.moderate(data);
    } else {
      throw new HttpException(
        'This endpoint is not exposed',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  // This method will only be exposed if the environment variable allows it
  @Post('rewrite')
  async externalRewrite(@Body() data: any) {
    if (process.env.EXPOSE_REWRITE_ENDPOINT === 'true') {
      if (!data.content || data.content.length <= 0) {
        throw new HttpException('Content is required', HttpStatus.BAD_REQUEST);
      }
      return this.rewrite(data.content);
    } else {
      throw new HttpException(
        'This endpoint is not exposed',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  // This method will only be exposed if the environment variable allows it
  // Detect threats in content
  @Post('threats')
  async externalThreats(@Body() data: any) {
    if (process.env.EXPOSE_THREATS_ENDPOINT === 'true') {
      //Check if content is provided
      if (!data.content || data.content.length <= 0) {
        throw new HttpException('Content is required', HttpStatus.BAD_REQUEST);
      }
      return this.threats(data.content);
    } else {
      throw new HttpException(
        'This endpoint is not exposed',
        HttpStatus.NOT_FOUND,
      );
    }
  }
}

const verifyMailgunWebhook = (
  body: Request['body'],
  signingKey: string,
): boolean => {
  const { timestamp, token, signature } = body;

  const encodedToken = crypto
    .createHmac('sha256', signingKey)
    .update(timestamp.concat(token))
    .digest('hex');

  return encodedToken === signature;
};

// Functions
async function sendEmail(
  domain: string,
  fromEmail: string,
  toEmails: Array<string>,
  subject: string,
  htmlBody: string,
  textBody: string,
) {
  try {
    // Create and send the email
    const sendResult = await mg.messages.create(domain, {
      from: fromEmail,
      to: toEmails,
      subject: subject,
      html: htmlBody,
      text: textBody,
    });

    console.log(sendResult);
  } catch (error) {
    console.error(error);
  }
}
