import 'reflect-metadata';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../app.module';

async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('General Ecommerce API')
    .setDescription('General Ecommerce backend APIs')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outputDirectory = path.resolve(process.cwd(), '../../docs/api');
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, 'openapi.json'), JSON.stringify(document, null, 2));

  await app.close();
}

generateOpenApi().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'OpenAPI generation failed';
  console.error(message);
  process.exit(1);
});
