import { Module } from '@nestjs/common';
import { ClientWorkbookImporterService } from './client-workbook-importer.service';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';

@Module({ controllers: [TestsController], providers: [TestsService, ClientWorkbookImporterService] })
export class TestsModule {}
