import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { apiReference } from '@scalar/nestjs-api-reference';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.use(json({ limit: '100mb' }));
    app.use(urlencoded({ limit: '100mb', extended: true }));

    // Create Swagger/OpenAPI document
    const config = new DocumentBuilder()
        .setTitle('BeReal API')
        .setDescription('An unofficial API for BeReal')
        .build();
    const document = SwaggerModule.createDocument(app, config);

    // Set up Scalar API Reference
    app.use(
        '/api',
        apiReference({
            spec: {
                content: document,
            },
            theme: 'purple', // You can choose: alternate, default, moon, purple, solarized
            // Optional: Pin to specific version
            cdn: 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.25.28',
        }),
    );

    app.enableCors({
        origin: '*',
        credentials: true,
    });

    await app.listen(process.env.PORT || 3299, () =>
        console.log('Listening on port ' + (process.env.PORT || 3299)),
    );
}
bootstrap();
